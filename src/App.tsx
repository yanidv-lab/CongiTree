import React, { useState, useEffect } from 'react';
import { 
  loadSavedTrees, 
  saveTreesToStorage, 
  loadActiveTreeId, 
  saveActiveTreeId, 
  updateTreeCompletionStatus,
  calculateTreeProgress,
  pruneNodeFromTree,
  promoteNodeToIndependentTree,
  getNodeDepth,
  getNodeAncestors,
  areTitlesDuplicateOrSimilar,
  MAX_NODE_EXPANSION_DEPTH
} from './lib/treeStore';
import { exportTreeToImage, exportTreeToJson, exportTreeToPdf, SaveOutcome } from './lib/exportUtils';
import { generateLearningTreeClient, expandTreeNodeClient, getActiveProviderLabel } from './lib/llmClient';
import { LearningTree, TreeNode, Resource } from './types';
import { Header } from './components/Header';
import { VisualTreeGraph } from './components/VisualTreeGraph';
import { StepListView } from './components/StepListView';
import { ResourceVaultView } from './components/ResourceVaultView';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import { SavedTreesSidebar } from './components/SavedTreesSidebar';
import { DashboardView } from './components/DashboardView';
import { TopicInputModal } from './components/TopicInputModal';
import { BranchApprovalModal } from './components/BranchApprovalModal';
import { CustomBranchModal } from './components/CustomBranchModal';
import { SettingsModal } from './components/SettingsModal';
import { 
  Sparkles, 
  GitFork, 
  CheckCircle2, 
  Plus, 
  Bookmark, 
  Download, 
  Loader2, 
  AlertCircle
} from 'lucide-react';

// Turns a server/client fallbackReason code into a user-facing explanation of what actually went
// wrong, so a problem doesn't just look like the AI silently deciding a topic is fully covered.
//
// These messages are deliberately specific about which limit was hit. The previous version mapped
// every 429 onto "your API key's quota is used up" - a claim that was usually false (a per-minute
// burst limit and an exhausted daily quota are the same status code) and that named Gemini even
// when the user had selected OpenAI or Anthropic. By the time this message is shown the app has
// already retried, dropped search grounding, and rebuilt the request as several smaller ones, so
// it can say honestly that the limit is a hard one.
function fallbackReasonMessage(reason: string | undefined, language: 'he' | 'en', provider: string, detail?: string): string {
  const isHe = language === 'he';
  // For the generic buckets our own wording says nothing useful, so append the provider's own
  // text. On a phone there is no console to read it from, and the real cause is often right there
  // (an unsupported tool, a disabled API, a model name the key can't reach).
  const suffix = detail && (reason === 'api_error' || reason === 'parse_error' || !reason)
    ? `\n${isHe ? 'פירוט מהספק' : 'Provider said'}: ${detail}`
    : '';
  switch (reason) {
    case 'rate_limit':
      return isHe
        ? `${provider} הגביל את קצב הבקשות (Rate Limit). זו מגבלה זמנית - לא סימן שהמכסה נגמרה. ניסינו שוב ובפיצול לבקשות קטנות ועדיין לא עבר. נסה שוב בעוד דקה.`
        : `${provider} is rate-limiting requests. This is a temporary burst limit, not a sign your quota is gone. We retried and split the request into smaller ones and it still didn't get through - try again in a minute.`;
    case 'grounding_limit':
      return isHe
        ? `מכסת חיפוש הרשת (Search Grounding) של ${provider} נגמרה. מכסת המודל עצמו כנראה תקינה - קישורי המקורות יהיו פחות מדויקים.`
        : `${provider}'s web-search grounding quota is used up. The model's own quota is probably fine - resource links will just be less precise.`;
    case 'quota_exhausted':
      return isHe
        ? `המכסה או היתרה של חשבון ${provider} נגמרה. המתנה לא תעזור - יש לחדש את החיוב או להמתין לאיפוס היומי.`
        : `Your ${provider} account's quota or credit balance is used up. Waiting won't help - top up billing or wait for the daily reset.`;
    case 'auth_error':
      return isHe
        ? `מפתח ה-API של ${provider} אינו תקין או שאין לו הרשאה. בדוק את המפתח בהגדרות.`
        : `The ${provider} API key is invalid or unauthorized. Check your key in Settings.`;
    case 'server_key_missing':
      return isHe
        ? 'בשרת לא מוגדר מפתח API. יש להזין מפתח אישי בהגדרות.'
        : 'The server has no API key configured. Enter your own key in Settings.';
    case 'parse_error':
      return (isHe
        ? 'לא התקבלה תגובה תקינה מהבינה המלאכותית, גם אחרי ניסיון בבקשות קטנות יותר.'
        : "Didn't get a valid response from the AI, even after retrying as smaller requests.") + suffix;
    default:
      return (isHe
        ? 'אירעה שגיאה בפנייה לבינה המלאכותית.'
        : 'Something went wrong contacting the AI.') + suffix;
  }
}

// Shown when the split path succeeded but some of its smaller calls didn't: the nodes are real,
// a few are just missing their checklist items and resources.
function partialResultMessage(language: 'he' | 'en'): string {
  return language === 'he'
    ? 'הבקשה פוצלה לבקשות קטנות כדי לעקוף מגבלת קצב. חלק מהצמתים עדיין ללא פריטים ומקורות - אפשר להריץ שוב בהמשך כדי להשלים.'
    : 'The request was split into smaller ones to get past a rate limit. Some nodes are still missing their items and resources - run again later to fill them in.';
}

