import { LearningTree, TreeNode } from '../types';
import { SAMPLE_TREES } from '../data/sampleTrees';

const STORAGE_KEY_TREES = 'learningtree_ai_saved_trees';
const STORAGE_KEY_ACTIVE_ID = 'learningtree_ai_active_tree_id';

// Helper to compute node completion status
export function computeNodeCompletion(node: TreeNode): boolean {
  const itemsDone = node.items.length === 0 || node.items.every(i => i.completed);
  const resourcesDone = node.resources.length === 0 || node.resources.every(r => r.completed);
  return itemsDone && resourcesDone && (node.items.length > 0 || node.resources.length > 0);
}

// Recalculate tree nodes completion flags
export function updateTreeCompletionStatus(tree: LearningTree): LearningTree {
  const updatedNodes: Record<string, TreeNode> = {};

  Object.entries(tree.nodes).forEach(([id, node]) => {
    const isCompleted = computeNodeCompletion(node);
    updatedNodes[id] = {
      ...node,
      completed: isCompleted,
    };
  });

  return {
    ...tree,
    updatedAt: new Date().toISOString(),
    nodes: updatedNodes,
  };
}

// Calculate overall progress percentage
export function calculateTreeProgress(tree: LearningTree): {
  totalNodes: number;
  completedNodes: number;
  totalItems: number;
  completedItems: number;
  percentage: number;
} {
  const nodesList = Object.values(tree.nodes);
  const totalNodes = nodesList.length;
  const completedNodes = nodesList.filter(n => n.completed).length;

  let totalItems = 0;
  let completedItems = 0;

  nodesList.forEach(node => {
    totalItems += node.items.length + node.resources.length;
    completedItems += node.items.filter(i => i.completed).length + node.resources.filter(r => r.completed).length;
  });

  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : (totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0);

  return {
    totalNodes,
    completedNodes,
    totalItems,
    completedItems,
    percentage,
  };
}

export function loadSavedTrees(): LearningTree[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TREES);
    if (raw) {
      const parsed: LearningTree[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(t => updateTreeCompletionStatus(t));
      }
    }
  } catch (err) {
    console.error('Error loading saved trees from localStorage:', err);
  }
  return [];
}

export function saveTreesToStorage(trees: LearningTree[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TREES, JSON.stringify(trees));
  } catch (err) {
    console.error('Error saving trees to localStorage:', err);
  }
}

export function loadActiveTreeId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    return null;
  }
}

export function saveActiveTreeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  } catch (err) {
    console.error('Error saving active tree id:', err);
  }
}

// Prune node and all its descendants recursively
export function getNodeDepth(tree: LearningTree, nodeId: string): number {
  if (!tree.nodes[nodeId]) return 0;
  let depth = 0;
  let currId: string | null = nodeId;
  const visited = new Set<string>();

  while (currId && tree.nodes[currId] && !visited.has(currId)) {
    visited.add(currId);
    const parentId = tree.nodes[currId].parentId;
    if (!parentId) break;
    depth++;
    currId = parentId;
  }
  return depth;
}

export const MAX_NODE_EXPANSION_DEPTH = 3;

// Get full list of ancestor nodes for a node
export function getNodeAncestors(tree: LearningTree, nodeId: string): TreeNode[] {
  const ancestors: TreeNode[] = [];
  if (!tree.nodes[nodeId]) return ancestors;

  let currId: string | null = tree.nodes[nodeId].parentId;
  const visited = new Set<string>();

  while (currId && tree.nodes[currId] && !visited.has(currId)) {
    visited.add(currId);
    ancestors.push(tree.nodes[currId]);
    currId = tree.nodes[currId].parentId;
  }
  return ancestors;
}

// Normalize titles for comparison
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\u0590-\u05FF]/g, ' ') // keep alphanumeric and Hebrew chars
    .replace(/\s+/g, ' ');
}

// Extract clean core word tokens (stripping stop words & generic academic filler words)
export function getCoreTitleWords(title: string): string[] {
  const normalized = normalizeTitle(title);
  const stopAndFillerWords = new Set([
    // Hebrew stop & filler words
    'של', 'את', 'עם', 'על', 'ב', 'ל', 'מ', 'ה', 'זה', 'כי', 'גם',
    'מבוא', 'יסודות', 'עקרונות', 'למידת', 'מדריך', 'שיטות', 'מערך', 'נושא', 
    'תת', 'שלב', 'חלק', 'בסיס', 'מתקדם', 'ליבה', 'בסיסי', 'כללי', 'סקירה',
    'הבנת', 'תרגול', 'יישום', 'פיתוח', 'שימוש', 'ניתוח', 'לימוד', 'כלים',
    // English stop & filler words
    'the', 'a', 'an', 'in', 'of', 'for', 'and', 'or', 'to', 'with', 'on', 'at', 'by',
    'introduction', 'intro', 'basics', 'basic', 'fundamentals', 'fundamental', 
    'overview', 'guide', 'methods', 'advanced', 'core', 'part', 'section', 'topic', 
    'subtopic', 'learning', 'study', 'understanding', 'practice', 'application', 'analysis'
  ]);

  return normalized.split(' ').filter(w => w.length > 1 && !stopAndFillerWords.has(w));
}

