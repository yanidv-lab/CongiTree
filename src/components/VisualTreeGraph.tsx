import React, { useState, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  GitBranchPlus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Award,
  Scissors,
  PlusCircle,
  FolderPlus
} from 'lucide-react';
import { LearningTree, TreeNode } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface VisualTreeGraphProps {
  tree: LearningTree;
  onSelectNode: (node: TreeNode) => void;
  onExpandNode: (node: TreeNode) => void;
  onToggleItem: (nodeId: string, itemId: string) => void;
  onToggleResource: (nodeId: string, resourceId: string) => void;
  onPruneNode?: (nodeId: string) => void;
  onPromoteNodeToTree?: (node: TreeNode) => void;
  onOpenCustomBranchModal?: (node: TreeNode) => void;
  isLoadingExpand?: boolean;
  expandingNodeId?: string | null;
  language?: 'he' | 'en';
}

interface PositionedNode {
  node: TreeNode;
  x: number; // Percentage or Pixel X
  y: number; // Pixel Y
  depth: number;
  branchIndex?: number;
}

const BRANCH_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f43f5e', // rose-500
  '#14b8a6', // teal-500
];

const BRANCH_BG_CLASSES = [
  'bg-blue-50/70 border-blue-200 hover:border-blue-300',
  'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300',
  'bg-amber-50/70 border-amber-200 hover:border-amber-300',
  'bg-violet-50/70 border-violet-200 hover:border-violet-300',
  'bg-pink-50/70 border-pink-200 hover:border-pink-300',
  'bg-cyan-50/70 border-cyan-200 hover:border-cyan-300',
  'bg-rose-50/70 border-rose-200 hover:border-rose-300',
  'bg-teal-50/70 border-teal-200 hover:border-teal-300',
];

const getBranchHex = (idx?: number) => {
  if (idx === undefined) return '#94a3b8'; // slate-400
  return BRANCH_COLORS[idx % BRANCH_COLORS.length];
};

const getBranchClass = (idx?: number) => {
  if (idx === undefined) return 'bg-slate-50/70 border-slate-200 hover:border-slate-300';
  return BRANCH_BG_CLASSES[idx % BRANCH_BG_CLASSES.length];
};

// Single source of truth for card width: used both by the layout algorithm (column spacing)
// and by the actual rendered card (inline style + centering translate), so columns are spaced
// based on the card's real footprint instead of a mismatched estimate.
const CARD_WIDTH = 320;
// Fallback connector height used only until a card's real height has been measured (first paint).
const DEFAULT_CARD_HEIGHT = 190;
// Small visual gap so the connector line doesn't touch the card border pixel-for-pixel.
const CONNECTOR_GAP = 6;