// Raised when our own backend is reachable but rejected the request (rate limit, bad input,
// server-side AI failure). Distinct from "no backend at all", which is the normal case for the
// packaged Android build and is what the on-device API-key path exists to handle.
class ServerApiError extends Error {
  status: number;
  /** Why the backend failed, using the shared FailureKind codes. Undefined for older responses. */
  fallbackReason?: string;
  constructor(message: string, status: number, fallbackReason?: string) {
    super(message);
    this.name = 'ServerApiError';
    this.status = status;
    this.fallbackReason = fallbackReason;
  }
}

/**
 * Should we retry this backend failure using the user's own on-device key?
 *
 * Yes for anything that is about the *backend's* access to the model - it has no key configured,
 * its key is invalid, its quota is gone, or its own per-IP throttle refused us. The user's
 * personal key is a completely separate budget and is exactly what should be used instead. The
 * deployment having no key at all is the normal configuration for this app, since keys are meant
 * to be the user's own.
 *
 * No for a 400: the request itself was malformed, so re-sending it anywhere fails the same way.
 */
function shouldRetryOnDevice(err: ServerApiError): boolean {
  return err.status !== 400;
}

/**
 * POST to our backend. Resolves with the parsed payload on success.
 * Throws ServerApiError when the backend answered with an error (must be shown to the user),
 * or a plain BACKEND_UNREACHABLE Error when there is no backend to talk to (fall back on-device).
 */
async function callBackend(endpoint: string, payload: unknown): Promise<any> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('BACKEND_UNREACHABLE');
  }

  // A static host with no API behind it (Capacitor's local server, a plain CDN deploy) answers
  // these routes with the SPA's index.html or a generic 404 page. That's "no backend", not a
  // backend error, so it should fall through to the on-device path rather than surface as one.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('BACKEND_UNREACHABLE');
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('BACKEND_UNREACHABLE');
  }

  if (!response.ok || !data?.success) {
    throw new ServerApiError(data?.error || `HTTP ${response.status}`, response.status, data?.fallbackReason);
  }
  return data;
}

// The server's own rate limiter answers with 429 and a Hebrew-only message; translate it here so
// the user always learns *why* the request was refused rather than being told to enter an API key.
function serverErrorMessage(err: ServerApiError, language: 'he' | 'en'): string {
  const isHe = language === 'he';
  if (err.fallbackReason === 'server_key_missing') {
    return isHe
      ? 'בשרת לא מוגדר מפתח API, ולא נמצא מפתח אישי במכשיר. הזן מפתח בהגדרות כדי להמשיך.'
      : 'The server has no API key configured, and no personal key is stored on this device. Enter one in Settings to continue.';
  }
  if (err.status === 429) {
    return isHe
      ? 'הגעת למגבלת השימוש של השרת (יותר מדי בקשות). המתן מספר דקות ונסה שוב, או הזן מפתח API אישי בהגדרות כדי לעקוף את המגבלה.'
      : "You've hit the server's usage limit (too many requests). Wait a few minutes and try again, or enter your own API key in Settings to bypass the limit.";
  }
  return err.message;
}