// Check if two titles are exact or near-identical duplicates
export function areTitlesDuplicateOrSimilar(titleA: string, titleB: string): boolean {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Direct substring check if one is inside the other
  if (normA.length > 5 && normB.length > 5) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }

  // Compare core significant word tokens
  const coreA = getCoreTitleWords(titleA);
  const coreB = getCoreTitleWords(titleB);

  if (coreA.length === 0 || coreB.length === 0) {
    // If stripping filler words emptied both, fallback to direct word check
    const rawWordsA = normA.split(' ').filter(w => w.length > 1);
    const rawWordsB = normB.split(' ').filter(w => w.length > 1);
    if (rawWordsA.length > 0 && rawWordsB.length > 0) {
      const commonRaw = rawWordsA.filter(w => rawWordsB.includes(w));
      return commonRaw.length === rawWordsA.length || commonRaw.length === rawWordsB.length;
    }
    return false;
  }

  // Calculate Jaccard / Overlap ratio of core words
  const commonCore = coreA.filter(w => coreB.includes(w));
  const minCoreLen = Math.min(coreA.length, coreB.length);

  // If all core words of the smaller title are present in the larger title, it's duplicate/sub-concept
  if (commonCore.length === minCoreLen) {
    return true;
  }

  // If >50% of core words overlap
  const overlapRatio = commonCore.length / Math.max(coreA.length, coreB.length);
  if (overlapRatio >= 0.5) {
    return true;
  }

  return false;
}

export function pruneNodeFromTree(tree: LearningTree, nodeId: string): LearningTree {
  if (nodeId === tree.rootNodeId) {
    // Root node cannot be pruned completely unless deleting whole tree
    return tree;
  }

  const nodes = { ...tree.nodes };
  const nodeToPrune = nodes[nodeId];
  if (!nodeToPrune) return tree;

  // Find all descendant IDs
  const idsToRemove = new Set<string>();
  const collectDescendants = (id: string) => {
    idsToRemove.add(id);
    const curr = nodes[id];
    if (curr && curr.childrenIds) {
      curr.childrenIds.forEach(childId => collectDescendants(childId));
    }
  };
  collectDescendants(nodeId);

  // Remove from parent's childrenIds
  if (nodeToPrune.parentId && nodes[nodeToPrune.parentId]) {
    const parent = nodes[nodeToPrune.parentId];
    nodes[nodeToPrune.parentId] = {
      ...parent,
      childrenIds: parent.childrenIds.filter(cid => cid !== nodeId),
    };
  }

  // Delete collected nodes from nodes record
  idsToRemove.forEach(id => {
    delete nodes[id];
  });

  return updateTreeCompletionStatus({
    ...tree,
    nodes,
    updatedAt: new Date().toISOString(),
  });
}

// Promote a branch node (and its sub-branches) to a brand new independent LearningTree
export function promoteNodeToIndependentTree(tree: LearningTree, nodeId: string, language: 'he' | 'en' = 'he'): LearningTree {
  const nodes = tree.nodes;
  const rootNode = nodes[nodeId];
  if (!rootNode) throw new Error(language === 'he' ? "הענף המבוקש לא נמצא" : "Requested branch not found");

  // Collect all descendant nodes
  const descendantNodesRecord: Record<string, TreeNode> = {};

  const copyBranchRecursive = (currentId: string) => {
    const currNode = nodes[currentId];
    if (!currNode) return;

    descendantNodesRecord[currentId] = {
      ...currNode,
      parentId: currentId === nodeId ? null : currNode.parentId,
      isBaseNode: currentId === nodeId ? true : currNode.isBaseNode,
      childrenIds: currNode.childrenIds ? [...currNode.childrenIds] : [],
      items: (currNode.items || []).map(item => ({ ...item })),
      resources: (currNode.resources || []).map(res => ({ ...res })),
    };

    if (currNode.childrenIds) {
      currNode.childrenIds.forEach(childId => {
        copyBranchRecursive(childId);
      });
    }
  };

  copyBranchRecursive(nodeId);

  const now = new Date().toISOString();
  const newTreeId = `tree_promoted_${Date.now()}`;

  const descText = language === 'he'
    ? `עץ למידה עצמאי שהופרד מתוך "${tree.topic}": ${rootNode.description || ''}`
    : `Standalone learning tree promoted from "${tree.topic}": ${rootNode.description || ''}`;

  const promotedTree: LearningTree = {
    id: newTreeId,
    topic: rootNode.title,
    description: descText,
    createdAt: now,
    updatedAt: now,
    rootNodeId: nodeId,
    nodes: descendantNodesRecord,
    category: 'current',
    searchSourcesUsed: tree.searchSourcesUsed || [],
  };

  return updateTreeCompletionStatus(promotedTree);
}

