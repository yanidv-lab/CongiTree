export type ResourceType = 'youtube' | 'course_free' | 'course_paid' | 'book' | 'article' | 'doc';

export interface Resource {
  id: string;
  title: string;
  url?: string;
  searchQuery?: string;
  type: ResourceType;
  description?: string;
  provider?: string; // e.g. "MIT OpenCourseWare", "Coursera", "YouTube - 3Blue1Brown", "O'Reilly Books"
  isVerifiedAcademic?: boolean;
  completed?: boolean;
}

export interface CheckItem {
  id: string;
  text: string;
  completed: boolean;
}

export type NodeLevel = 'foundation' | 'core' | 'advanced' | 'specialization';

export interface TreeNode {
  id: string;
  title: string;
  description: string;
  level: NodeLevel;
  isBaseNode: boolean; // Indicates if this is a prerequisite/foundation node
  items: CheckItem[];
  resources: Resource[];
  childrenIds: string[];
  parentId: string | null;
  completed: boolean; // Computed: true if all items AND resources in this node are completed
  notes?: string;
  expanded?: boolean;
  // Set once a real AI expansion attempt (+ dedup check) confirms no distinct new sub-topics remain.
  expansionExhausted?: boolean;
}

export interface LearningTree {
  id: string;
  topic: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
  tags?: string[];
  category?: 'current' | 'saved' | 'archived';
  notes?: string;
  searchSourcesUsed?: { title: string; uri: string }[];
}

export interface GenerateTreeRequest {
  topic: string;
  language?: string;
  depthLevel?: 'basic' | 'comprehensive' | 'mastery';
  customInstructions?: string;
}

export interface ExpandNodeRequest {
  treeTopic: string;
  nodeId: string;
  nodeTitle: string;
  nodeDescription: string;
  nodeDepth?: number;
  ancestors?: string[];
  existingTreeContext?: string;
  language?: string;
}