export default function App() {
  const [savedTrees, setSavedTrees] = useState<LearningTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  
  // UI States
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'vault' | 'dashboard'>('dashboard');
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // What the user was trying to do when we discovered no API key was stored. Kept so saving a key
  // resumes that exact request instead of making them re-enter everything from scratch.
  const [pendingGenerate, setPendingGenerate] = useState<{
    topic: string;
    depthLevel: 'basic' | 'comprehensive' | 'mastery';
    customInstructions: string;
  } | null>(null);
  const [pendingExpandNodeId, setPendingExpandNodeId] = useState<string | null>(null);

  // Staging & Custom Branch Modals State
  const [stagingBranchApproval, setStagingBranchApproval] = useState<{
    parentNode?: TreeNode | null;
    proposedNodes: TreeNode[];
    isNewTree?: boolean;
    rawNewTree?: LearningTree;
  } | null>(null);

  const [customBranchParentNode, setCustomBranchParentNode] = useState<TreeNode | null>(null);
  
  // App Language State
  const [language, setLanguage] = useState<'he' | 'en'>('he');

  // Loading & Notification States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isExpanding, setIsExpanding] = useState<boolean>(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Display name of the LLM provider selected in Settings, so API error messages can name the
  // service the user actually chose instead of always saying "Gemini".
  const [providerLabel, setProviderLabel] = useState<string>('Gemini');

  // Language Effect: Update document dir and lang
  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Initialize saved trees on mount
  useEffect(() => {
    const trees = loadSavedTrees();
    setSavedTrees(trees);

    const activeId = loadActiveTreeId();
    if (activeId && trees.some(t => t.id === activeId)) {
      setActiveTreeId(activeId);
    } else if (trees.length > 0) {
      setActiveTreeId(trees[0].id);
      saveActiveTreeId(trees[0].id);
    }
  }, []);

  // Keep the provider label in sync: on mount, and whenever Settings closes (where it can change).
  useEffect(() => {
    let cancelled = false;
    getActiveProviderLabel()
      .then(label => { if (!cancelled) setProviderLabel(label); })
      .catch(() => { /* keep the current label - this only affects message wording */ });
    return () => { cancelled = true; };
  }, [isSettingsOpen]);

  // Current Active Tree
  const currentTree = savedTrees.find(t => t.id === activeTreeId) || null;

  // Show Toast helper. API failure explanations need longer than a normal confirmation toast -
  // they tell the user which limit was hit and what to do about it.
  const showToast = (msg: string, durationMs: number = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), durationMs);
  };

  const showFailureToast = (reason: string | undefined, detail?: string) =>
    showToast(fallbackReasonMessage(reason, language, providerLabel, detail), 8000);

  // Helper to update current active tree and save
  const updateCurrentTree = (mutator: (tree: LearningTree) => LearningTree) => {
    if (!currentTree) return;

    const updated = updateTreeCompletionStatus(mutator(currentTree));
    const nextSavedTrees = savedTrees.map(t => t.id === updated.id ? updated : t);

    setSavedTrees(nextSavedTrees);
    saveTreesToStorage(nextSavedTrees);

    // Keep selected node updated if open
    if (selectedNode && updated.nodes[selectedNode.id]) {
      setSelectedNode(updated.nodes[selectedNode.id]);
    }
  };

  // Toggle Item Checkbox
  const handleToggleItem = (nodeId: string, itemId: string) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node) return tree;

      const updatedItems = node.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );

      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: {
            ...node,
            items: updatedItems,
          },
        },
      };
    });
  };

  // Toggle Resource Checkbox
  const handleToggleResource = (nodeId: string, resourceId: string) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node) return tree;

      const updatedResources = node.resources.map(res =>
        res.id === resourceId ? { ...res, completed: !res.completed } : res
      );

      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: {
            ...node,
            resources: updatedResources,
          },
        },
      };
    });
  };

  // Add Custom Item
  const handleAddItem = (nodeId: string, itemText: string) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node) return tree;

      const newItem = {
        id: `${nodeId}_item_custom_${Date.now()}`,
        text: itemText,
        completed: false,
      };

      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: {
            ...node,
            items: [...node.items, newItem],
          },
        },
      };
    });
    showToast(language === 'he' ? 'תת-נושא נוסף בהצלחה' : 'Subtopic added successfully');
  };

  // Add Custom Resource
  const handleAddResource = (nodeId: string, resource: Partial<Resource>) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node) return tree;

      const newRes: Resource = {
        id: `${nodeId}_res_custom_${Date.now()}`,
        title: resource.title || (language === 'he' ? 'מקור מותאם' : 'Custom Resource'),
        type: resource.type || 'youtube',
        url: resource.url,
        provider: resource.provider || (language === 'he' ? 'מקור אישי' : 'Personal Source'),
        description: resource.description || '',
        isVerifiedAcademic: resource.isVerifiedAcademic ?? true,
        completed: false,
      };

      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: {
            ...node,
            resources: [...node.resources, newRes],
          },
        },
      };
    });
    showToast(language === 'he' ? 'מקור לימוד נוסף בהצלחה' : 'Learning resource added successfully');
  };

  // Save Notes for Node
  const handleSaveNotes = (nodeId: string, notes: string) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node) return tree;

      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: {
            ...node,
            notes,
          },
        },
      };
    });
  };

  // Generate New Tree API Call
  const handleGenerateTree = async (
    topic: string,
    depthLevel: 'basic' | 'comprehensive' | 'mastery',
    customInstructions: string
  ) => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      let rawTree: LearningTree;
      let fallbackReason: string | undefined;
      let fallbackDetail: string | undefined;
      let isPartial = false;

      try {
        const data = await callBackend('/api/generate-tree', { topic, language, depthLevel, customInstructions });
        rawTree = updateTreeCompletionStatus(data.tree);
        if (data.isFallback) { fallbackReason = data.fallbackReason; fallbackDetail = data.fallbackDetail; }
        if (data.isPartial) isPartial = true;
      } catch (serverErr) {
        // A malformed request fails the same way anywhere, so surface it as-is. Every other
        // backend failure is about the *backend's* access to the model - no key configured, its
        // key rejected, its quota gone, its own per-IP throttle - and the user's personal key is a
        // separate budget, so it is worth trying. A deployment with no server key at all is the
        // normal configuration here, and this is the path that lets the entered key be used.
        if (serverErr instanceof ServerApiError && !shouldRetryOnDevice(serverErr)) throw serverErr;
        try {
          const clientResult = await generateLearningTreeClient({ topic, language, depthLevel, customInstructions });
          rawTree = updateTreeCompletionStatus(clientResult.tree);
          if (clientResult.isFallback) fallbackReason = clientResult.fallbackReason;
          if (clientResult.isPartial) isPartial = true;
        } catch (deviceErr: any) {
          // No personal key either: the backend's own reason is more informative than a bare
          // "enter a key" - except when the backend's reason IS "there is no key", in which case
          // prompting for one is exactly right.
          if (deviceErr?.message === 'API_KEY_MISSING' && serverErr instanceof ServerApiError
              && serverErr.fallbackReason !== 'server_key_missing') {
            throw serverErr;
          }
          throw deviceErr;
        }
      }

      const subNodesList = Object.values(rawTree.nodes).filter(n => n.id !== rawTree.rootNodeId);

      setIsNewModalOpen(false);

      // Open BranchApprovalModal so user can approve initial sub-branches
      setStagingBranchApproval({
        parentNode: rawTree.nodes[rawTree.rootNodeId] || null,
        proposedNodes: subNodesList,
        isNewTree: true,
        rawNewTree: rawTree,
      });

      // The AI request didn't actually succeed (quota/rate limit/auth/parse issue) and a generic
      // fallback tree was substituted - tell the user explicitly instead of letting them think
      // this basic tree IS the real AI-researched result.
      if (fallbackReason) {
        showFailureToast(fallbackReason, fallbackDetail);
      } else if (isPartial) {
        showToast(partialResultMessage(language), 8000);
      }

    } catch (err: any) {
      console.error('Error generating tree:', err);
      if (err?.message === 'API_KEY_MISSING') {
        // Deliberately leave the topic modal open (and its typed topic/depth/instructions intact)
        // so the user doesn't lose what they entered just because a key was needed - the key
        // dialog stacks on top, and saving a key re-runs this exact request automatically.
        setPendingGenerate({ topic, depthLevel, customInstructions });
        setIsSettingsOpen(true);
        showToast(
          language === 'he'
            ? 'האפליקציה פועלת במצב עצמאי - הזן מפתח API וניצור את העץ שביקשת אוטומטית'
            : "App is running in standalone mode - enter an API key and we'll build the tree you asked for automatically"
        );
      } else if (err instanceof ServerApiError) {
        setErrorMessage(serverErrorMessage(err, language));
      } else {
        setErrorMessage(err.message || (language === 'he' ? 'שגיאה בחיבור לשרת יצירת עץ הלמידה' : 'Error connecting to the tree-generation server'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Mark a node as having no more distinct sub-topics left to expand into
  const markExpansionExhausted = (nodeId: string) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node) return tree;
      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: { ...node, expansionExhausted: true },
        },
      };
    });
  };

  const clearExpansionExhausted = (nodeId: string) => {
    updateCurrentTree(tree => {
      const node = tree.nodes[nodeId];
      if (!node || !node.expansionExhausted) return tree;
      return {
        ...tree,
        nodes: {
          ...tree.nodes,
          [nodeId]: { ...node, expansionExhausted: false },
        },
      };
    });
  };

  // Expand Node API Call
  const handleExpandNode = async (node: TreeNode) => {
    if (!currentTree) return;

    // A previous attempt concluded there was nothing distinct left here. That verdict is NOT
    // permanent: it may have come from a transient API failure, an over-eager model, or an older
    // build with stricter dedup - and because the flag is persisted to localStorage, treating it
    // as final left nodes in existing trees impossible to ever expand again. So retry instead,
    // clearing the flag first; if the topic really is exhausted, this attempt re-sets it.
    if (node.expansionExhausted) {
      clearExpansionExhausted(node.id);
      showToast(
        language === 'he'
          ? `מנסה שוב למצוא תתי-נושאים חדשים לענף "${node.title}"...`
          : `Retrying the search for new sub-topics under "${node.title}"...`
      );
    }

    // Hard safety ceiling only - not meant to trigger in normal use. Real stopping happens
    // once a real attempt (below) confirms there's nothing distinct left to add.
    const nodeDepth = getNodeDepth(currentTree, node.id);
    if (nodeDepth >= MAX_NODE_EXPANSION_DEPTH) {
      showToast(
        language === 'he'
          ? `סוף נושא! הענף "${node.title}" הגיע לעומק המרבי המותר (${MAX_NODE_EXPANSION_DEPTH}).`
          : `End of topic! "${node.title}" reached the maximum allowed depth (${MAX_NODE_EXPANSION_DEPTH}).`
      );
      markExpansionExhausted(node.id);
      return;
    }

    setIsExpanding(true);
    setExpandingNodeId(node.id);

    try {
      // Titles already in the tree, sent as an array. They used to be comma-joined into one
      // string that the server split back on ',', which shredded any title containing a comma
      // into fragments - and short fragments match far too eagerly during dedup, rejecting
      // legitimate new sub-topics as "duplicates" and ending the branch early.
      const existingTitles = (Object.values(currentTree.nodes) as TreeNode[]).map(n => n.title);
      const ancestorTitles = getNodeAncestors(currentTree, node.id).map(a => a.title);
      const expandPayload = {
        treeTopic: currentTree.topic,
        nodeId: node.id,
        nodeTitle: node.title,
        nodeDescription: node.description,
        nodeDepth,
        ancestors: ancestorTitles,
        existingTitles,
        language,
      };

      let data: any;
      try {
        data = await callBackend('/api/expand-node', expandPayload);
      } catch (serverErr) {
        // See handleGenerateTree: everything except a malformed request is worth retrying with
        // the user's own key, which is a separate budget from the backend's.
        if (serverErr instanceof ServerApiError && !shouldRetryOnDevice(serverErr)) throw serverErr;
        try {
          data = await expandTreeNodeClient(expandPayload);
        } catch (deviceErr: any) {
          if (deviceErr?.message === 'API_KEY_MISSING' && serverErr instanceof ServerApiError
              && serverErr.fallbackReason !== 'server_key_missing') {
            throw serverErr;
          }
          throw deviceErr;
        }
      }

      // Every attempt failed - retries, the ungrounded retry, and rebuilding the request as
      // several smaller ones. That is an API problem, NOT a finding that the topic has nothing
      // left to teach, so the node must not be marked exhausted here.
      if (data.isFallback) {
        showFailureToast(data.fallbackReason, data.fallbackDetail);
        return;
      }

      if (data.isEndOfTopic || !data.subNodes || data.subNodes.length === 0) {
        markExpansionExhausted(node.id);
        showToast(
          language === 'he'
            ? `סוף נושא! הענף "${node.title}" מפורט ברמה מרבית ולא נמצאו תתי-נושאים חדשים (נמנעה כפילות).`
            : `End of topic! "${node.title}" is fully detailed and no new unique sub-topics were found.`
        );
        return;
      }

      const candidateSubNodes: TreeNode[] = data.subNodes;

      // Filter out candidates similar to existing tree nodes
      const uniqueCandidates = candidateSubNodes.filter(cand =>
        !existingTitles.some(ex => areTitlesDuplicateOrSimilar(cand.title, ex))
      );

      if (uniqueCandidates.length === 0) {
        markExpansionExhausted(node.id);
        showToast(
          language === 'he'
            ? `סוף נושא! כל הענפים שהוצעו כבר קיימים בעץ הלמידה (נמנעו כפילויות).`
            : `End of topic! All proposed branches already exist in the learning tree (duplicates prevented).`
        );
        return;
      }

      // Open staging approval modal for candidate branches
      setStagingBranchApproval({
        parentNode: node,
        proposedNodes: uniqueCandidates,
        isNewTree: false,
      });

      // These branches are real model output, but a rate limit forced them to be built from
      // several smaller calls and some of those didn't land - say so rather than letting the user
      // wonder why a couple of branches came back without items or resources.
      if (data.isPartial) {
        showToast(partialResultMessage(language), 8000);
      }

    } catch (err: any) {
      console.error('Error expanding node:', err);
      if (err?.message === 'API_KEY_MISSING') {
        // Remember which node we were expanding so saving a key resumes it automatically.
        setPendingExpandNodeId(node.id);
        setIsSettingsOpen(true);
        showToast(
          language === 'he'
            ? 'האפליקציה פועלת במצב עצמאי - הזן מפתח API ונמשיך להרחיב את הענף אוטומטית'
            : "App is running in standalone mode - enter an API key and we'll continue expanding this branch automatically"
        );
      } else if (err instanceof ServerApiError) {
        showToast(serverErrorMessage(err, language));
      } else {
        showToast((language === 'he' ? 'שגיאה בהרחבת הענף: ' : 'Error expanding branch: ') + (err?.message || String(err)));
      }
    } finally {
      setIsExpanding(false);
      setExpandingNodeId(null);
    }
  };

  // A key was just stored. Close Settings and pick the interrupted request back up where it left
  // off, so needing a key never costs the user the topic they typed or the branch they clicked.
  const handleApiKeySaved = () => {
    setIsSettingsOpen(false);

    if (pendingGenerate) {
      const { topic, depthLevel, customInstructions } = pendingGenerate;
      setPendingGenerate(null);
      handleGenerateTree(topic, depthLevel, customInstructions);
      return;
    }

    if (pendingExpandNodeId) {
      const nodeToExpand = currentTree?.nodes[pendingExpandNodeId];
      setPendingExpandNodeId(null);
      if (nodeToExpand) handleExpandNode(nodeToExpand);
    }
  };

  // Confirm Branch Approval from Staging Modal
  const handleConfirmBranchApproval = (approvedNodes: TreeNode[]) => {
    if (!stagingBranchApproval) return;

    if (stagingBranchApproval.isNewTree && stagingBranchApproval.rawNewTree) {
      // Newly generated tree: filter out non-approved subnodes
      const rawTree = stagingBranchApproval.rawNewTree;
      const approvedIds = new Set(approvedNodes.map(n => n.id));
      approvedIds.add(rawTree.rootNodeId); // Keep root node

      const filteredNodes: Record<string, TreeNode> = {};
      (Object.values(rawTree.nodes) as TreeNode[]).forEach((node) => {
        if (approvedIds.has(node.id)) {
          filteredNodes[node.id] = {
            ...node,
            childrenIds: node.childrenIds.filter(cid => approvedIds.has(cid)),
          };
        }
      });

      const newTree = updateTreeCompletionStatus({
        ...rawTree,
        nodes: filteredNodes,
      });

      const updatedSavedTrees = [newTree, ...savedTrees];
      setSavedTrees(updatedSavedTrees);
      saveTreesToStorage(updatedSavedTrees);

      setActiveTreeId(newTree.id);
      saveActiveTreeId(newTree.id);

      showToast(
        language === 'he'
          ? `עץ הלמידה "${newTree.topic}" נוצר עם ${approvedNodes.length} ענפים מאושרים!`
          : `Learning tree "${newTree.topic}" created with ${approvedNodes.length} approved branches!`
      );
    } else if (stagingBranchApproval.parentNode) {
      // Expanding an existing node
      const parent = stagingBranchApproval.parentNode;

      updateCurrentTree(tree => {
        const nextNodes = { ...tree.nodes };
        const newChildIds: string[] = [...(nextNodes[parent.id]?.childrenIds || [])];

        // Use the same fuzzy near-duplicate check as everywhere else in the app (client dedup,
        // server dedup, custom sub-branch add) instead of a raw exact-string match, so two
        // differently-worded but overlapping approved branches can't both slip into the tree.
        const existingTitlesList: string[] = Object.values(nextNodes).map((n: any) => n.title);
        let addedCount = 0;

        approvedNodes.forEach(sub => {
          if (!existingTitlesList.some(ex => areTitlesDuplicateOrSimilar(sub.title, ex))) {
            nextNodes[sub.id] = sub;
            if (!newChildIds.includes(sub.id)) {
              newChildIds.push(sub.id);
            }
            existingTitlesList.push(sub.title);
            addedCount++;
          }
        });

        if (nextNodes[parent.id]) {
          nextNodes[parent.id] = {
            ...nextNodes[parent.id],
            childrenIds: newChildIds,
          };
        }

        setTimeout(() => {
          const skippedCount = approvedNodes.length - addedCount;
          showToast(
            language === 'he'
              ? `התווספו ${addedCount} ענפים חדשים! ${skippedCount > 0 ? `(${skippedCount} סוננו עקב כפילות נושאים)` : ''}`
              : `Added ${addedCount} new branches! ${skippedCount > 0 ? `(${skippedCount} filtered out as duplicate topics)` : ''}`
          );
        }, 0);

        return {
          ...tree,
          nodes: nextNodes,
        };
      });
    }

    setStagingBranchApproval(null);
  };

  // Prune Branch Handler
  const handlePruneNode = (nodeId: string) => {
    if (!currentTree) return;
    if (nodeId === currentTree.rootNodeId) {
      showToast(
        language === 'he'
          ? 'אינך יכול לגדוע את הצומת הראשי. השתמש במחיקת פרויקט.'
          : 'You cannot prune the root node. Use delete project instead.'
      );
      return;
    }

    const updated = pruneNodeFromTree(currentTree, nodeId);
    const nextSaved = savedTrees.map(t => t.id === updated.id ? updated : t);
    setSavedTrees(nextSaved);
    saveTreesToStorage(nextSaved);

    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(null);
    }

    showToast(
      language === 'he'
        ? 'הענף וכל ענפי המשנה שלו נגדעו בהצלחה מהעץ'
        : 'The branch and all its sub-branches were successfully pruned from the tree'
    );
  };

  // Promote Branch to Independent Standalone Project
  const handlePromoteNodeToTree = (node: TreeNode) => {
    if (!currentTree) return;
    try {
      const promotedTree = promoteNodeToIndependentTree(currentTree, node.id, language);

      const nextSaved = [promotedTree, ...savedTrees];
      setSavedTrees(nextSaved);
      saveTreesToStorage(nextSaved);

      showToast(
        language === 'he'
          ? `הענף "${node.title}" הופרד והפך לפרויקט עצמאי במאגר!`
          : `Branch "${node.title}" was promoted to a standalone project in your library!`
      );

      // Switch to new standalone project
      setActiveTreeId(promotedTree.id);
      saveActiveTreeId(promotedTree.id);
      setSelectedNode(null);
    } catch (err: any) {
      showToast((language === 'he' ? 'שגיאה בהעברת הענף לפרויקט עצמאי: ' : 'Error promoting branch to standalone project: ') + err.message);
    }
  };

  // Add Custom Manual Sub-Branch
  const handleAddCustomSubNode = (parentNodeId: string, newNodeData: Partial<TreeNode>) => {
    if (!currentTree) return;

    const newTitle = (newNodeData.title || (language === 'he' ? 'ענף מותאם אישית' : 'Custom Sub-Branch')).trim();
    const existingNodesList = Object.values(currentTree.nodes) as TreeNode[];
    
    if (existingNodesList.some(n => areTitlesDuplicateOrSimilar(newTitle, n.title))) {
      showToast(
        language === 'he'
          ? `שגיאה: הנושא "${newTitle}" או נושא דומה לו כבר קיים בעץ! (נמנעה כפילות)`
          : `Error: Topic "${newTitle}" or a similar topic already exists in the tree!`
      );
      return;
    }

    const subId = `custom_node_${Date.now()}`;
    const newNode: TreeNode = {
      id: subId,
      title: newTitle,
      description: newNodeData.description || '',
      level: newNodeData.level || 'core',
      isBaseNode: false,
      parentId: parentNodeId,
      childrenIds: [],
      completed: false,
      items: newNodeData.items || [],
      resources: newNodeData.resources || [],
    };

    updateCurrentTree(tree => {
      const nextNodes = { ...tree.nodes };
      nextNodes[subId] = newNode;

      if (nextNodes[parentNodeId]) {
        const parent = nextNodes[parentNodeId];
        nextNodes[parentNodeId] = {
          ...parent,
          childrenIds: [...(parent.childrenIds || []), subId],
        };
      }

      return {
        ...tree,
        nodes: nextNodes,
      };
    });

    showToast(
      language === 'he'
        ? `הענף המותאם אישית "${newNode.title}" נוסף בהצלחה!`
        : `Custom branch "${newNode.title}" added successfully!`
    );
  };

  // Turns a save outcome into the right message - notably, a user who dismissed the save/share
  // dialog shouldn't be told the export "failed", and a successful save shouldn't claim the file
  // "downloaded" when on Android it was handed to the share sheet for the user to place.
  const saveOutcomeToast = (outcome: SaveOutcome, kind: 'pdf' | 'image' | 'json') => {
    const isHe = language === 'he';
    if (outcome === 'cancelled') {
      return isHe ? 'השמירה בוטלה.' : 'Save cancelled.';
    }
    if (outcome === 'failed') {
      return isHe ? 'שמירת הקובץ נכשלה. נסה שוב.' : 'Saving the file failed. Please try again.';
    }
    if (kind === 'pdf') return isHe ? 'קובץ ה-PDF נשמר בהצלחה!' : 'PDF saved successfully!';
    if (kind === 'image') return isHe ? 'התמונה נשמרה בהצלחה!' : 'Image saved successfully!';
    return isHe ? 'הקובץ נשמר בהצלחה!' : 'File saved successfully!';
  };

  // Export Image
  const handleExportImage = async () => {
    showToast(language === 'he' ? 'מייצא את מפת הלמידה כתמונה...' : 'Exporting the learning map as an image...');
    const outcome = await exportTreeToImage('tree_export_stage', currentTree?.topic || 'learning_map');
    showToast(saveOutcomeToast(outcome, 'image'));
  };

  // Export PDF with Side Topics Breakdown & Clickable Hyperlinks
  const handleExportPdf = async (treeToExport?: LearningTree) => {
    const tree = treeToExport || currentTree;
    if (!tree) return;
    // A large tree can take a while to render at export quality - keep a persistent loading
    // state (disables/spins the export button) instead of relying on the toast, which
    // auto-dismisses after a few seconds and previously left no feedback for the rest of the
    // wait, making the export look stuck/broken even though it eventually completed.
    setIsExportingPdf(true);
    showToast(language === 'he' ? 'מייצר מסמך PDF עם פירוט נושאים וקישורים... זה עשוי לקחת מספר שניות' : 'Generating PDF with topics & hyperlinks... this can take a few seconds');
    try {
      const outcome = await exportTreeToPdf(tree, language);
      showToast(saveOutcomeToast(outcome, 'pdf'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Delete Tree
  const handleDeleteTree = (treeId: string) => {
    const nextTrees = savedTrees.filter(t => t.id !== treeId);
    setSavedTrees(nextTrees);
    saveTreesToStorage(nextTrees);

    if (activeTreeId === treeId) {
      const nextActive = nextTrees.length > 0 ? nextTrees[0].id : null;
      setActiveTreeId(nextActive);
      if (nextActive) saveActiveTreeId(nextActive);
    }
    showToast(language === 'he' ? 'עץ הלמידה נמחק' : 'Learning tree deleted');
  };

  // Duplicate Tree
  const handleDuplicateTree = (tree: LearningTree) => {
    const duplicated: LearningTree = {
      ...tree,
      id: `tree_dup_${Date.now()}`,
      topic: language === 'he' ? `${tree.topic} (עותק)` : `${tree.topic} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextTrees = [duplicated, ...savedTrees];
    setSavedTrees(nextTrees);
    saveTreesToStorage(nextTrees);
    setActiveTreeId(duplicated.id);
    saveActiveTreeId(duplicated.id);
    showToast(language === 'he' ? 'העץ שוכפל בהצלחה' : 'Tree duplicated successfully');
  };

  // Import Json
  const handleImportJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.nodes && parsed.topic) {
        const importedTree = updateTreeCompletionStatus({
          ...parsed,
          id: `tree_imp_${Date.now()}`,
          createdAt: new Date().toISOString(),
        });

        const nextTrees = [importedTree, ...savedTrees];
        setSavedTrees(nextTrees);
        saveTreesToStorage(nextTrees);
        setActiveTreeId(importedTree.id);
        saveActiveTreeId(importedTree.id);
        showToast(language === 'he' ? 'קובץ עץ ה-JSON יובא בהצלחה!' : 'JSON tree file imported successfully!');
      } else {
        throw new Error(language === 'he' ? 'מבנה JSON לא תקין' : 'Invalid JSON structure');
      }
    } catch (err: any) {
      alert((language === 'he' ? 'שגיאה ביבוא קובץ: ' : 'Error importing file: ') + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-slate-900 flex flex-col font-['Heebo',sans-serif]">
      {/* App Header */}
      <Header
        currentTree={currentTree}
        savedTreesCount={savedTrees.length}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onExportImage={handleExportImage}
        onExportPdf={() => handleExportPdf()}
        onExportJson={async () => {
          if (!currentTree) return;
          const outcome = await exportTreeToJson(currentTree, currentTree.topic);
          showToast(saveOutcomeToast(outcome, 'json'));
        }}
        language={language}
        setLanguage={setLanguage}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isExportingPdf={isExportingPdf}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col overflow-y-auto min-h-0">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="w-4 h-4 fill-white text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="m-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 font-bold hover:underline"
            >
              {language === 'he' ? 'סגור' : 'Close'}
            </button>
          </div>
        )}

        {/* Empty State when no trees exist */}
        {!currentTree ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto font-body">
            <div className="w-20 h-20 rounded-full bg-accent text-paper flex items-center justify-center mb-5 shadow-elev-md">
              <GitFork className="w-9 h-9 rotate-90" strokeWidth={2.75} />
            </div>
            <h2 className="font-heading text-2xl text-ink mb-2 tracking-tight">{language === 'he' ? 'ברוך הבא ל-CogniTree AI' : 'Welcome to CogniTree AI'}</h2>
            <p className="text-sm text-ink/65 mb-7 leading-relaxed max-w-sm">
              {language === 'he' ? 'מערכת חכמה הבונה עצי למידה ויזואליים, מבוססי מקורות מחקריים מאומתים, עם מעקב ירוק/אפור בזמן אמת.' : 'A smart system that builds visual learning trees based on verified sources, with real-time green/gray tracking.'}
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-700 text-paper font-heading text-sm shadow-elev-md transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>{language === 'he' ? 'צור את עץ הלמידה הראשון שלך' : 'Create your first learning tree'}</span>
            </button>
          </div>
        ) : (
          <div id="tree_export_stage" className="flex-1 flex flex-col min-h-0">
            {/* View Switcher Views */}
            {viewMode === 'dashboard' && (
              <DashboardView
                savedTrees={savedTrees}
                activeTreeId={activeTreeId}
                onSelectTree={(tree) => {
                  setActiveTreeId(tree.id);
                  saveActiveTreeId(tree.id);
                  setViewMode('graph');
                }}
                onDeleteTree={handleDeleteTree}
                onOpenNewModal={() => setIsNewModalOpen(true)}
                onExportPdf={(tree) => handleExportPdf(tree)}
                language={language}
              />
            )}

            {viewMode === 'graph' && (
              <VisualTreeGraph
                tree={currentTree}
                onSelectNode={(node) => setSelectedNode(node)}
                onExpandNode={handleExpandNode}
                onToggleItem={handleToggleItem}
                onToggleResource={handleToggleResource}
                onPruneNode={handlePruneNode}
                onPromoteNodeToTree={handlePromoteNodeToTree}
                onOpenCustomBranchModal={(node) => setCustomBranchParentNode(node)}
                isLoadingExpand={isExpanding}
                expandingNodeId={expandingNodeId}
                language={language}
              />
            )}

            {viewMode === 'list' && (
              <StepListView
                tree={currentTree}
                onSelectNode={(node) => setSelectedNode(node)}
                onToggleItem={handleToggleItem}
                onToggleResource={handleToggleResource}
                onExpandNode={handleExpandNode}
                isLoadingExpand={isExpanding}
                language={language}
              />
            )}

            {viewMode === 'vault' && (
              <ResourceVaultView
                tree={currentTree}
                onToggleResource={handleToggleResource}
                language={language}
              />
            )}
          </div>
        )}
      </main>

      {/* Slide-over Node Details Drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        treeTopic={currentTree?.topic || ''}
        rootNodeId={currentTree?.rootNodeId}
        onClose={() => setSelectedNode(null)}
        onToggleItem={handleToggleItem}
        onToggleResource={handleToggleResource}
        onAddItem={handleAddItem}
        onAddResource={handleAddResource}
        onSaveNotes={handleSaveNotes}
        onExpandNode={handleExpandNode}
        onPruneNode={handlePruneNode}
        onPromoteNodeToTree={handlePromoteNodeToTree}
        onOpenCustomBranchModal={(node) => setCustomBranchParentNode(node)}
        isLoadingExpand={isExpanding}
        language={language}
      />

      {/* Saved Trees Sidebar */}
      <SavedTreesSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        savedTrees={savedTrees}
        activeTreeId={activeTreeId}
        onSelectTree={(tree) => {
          setActiveTreeId(tree.id);
          saveActiveTreeId(tree.id);
        }}
        onDeleteTree={handleDeleteTree}
        onDuplicateTree={handleDuplicateTree}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onImportJson={handleImportJson}
        onExportPdf={(tree) => handleExportPdf(tree)}
        language={language}
      />

      {/* Topic Input Creation Modal */}
      <TopicInputModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleGenerateTree}
        isLoading={isGenerating}
        language={language}
      />

      {/* Staging & Branch Approval Modal */}
      {stagingBranchApproval && (
        <BranchApprovalModal
          parentTitle={stagingBranchApproval.parentNode?.title || currentTree?.topic}
          proposedNodes={stagingBranchApproval.proposedNodes}
          onConfirm={handleConfirmBranchApproval}
          language={language}
          onCancel={() => {
            // If cancelling a new tree generation, show toast
            if (stagingBranchApproval.isNewTree && stagingBranchApproval.rawNewTree) {
              const raw = stagingBranchApproval.rawNewTree;
              const nextTrees = [raw, ...savedTrees];
              setSavedTrees(nextTrees);
              saveTreesToStorage(nextTrees);
              setActiveTreeId(raw.id);
              saveActiveTreeId(raw.id);
              showToast(language === 'he' ? `עץ הלמידה "${raw.topic}" נוצר עם הענפים המקורים` : `Learning tree "${raw.topic}" created with original branches`);
            }
            setStagingBranchApproval(null);
          }}
        />
      )}

      {/* Custom Branch Creation Modal */}
      {customBranchParentNode && (
        <CustomBranchModal
          parentNode={customBranchParentNode}
          onAddSubNode={handleAddCustomSubNode}
          onClose={() => setCustomBranchParentNode(null)}
          language={language}
        />
      )}

      {/* API Key Settings Modal (standalone/Android fallback mode) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeySaved={handleApiKeySaved}
        language={language}
      />
    </div>
  );
}
