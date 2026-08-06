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
import { exportTreeToImage, exportTreeToJson, exportTreeToPdf } from './lib/exportUtils';
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

export default function App() {
  const [savedTrees, setSavedTrees] = useState<LearningTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  
  // UI States
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'vault' | 'dashboard'>('dashboard');
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);

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

  // Current Active Tree
  const currentTree = savedTrees.find(t => t.id === activeTreeId) || null;

  // Show Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
      const response = await fetch('/api/generate-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          language,
          depthLevel,
          customInstructions,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.tree) {
        throw new Error(data.error || 'נכשלה יצירת עץ הלמידה');
      }

      const rawTree: LearningTree = updateTreeCompletionStatus(data.tree);
      const subNodesList = Object.values(rawTree.nodes).filter(n => n.id !== rawTree.rootNodeId);

      setIsNewModalOpen(false);

      // Open BranchApprovalModal so user can approve initial sub-branches
      setStagingBranchApproval({
        parentNode: rawTree.nodes[rawTree.rootNodeId] || null,
        proposedNodes: subNodesList,
        isNewTree: true,
        rawNewTree: rawTree,
      });

    } catch (err: any) {
      console.error('Error generating tree:', err);
      setErrorMessage(err.message || 'שגיאה בחיבור לשרת יצירת עץ הלמידה');
    } finally {
      setIsGenerating(false);
    }
  };

  // Expand Node API Call
  const handleExpandNode = async (node: TreeNode) => {
    if (!currentTree) return;

    // Check max depth to prevent infinite loops
    const nodeDepth = getNodeDepth(currentTree, node.id);
    if (nodeDepth >= MAX_NODE_EXPANSION_DEPTH) {
      showToast(
        language === 'he'
          ? `סוף נושא! הענף "${node.title}" הגיע לעומק הלמידה המרבי. ענף זה מפורט ברמה מרבית נדרשת (נמנעה כפילות בלתי פוסקת).`
          : `End of topic! "${node.title}" reached maximum depth level (${nodeDepth}). Expansion stopped to prevent infinite duplicate loops.`
      );
      return;
    }

    setIsExpanding(true);
    setExpandingNodeId(node.id);

    try {
      // Build context string of current node titles and ancestor titles
      const contextTitles = (Object.values(currentTree.nodes) as TreeNode[]).map(n => n.title).join(', ');
      const ancestorTitles = getNodeAncestors(currentTree, node.id).map(a => a.title);

      const response = await fetch('/api/expand-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treeTopic: currentTree.topic,
          nodeId: node.id,
          nodeTitle: node.title,
          nodeDescription: node.description,
          nodeDepth,
          ancestors: ancestorTitles,
          existingTreeContext: contextTitles,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'נכשלה הרחבת הענף');
      }

      if (data.isEndOfTopic || !data.subNodes || data.subNodes.length === 0) {
        showToast(
          language === 'he'
            ? `סוף נושא! הענף "${node.title}" מפורט ברמה מרבית ולא נמצאו תתי-נושאים חדשים (נמנעה כפילות).`
            : `End of topic! "${node.title}" is fully detailed and no new unique sub-topics were found.`
        );
        return;
      }

      const candidateSubNodes: TreeNode[] = data.subNodes;
      const existingTitles = (Object.values(currentTree.nodes) as TreeNode[]).map(n => n.title);

      // Filter out candidates similar to existing tree nodes
      const uniqueCandidates = candidateSubNodes.filter(cand => 
        !existingTitles.some(ex => areTitlesDuplicateOrSimilar(cand.title, ex))
      );

      if (uniqueCandidates.length === 0) {
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

    } catch (err: any) {
      console.error('Error expanding node:', err);
      showToast('שגיאה בהרחבת הענף: ' + err.message);
    } finally {
      setIsExpanding(false);
      setExpandingNodeId(null);
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

      showToast(`עץ הלמידה "${newTree.topic}" נוצר עם ${approvedNodes.length} ענפים מאושרים!`);
    } else if (stagingBranchApproval.parentNode) {
      // Expanding an existing node
      const parent = stagingBranchApproval.parentNode;

      updateCurrentTree(tree => {
        const nextNodes = { ...tree.nodes };
        const newChildIds: string[] = [...(nextNodes[parent.id]?.childrenIds || [])];

        const existingTitles = new Set(Object.values(nextNodes).map((n: any) => n.title.toLowerCase().trim()));
        let addedCount = 0;

        approvedNodes.forEach(sub => {
          if (!existingTitles.has(sub.title.toLowerCase().trim())) {
            nextNodes[sub.id] = sub;
            if (!newChildIds.includes(sub.id)) {
              newChildIds.push(sub.id);
            }
            existingTitles.add(sub.title.toLowerCase().trim());
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
            showToast(`התווספו ${addedCount} ענפים חדשים! ${addedCount < approvedNodes.length ? `(${approvedNodes.length - addedCount} סוננו עקב כפילות נושאים)` : ''}`);
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
      showToast("אינך יכול לגדוע את הצומת הראשי. השתמש במחיקת פרויקט.");
      return;
    }

    const updated = pruneNodeFromTree(currentTree, nodeId);
    const nextSaved = savedTrees.map(t => t.id === updated.id ? updated : t);
    setSavedTrees(nextSaved);
    saveTreesToStorage(nextSaved);

    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(null);
    }

    showToast("הענף וכל ענפי המשנה שלו נגדעו בהצלחה מהעץ");
  };

  // Promote Branch to Independent Standalone Project
  const handlePromoteNodeToTree = (node: TreeNode) => {
    if (!currentTree) return;
    try {
      const promotedTree = promoteNodeToIndependentTree(currentTree, node.id);

      const nextSaved = [promotedTree, ...savedTrees];
      setSavedTrees(nextSaved);
      saveTreesToStorage(nextSaved);

      showToast(`הענף "${node.title}" הופרד והפך לפרויקט עצמאי במאגר!`);

      // Switch to new standalone project
      setActiveTreeId(promotedTree.id);
      saveActiveTreeId(promotedTree.id);
      setSelectedNode(null);
    } catch (err: any) {
      showToast("שגיאה בהעברת הענף לפרויקט עצמאי: " + err.message);
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

    showToast(`הענף המותאם אישית "${newNode.title}" נוסף בהצלחה!`);
  };

  // Export Image
  const handleExportImage = async () => {
    showToast('מייצא את מפת הלמידה כתמונה...');
    const success = await exportTreeToImage('tree_export_stage', currentTree?.topic || 'learning_map');
    if (success) {
      showToast('התמונה יורדה בהצלחה!');
    } else {
      showToast('הייצוא נכשל. נסה שוב');
    }
  };

  // Export PDF with Side Topics Breakdown & Clickable Hyperlinks
  const handleExportPdf = async (treeToExport?: LearningTree) => {
    const tree = treeToExport || currentTree;
    if (!tree) return;
    showToast(language === 'he' ? 'מייצר מסמך PDF עם פירוט נושאים וקישורים...' : 'Generating PDF with topics & hyperlinks...');
    const success = await exportTreeToPdf(tree, language);
    if (success) {
      showToast(language === 'he' ? 'קובץ ה-PDF יורד בהצלחה!' : 'PDF downloaded successfully!');
    } else {
      showToast(language === 'he' ? 'הייצוא נכשל. נסה שוב' : 'Export failed. Please try again.');
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
    showToast('עץ הלמידה נמחק');
  };

  // Duplicate Tree
  const handleDuplicateTree = (tree: LearningTree) => {
    const duplicated: LearningTree = {
      ...tree,
      id: `tree_dup_${Date.now()}`,
      topic: `${tree.topic} (עותק)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextTrees = [duplicated, ...savedTrees];
    setSavedTrees(nextTrees);
    saveTreesToStorage(nextTrees);
    setActiveTreeId(duplicated.id);
    saveActiveTreeId(duplicated.id);
    showToast('העץ שוכפל בהצלחה');
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
        showToast('קובץ עץ ה-JSON יובא בהצלחה!');
      } else {
        throw new Error('מבנה JSON לא תקין');
      }
    } catch (err: any) {
      alert('שגיאה ביבוא קובץ: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Heebo',sans-serif]">
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
        onExportJson={() => currentTree && exportTreeToJson(currentTree, currentTree.topic)}
        language={language}
        setLanguage={setLanguage}
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
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center mb-4 shadow-sm">
              <GitFork className="w-8 h-8 rotate-90" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{language === 'he' ? 'ברוך הבא ל-CogniTree AI' : 'Welcome to CogniTree AI'}</h2>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {language === 'he' ? 'מערכת חכמה הבונה עצי למידה ויזואליים, מבוססי מקורות מחקריים מאומתים, עם מעקב ירוק/אפור בזמן אמת.' : 'A smart system that builds visual learning trees based on verified sources, with real-time green/gray tracking.'}
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95"
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
    </div>
  );
}