export const VisualTreeGraph: React.FC<VisualTreeGraphProps> = ({
  tree,
  onSelectNode,
  onExpandNode,
  onToggleItem,
  onToggleResource,
  onPruneNode,
  onPromoteNodeToTree,
  onOpenCustomBranchModal,
  isLoadingExpand = false,
  expandingNodeId = null,
  language = 'he',
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [confirmAction, setConfirmAction] = useState<{ type: 'promote' | 'prune'; node: TreeNode } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Compute Tree Layout (Levels & X/Y coordinates)
  const positionedNodes = useMemo(() => {
    const nodes = tree.nodes;
    const rootId = tree.rootNodeId;
    if (!rootId || !nodes[rootId]) return [];

    const Y_SPACING = 300; // Increased vertical gap for more tree-like look
    const NODE_WIDTH = CARD_WIDTH; // Match the actually rendered card width for precise column spacing
    const X_GAP = 80; // Horizontal gap

    // Step 1: Build a hierarchical structure to compute subtree widths
    interface LayoutNode {
      id: string;
      depth: number;
      width: number;
      branchIndex?: number;
      children: LayoutNode[];
    }

    // To prevent infinite loops in case of cycles, keep track of visited
    const visitedBuild = new Set<string>();

    function buildLayoutTree(id: string, depth: number, branchIndex?: number): LayoutNode | null {
      if (visitedBuild.has(id)) return null;
      visitedBuild.add(id);

      const node = nodes[id];
      if (!node) return null;

      const layoutChildren: LayoutNode[] = [];
      if (node.childrenIds) {
        let childIdx = 0;
        for (const childId of node.childrenIds) {
          // If we're at depth 0 (root), assign each child a unique branchIndex
          const nextBranchIdx = depth === 0 ? childIdx : branchIndex;
          const childLayout = buildLayoutTree(childId, depth + 1, nextBranchIdx);
          if (childLayout) {
            layoutChildren.push(childLayout);
            if (depth === 0) childIdx++;
          }
        }
      }

      let childrenTotalWidth = 0;
      if (layoutChildren.length > 0) {
        childrenTotalWidth = layoutChildren.reduce((sum, c) => sum + c.width, 0) + (layoutChildren.length - 1) * X_GAP;
      }

      const width = Math.max(NODE_WIDTH, childrenTotalWidth);

      return {
        id,
        depth,
        width,
        branchIndex,
        children: layoutChildren
      };
    }

    const layoutRoot = buildLayoutTree(rootId, 0);
    if (!layoutRoot) return [];

    const result: PositionedNode[] = [];
    
    // Step 2: Assign X coordinates (root is centered at 0)
    function assignCoords(layout: LayoutNode, xCenter: number) {
      result.push({
        node: nodes[layout.id],
        x: xCenter,
        y: layout.depth * Y_SPACING + 60,
        depth: layout.depth,
        branchIndex: layout.branchIndex
      });

      if (layout.children.length > 0) {
        const totalChildrenWidth = layout.children.reduce((sum, c) => sum + c.width, 0) + (layout.children.length - 1) * X_GAP;
        let startX = xCenter - totalChildrenWidth / 2;

        for (const child of layout.children) {
          const childCenter = startX + child.width / 2;
          assignCoords(child, childCenter);
          startX += child.width + X_GAP;
        }
      }
    }

    assignCoords(layoutRoot, 0);

    // Collect any orphan nodes that aren't attached to the root tree
    // (though in a valid tree they shouldn't exist, we add them to the right)
    const assignedIds = new Set(result.map(r => r.node.id));
    let orphanX = layoutRoot.width / 2 + X_GAP;
    Object.keys(nodes).forEach(id => {
      if (!assignedIds.has(id) && nodes[id]) {
        result.push({
          node: nodes[id],
          x: orphanX + NODE_WIDTH / 2,
          y: 60,
          depth: 0,
        });
        orphanX += NODE_WIDTH + X_GAP;
      }
    });

    return result;
  }, [tree]);

  // Measure each card's real rendered height, so connector lines can start/end exactly at each
  // card's actual bottom/top edge instead of a fixed guess (cards vary in height depending on
  // badges, description length, and how many checklist/resource items they have).
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [cardHeights, setCardHeights] = useState<Map<string, number>>(new Map());

  const setCardRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(nodeId, el);
    } else {
      cardRefs.current.delete(nodeId);
    }
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      setCardHeights(prev => {
        let changed = false;
        const next = new Map(prev);
        cardRefs.current.forEach((el, id) => {
          const h = el.offsetHeight;
          if (h > 0 && next.get(id) !== h) {
            next.set(id, h);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    cardRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [positionedNodes]);

  const touchStartRef = useRef<{ distance: number; panX: number; panY: number; zoom: number; touches: {x: number; y: number}[] } | null>(null);

  // Function to fit tree into view container bounds
  const fitTree = React.useCallback(() => {
    if (positionedNodes.length === 0 || !containerRef.current) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    positionedNodes.forEach(pn => {
      if (pn.x < minX) minX = pn.x;
      if (pn.x > maxX) maxX = pn.x;
      if (pn.y < minY) minY = pn.y;
      if (pn.y > maxY) maxY = pn.y;
    });

    // Node dimensions padding
    minX -= 240;
    maxX += 240;
    minY -= 80;
    maxY += 300;

    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) return;

    const scaleX = containerWidth / treeWidth;
    const scaleY = containerHeight / treeHeight;
    let newZoom = Math.min(scaleX, scaleY, 1.1);

    const clampedZoom = Math.max(Math.min(newZoom, 2.5), 0.12);
    setZoom(clampedZoom);

    // Center it
    const centerX = (minX + maxX) / 2;
    setPan({
      x: -centerX * clampedZoom,
      y: 20 * clampedZoom,
    });
  }, [positionedNodes]);

  // Auto-fit bounds on mount and when tree structure updates
  React.useEffect(() => {
    fitTree();
    
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      fitTree();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [positionedNodes.length, fitTree]);

  // Handle Drag / Pan Canvas with Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle Touch Gestures (Single finger Pan, Two finger Pinch Zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = {
        distance: dist,
        panX: pan.x,
        panY: pan.y,
        zoom,
        touches: [
          { x: e.touches[0].clientX, y: e.touches[0].clientY },
          { x: e.touches[1].clientX, y: e.touches[1].clientY },
        ]
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchStartRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartRef.current.distance;
      const newZoom = Math.min(Math.max(touchStartRef.current.zoom * factor, 0.12), 3.0);
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartRef.current = null;
  };

  // Wheel Zoom support
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || true) {
      // Allow mouse wheel zoom over canvas
      const zoomDelta = e.deltaY < 0 ? 1.12 : 0.88;
      setZoom(prev => Math.min(Math.max(prev * zoomDelta, 0.12), 3.0));
    }
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Node Map for fast ID lookup
  const nodePosMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    positionedNodes.forEach(pn => map.set(pn.node.id, pn));
    return map;
  }, [positionedNodes]);

  return (
    <div 
      ref={containerRef}
      id="visual_tree_graph_canvas"
      className="relative w-full h-[calc(100vh-110px)] min-h-[500px] bg-slate-100 overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Visual Canvas Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)`,
          backgroundSize: `${Math.max(15, 30 * zoom)}px ${Math.max(15, 30 * zoom)}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Floating Canvas Controls Overlay */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1 bg-white/95 border border-slate-200 p-1 rounded-xl shadow-md text-slate-700 backdrop-blur-md">
        <button
          onClick={() => setZoom(prev => Math.min(prev * 1.2, 3.0))}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          title={language === 'he' ? "הגדל" : "Zoom In"}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.12))}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          title={language === 'he' ? "הקטן" : "Zoom Out"}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-0.5" />
        <button
          onClick={fitTree}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 transition-colors text-xs font-semibold flex items-center gap-1"
          title={language === 'he' ? "התאם את העץ למסך" : "Fit tree to screen"}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{language === 'he' ? 'התאם למסך' : 'Fit'}</span>
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors text-xs font-semibold flex items-center gap-1"
          title={language === 'he' ? "אפס תצוגה ל-100%" : "Reset Zoom 100%"}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{language === 'he' ? '100%' : '100%'}</span>
        </button>
        <div className="px-1.5 sm:px-2 text-[11px] text-indigo-600 font-mono font-bold">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Legend Badge */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs backdrop-blur-md shadow-md text-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
          <span className="text-slate-800 font-medium">ענף הושלם (ירוק)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-400" />
          <span className="text-slate-500">ענף בתהליך</span>
        </div>
      </div>

      {/* Main Interactive Map Stage */}
      <div
        className="w-full h-full relative transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '50% 10%',
        }}
      >
        {/* SVG Connecting Paths Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {positionedNodes.map(pn => {
            if (!pn.node.parentId) return null;
            const parentPn = nodePosMap.get(pn.node.parentId);
            if (!parentPn) return null;

            // Compute connection line coordinates using each card's real measured height,
            // so the line meets the parent's actual bottom edge and the child's actual top edge.
            const parentHeight = cardHeights.get(parentPn.node.id) ?? DEFAULT_CARD_HEIGHT;
            const startX = parentPn.x;
            const startY = parentPn.y + parentHeight + CONNECTOR_GAP;
            const endX = pn.x;
            const endY = pn.y - CONNECTOR_GAP;

            // Curve calculation (vertical S-curve)
            const controlY1 = startY + (endY - startY) * 0.4;
            const controlY2 = endY - (endY - startY) * 0.6;
            const pathD = `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;

            // Color coding line: Green if both parent and child completed, else based on branchIndex
            const isLineGreen = parentPn.node.completed && pn.node.completed;
            const strokeColor = isLineGreen ? '#10b981' : getBranchHex(pn.branchIndex);
            
            // Thickness based on depth - deeper branches are thinner
            const lineThickness = Math.max(1.5, 5 - pn.depth);

            return (
              <g key={`path_${parentPn.node.id}_${pn.node.id}`}>
                {/* Background thicker stroke for a slight shadow/outline effect on branches */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={lineThickness + 4}
                  className="opacity-50"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isLineGreen ? lineThickness + 1.5 : lineThickness}
                  strokeDasharray="none"
                  strokeLinecap="round"
                  className="transition-all duration-500 opacity-90"
                />
                {/* Connecting Arrow/Dot */}
                <circle
                  cx={endX}
                  cy={endY}
                  r={isLineGreen ? lineThickness + 1 : lineThickness}
                  fill={strokeColor}
                  className="opacity-100"
                />
              </g>
            );
          })}
        </svg>

        {/* Render Positioned Node Cards */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          {positionedNodes.map(pn => {
            const node = pn.node;
            const isCompleted = node.completed;
            const isExpanding = isLoadingExpand && expandingNodeId === node.id;

            // Count checkmarks
            const completedItemsCount = node.items.filter(i => i.completed).length;
            const completedResCount = node.resources.filter(r => r.completed).length;
            const totalCheckables = node.items.length + node.resources.length;
            const completedCheckables = completedItemsCount + completedResCount;

            return (
              <div
                key={node.id}
                ref={(el) => setCardRef(node.id, el)}
                style={{
                  transform: `translate(${pn.x - CARD_WIDTH / 2}px, ${pn.y}px)`,
                  width: `${CARD_WIDTH}px`,
                }}
                className={`absolute transition-all duration-300 rounded-2xl border p-5 shadow-sm cursor-pointer group ${
                  isCompleted
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-50 hover:border-emerald-500'
                    : `${getBranchClass(pn.branchIndex)} text-slate-800 hover:shadow-md`
                }`}
                onClick={() => onSelectNode(node)}
              >
                {/* Top Row: level (dot + label) and base-node marker on one side, completion state on the other */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      node.level === 'foundation' ? 'bg-sky-500' :
                      node.level === 'core' ? 'bg-indigo-500' :
                      node.level === 'advanced' ? 'bg-purple-500' :
                      'bg-teal-500'
                    }`} />
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                      {node.level === 'foundation' ? (language === 'he' ? 'יסודות' : 'Foundation') :
                       node.level === 'core' ? (language === 'he' ? 'ליבה' : 'Core') :
                       node.level === 'advanced' ? (language === 'he' ? 'מתקדם' : 'Advanced') : (language === 'he' ? 'התמחות' : 'Specialization')}
                    </span>
                    {node.isBaseNode && (
                      <Award className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-label={language === 'he' ? 'נושא מרכזי' : 'Core Topic'}>
                        <title>{language === 'he' ? 'נושא מרכזי' : 'Core Topic'}</title>
                      </Award>
                    )}
                    {node.expansionExhausted && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0" title={language === 'he' ? 'לא נמצאו תתי-נושאים חדשים שאינם חופפים לקיימים' : 'No new non-overlapping sub-topics were found'}>
                        {language === 'he' ? 'סוף נושא' : 'End'}
                      </span>
                    )}
                  </div>

                  {/* Complete Indicator */}
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 fill-white stroke-emerald-500" />
                        <span>{language === 'he' ? 'הושלם' : 'Done'}</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5 text-slate-400" />
                        <span>({completedCheckables}/{totalCheckables})</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Node Title & Description */}
                <h3 className={`text-base font-bold leading-snug mb-1 group-hover:text-indigo-600 transition-colors ${
                  isCompleted ? 'text-emerald-900' : 'text-slate-900'
                }`}>
                  {node.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                  {node.description}
                </p>

                {/* Progress Bar Inside Card */}
                {totalCheckables > 0 && (
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden border border-slate-200">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.round((completedCheckables / totalCheckables) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    {/* Promote quick action */}
                    {onPromoteNodeToTree && node.id !== tree.rootNodeId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({ type: 'promote', node });
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title={language === 'he' ? "הפוך לפרויקט עצמאי במאגר" : "Make independent subject tree"}
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Prune quick action */}
                    {onPruneNode && node.id !== tree.rootNodeId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({ type: 'prune', node });
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={language === 'he' ? "גדע ענף זה מהעץ" : "Cut / Prune branch"}
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Custom sub-branch quick action */}
                    {onOpenCustomBranchModal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCustomBranchModal(node);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title={language === 'he' ? "הוסף ענף מותאם אישית תחת נושא זה" : "Add custom branch"}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="text-[11px] text-slate-500 group-hover:text-indigo-600 font-medium">
                      {language === 'he' ? 'פרטים ←' : 'Details →'}
                    </span>
                  </div>

                  {/* Expand Sub-Branches Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpandNode(node);
                    }}
                    disabled={isExpanding || node.expansionExhausted}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    title={
                      node.expansionExhausted
                        ? (language === 'he' ? 'לא נמצאו עוד תתי-נושאים ייחודיים להרחבה' : 'No more distinct sub-topics to expand')
                        : (language === 'he' ? "הרחב נושא זה בענפים נוספים עם AI" : "Expand this topic with AI")
                    }
                  >
                    <GitBranchPlus className="w-3.5 h-3.5" />
                    <span>
                      {isExpanding && expandingNodeId === node.id
                        ? (language === 'he' ? 'מרחיב...' : 'Expanding...')
                        : node.expansionExhausted
                        ? (language === 'he' ? 'סוף נושא' : 'End of Topic')
                        : (language === 'he' ? '+ הרחב ענף' : '+ Expand')}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={!!confirmAction}
          title={
            confirmAction.type === 'promote'
              ? (language === 'he' ? 'הפיכת ענף לפרויקט עצמאי' : 'Promote Branch to Independent Tree')
              : (language === 'he' ? 'גדיעת ענף מהעץ' : 'Prune Branch from Tree')
          }
          message={
            confirmAction.type === 'promote'
              ? (language === 'he' 
                  ? `האם להפוך את הענף "${confirmAction.node.title}" וכל תתי-הענפים שתחתיו לעץ למידה עצמאי ונפרד במאגר?`
                  : `Promote branch "${confirmAction.node.title}" and its sub-branches into an independent learning tree?`)
              : (language === 'he'
                  ? `האם להסיר ולגדע את הענף "${confirmAction.node.title}" וכל תתי-הענפים שלו מעץ הלמידה הנוכחי?`
                  : `Remove and prune branch "${confirmAction.node.title}" and its sub-branches from the current learning tree?`)
          }
          confirmLabel={
            confirmAction.type === 'promote'
              ? (language === 'he' ? 'הפוך לפרויקט עצמאי' : 'Make Independent Tree')
              : (language === 'he' ? 'גדע ענף' : 'Prune Branch')
          }
          variant={confirmAction.type === 'promote' ? 'indigo' : 'danger'}
          iconType={confirmAction.type === 'promote' ? 'promote' : 'prune'}
          onConfirm={() => {
            if (confirmAction.type === 'promote' && onPromoteNodeToTree) {
              onPromoteNodeToTree(confirmAction.node);
            } else if (confirmAction.type === 'prune' && onPruneNode) {
              onPruneNode(confirmAction.node.id);
            }
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
          language={language}
        />
      )}
    </div>
  );
};
