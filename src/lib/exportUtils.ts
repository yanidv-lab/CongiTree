import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LearningTree, TreeNode, Resource } from '../types';

export async function exportTreeToImage(
  elementId: string,
  fileName: string = 'learning_map'
): Promise<boolean> {
  const node = document.getElementById(elementId);
  if (!node) {
    console.error('Target node for export not found:', elementId);
    return false;
  }

  try {
    const dataUrl = await toPng(node, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#020617', // slate-950
    });

    const link = document.createElement('a');
    link.download = `${fileName.replace(/\s+/g, '_')}_learning_tree.png`;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (err) {
    console.error('Failed to export tree to image:', err);
    return false;
  }
}

export function exportTreeToJson(tree: any, fileName: string = 'learning_tree') {
  const jsonStr = JSON.stringify(tree, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `${fileName.replace(/\s+/g, '_')}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateVisualTreeSvg(tree: LearningTree, isHe: boolean): string {
  const nodes = tree.nodes || {};
  const rootId = tree.rootNodeId;
  if (!rootId || !nodes[rootId]) return '';

  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 75;
  const X_GAP = 28;
  const Y_SPACING = 140;

  interface SvgLayoutNode {
    id: string;
    depth: number;
    width: number;
    children: SvgLayoutNode[];
  }

  const visited = new Set<string>();
  function buildSvgLayout(id: string, depth: number): SvgLayoutNode | null {
    if (visited.has(id)) return null;
    visited.add(id);

    const node = nodes[id];
    if (!node) return null;

    const children: SvgLayoutNode[] = [];
    if (node.childrenIds) {
      for (const childId of node.childrenIds) {
        const childLayout = buildSvgLayout(childId, depth + 1);
        if (childLayout) children.push(childLayout);
      }
    }

    let childrenTotalWidth = 0;
    if (children.length > 0) {
      childrenTotalWidth = children.reduce((s, c) => s + c.width, 0) + (children.length - 1) * X_GAP;
    }

    const width = Math.max(NODE_WIDTH, childrenTotalWidth);
    return { id, depth, width, children };
  }

  const layoutRoot = buildSvgLayout(rootId, 0);
  if (!layoutRoot) return '';

  interface PositionedSvgNode {
    node: TreeNode;
    x: number;
    y: number;
    depth: number;
    parentId?: string;
  }

  const positioned: PositionedSvgNode[] = [];

  function assignPositions(layout: SvgLayoutNode, xCenter: number, parentId?: string) {
    const yCenter = layout.depth * Y_SPACING + 50;
    positioned.push({
      node: nodes[layout.id],
      x: xCenter,
      y: yCenter,
      depth: layout.depth,
      parentId
    });

    if (layout.children.length > 0) {
      const totalChildrenWidth = layout.children.reduce((sum, c) => sum + c.width, 0) + (layout.children.length - 1) * X_GAP;
      let startX = xCenter - totalChildrenWidth / 2;

      for (const child of layout.children) {
        const childCenter = startX + child.width / 2;
        assignPositions(child, childCenter, layout.id);
        startX += child.width + X_GAP;
      }
    }
  }

  assignPositions(layoutRoot, 450);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  positioned.forEach(p => {
    if (p.x - NODE_WIDTH / 2 < minX) minX = p.x - NODE_WIDTH / 2;
    if (p.x + NODE_WIDTH / 2 > maxX) maxX = p.x + NODE_WIDTH / 2;
    if (p.y - NODE_HEIGHT / 2 < minY) minY = p.y - NODE_HEIGHT / 2;
    if (p.y + NODE_HEIGHT / 2 > maxY) maxY = p.y + NODE_HEIGHT / 2;
  });

  const padding = 30;
  const totalWidth = Math.max(880, Math.ceil(maxX - minX + padding * 2));
  const totalHeight = Math.ceil(maxY - minY + padding * 2);

  const offsetX = padding - minX;
  const offsetY = padding - minY;

  const posMap = new Map<string, { x: number; y: number }>();
  positioned.forEach(p => {
    posMap.set(p.node.id, { x: p.x + offsetX, y: p.y + offsetY });
  });

  let connectorPaths = '';
  positioned.forEach(p => {
    if (p.parentId) {
      const parentPos = posMap.get(p.parentId);
      const childPos = posMap.get(p.node.id);
      if (parentPos && childPos) {
        const pX = parentPos.x;
        const pY = parentPos.y + NODE_HEIGHT / 2;
        const cX = childPos.x;
        const cY = childPos.y - NODE_HEIGHT / 2;
        const midY = (pY + cY) / 2;

        connectorPaths += `<path d="M ${pX} ${pY} C ${pX} ${midY}, ${cX} ${midY}, ${cX} ${cY}" stroke="#6366f1" stroke-width="2.5" fill="none" stroke-linecap="round" />`;
      }
    }
  });

  const levelColors: Record<string, { bg: string; border: string; text: string }> = {
    foundation: { bg: '#f0f9ff', border: '#0284c7', text: '#0369a1' },
    core: { bg: '#e0e7ff', border: '#4f46e5', text: '#3730a3' },
    advanced: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
    specialization: { bg: '#faf5ff', border: '#9333ea', text: '#6b21a8' },
  };

  let nodeCardsSvg = '';
  positioned.forEach(p => {
    const pos = posMap.get(p.node.id);
    if (!pos) return;

    const node = p.node;
    const colors = levelColors[node.level] || levelColors['core'];
    const x = pos.x - NODE_WIDTH / 2;
    const y = pos.y - NODE_HEIGHT / 2;

    const totalItems = (node.items || []).length;
    const doneItems = (node.items || []).filter(i => i.completed).length;
    const nodePct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    let statusColor = '#94a3b8';
    let statusLabel = isHe ? '⚪ טרם התחיל' : '⚪ Not Started';
    if (nodePct === 100) {
      statusColor = '#059669';
      statusLabel = isHe ? '🟢 הושלם' : '🟢 Completed';
    } else if (nodePct > 0) {
      statusColor = '#d97706';
      statusLabel = isHe ? '🟡 בלמידה' : '🟡 In Progress';
    }

    const titleText = escapeSvgText(node.title.length > 28 ? node.title.slice(0, 26) + '...' : node.title);

    nodeCardsSvg += `
      <g transform="translate(${x}, ${y})">
        <rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2" />
        
        <rect x="10" y="8" width="85" height="18" rx="9" fill="#ffffff" stroke="${statusColor}" stroke-width="1" />
        <text x="52" y="21" font-size="9" font-weight="700" fill="${statusColor}" text-anchor="middle" font-family="system-ui, sans-serif">
          ${statusLabel}
        </text>

        <text x="${NODE_WIDTH - 10}" y="21" font-size="9" font-weight="600" fill="#64748b" text-anchor="end" font-family="system-ui, sans-serif">
          ${doneItems}/${totalItems} ${isHe ? 'משימות' : 'tasks'}
        </text>

        <text x="${isHe ? NODE_WIDTH - 12 : 12}" y="48" font-size="12" font-weight="800" fill="#0f172a" text-anchor="${isHe ? 'end' : 'start'}" font-family="system-ui, sans-serif">
          ${titleText}
        </text>

        <rect x="10" y="${NODE_HEIGHT - 8}" width="${NODE_WIDTH - 20}" height="4" rx="2" fill="#e2e8f0" />
        <rect x="10" y="${NODE_HEIGHT - 8}" width="${Math.round(((NODE_WIDTH - 20) * nodePct) / 100)}" height="4" rx="2" fill="${nodePct === 100 ? '#10b981' : nodePct > 0 ? '#f59e0b' : '#cbd5e1'}" />
      </g>
    `;
  });

  return `
    <svg width="100%" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color: #ffffff; border-radius: 12px;">
      <g>
        ${connectorPaths}
        ${nodeCardsSvg}
      </g>
    </svg>
  `;
}

export async function exportTreeToPdf(
  tree: LearningTree,
  language: 'he' | 'en' = 'he'
): Promise<boolean> {
  const isHe = language === 'he';
  const nodesList: TreeNode[] = Object.values(tree.nodes || {});
  
  // Try capturing live interactive graph snapshot if element is visible in DOM
  let liveGraphDataUrl: string | null = null;
  const liveGraphCanvas = document.getElementById('visual_tree_graph_canvas');
  if (liveGraphCanvas) {
    try {
      liveGraphDataUrl = await toPng(liveGraphCanvas, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
      });
    } catch (err) {
      console.warn('Live graph canvas snapshot skipped:', err);
    }
  }

  const svgTreeHtml = generateVisualTreeSvg(tree, isHe);

  // Collect all resources across nodes
  const allResources: { resource: Resource; nodeTitle: string }[] = [];
  let totalCheckItems = 0;
  let completedCheckItems = 0;

  nodesList.forEach((n) => {
    (n.items || []).forEach((item) => {
      totalCheckItems++;
      if (item.completed) completedCheckItems++;
    });
    (n.resources || []).forEach((res) => {
      if (res.url) {
        allResources.push({ resource: res, nodeTitle: n.title });
      }
    });
  });

  const progressPct = totalCheckItems > 0 ? Math.round((completedCheckItems / totalCheckItems) * 100) : 0;
  const exportDate = new Date().toLocaleDateString(isHe ? 'he-IL' : 'en-US');

  // Build PDF HTML template
  const htmlContent = `
    <div style="direction: ${isHe ? 'rtl' : 'ltr'}; font-family: system-ui, sans-serif;">
      <!-- Document Header -->
      <div style="border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #1e1b4b;">
              ${tree.topic}
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">
              ${isHe ? 'מסמך תוכנית למידה מפורט, מפת עץ ויזואלית ומקורות עיון מומלצים' : 'Detailed Learning Map, Visual Tree Diagram & Recommended Resources'}
            </p>
          </div>
          <div style="text-align: ${isHe ? 'left' : 'right'}; font-size: 12px; color: #64748b;">
            <div style="font-weight: 700; color: #4f46e5;">CogniTree AI</div>
            <div>${isHe ? 'תאריך יצוא:' : 'Exported:'} ${exportDate}</div>
          </div>
        </div>

        <!-- Summary Stats Banner -->
        <div style="display: flex; gap: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-top: 16px;">
          <div style="flex: 1; text-align: center; border-${isHe ? 'left' : 'right'}: 1px solid #cbd5e1;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">${isHe ? 'התקדמות כללית' : 'Progress'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #059669;">${progressPct}%</div>
          </div>
          <div style="flex: 1; text-align: center; border-${isHe ? 'left' : 'right'}: 1px solid #cbd5e1;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">${isHe ? 'סה"כ נושאים' : 'Total Topics'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #4f46e5;">${nodesList.length}</div>
          </div>
          <div style="flex: 1; text-align: center; border-${isHe ? 'left' : 'right'}: 1px solid #cbd5e1;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">${isHe ? 'משימות שהושלמו' : 'Completed Tasks'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #0284c7;">${completedCheckItems} / ${totalCheckItems}</div>
          </div>
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">${isHe ? 'קישורים ומקורות' : 'Resource Links'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #d97706;">${allResources.length}</div>
          </div>
        </div>
      </div>

      <!-- Section 1: Graphical Visual Tree Map (Diagram & Canvas Image) -->
      <div style="margin-bottom: 32px; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; page-break-inside: avoid;">
        <h2 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0 0 6px 0; display: flex; align-items: center; gap: 8px;">
          <span>🌳</span>
          <span>${isHe ? 'מפת העץ הגרפית - תרשים ויזואלי של מסלול הלמידה' : 'Graphical Visual Tree Map'}</span>
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b;">
          ${isHe ? 'מציג את מבנה העץ הוויזואלי, הענפים והחיבורים בין הנושאים' : 'Displays the visual tree structure, branches, depth levels, and topic connectors'}
        </p>

        ${liveGraphDataUrl ? `
          <div style="margin-bottom: 20px; border: 1.5px solid #6366f1; border-radius: 12px; overflow: hidden; background-color: #f8fafc; padding: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #4338ca; margin-bottom: 8px;">
              ${isHe ? '📷 תצוגת הקנבס הוויזואלית (Visual Canvas Snapshot):' : '📷 Visual Canvas Snapshot:'}
            </div>
            <img src="${liveGraphDataUrl}" style="width: 100%; max-height: 480px; object-fit: contain; border-radius: 8px;" />
          </div>
        ` : ''}

        ${svgTreeHtml ? `
          <div style="border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; background-color: #ffffff; overflow-x: auto;">
            <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 12px;">
              ${isHe ? '🗺️ תרשים וקטורי מפורט של ענפי העץ והקשרים:' : '🗺️ Vector Visual Map of Tree Branches:'}
            </div>
            ${svgTreeHtml}
          </div>
        ` : ''}
      </div>

      <!-- Main Breakdown: Topics & Side Resources -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          ${isHe ? 'פירוט נושאי הלימוד ומקורות העיון' : 'Topics Breakdown & Side Resources'}
        </h2>

        ${nodesList.map((node, index) => {
          const levelLabels: Record<string, string> = {
            foundation: isHe ? 'יסודות' : 'Foundation',
            core: isHe ? 'ליבה' : 'Core',
            advanced: isHe ? 'מתקדם' : 'Advanced',
            specialization: isHe ? 'התמחות' : 'Specialization'
          };
          const levelBg: Record<string, string> = {
            foundation: '#e0f2fe',
            core: '#e0e7ff',
            advanced: '#fef3c7',
            specialization: '#f3e8ff'
          };
          const levelColor: Record<string, string> = {
            foundation: '#0369a1',
            core: '#4338ca',
            advanced: '#b45309',
            specialization: '#6b21a8'
          };

          return `
            <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 12px; background-color: #ffffff; overflow: hidden; page-break-inside: avoid;">
              <!-- Node Header Bar -->
              <div style="background-color: #f1f5f9; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: 800; font-size: 14px; color: #475569;">#${index + 1}</span>
                  <span style="font-size: 16px; font-weight: 700; color: #0f172a;">${node.title}</span>
                </div>
                <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; background-color: ${levelBg[node.level] || '#f1f5f9'}; color: ${levelColor[node.level] || '#334155'};">
                  ${levelLabels[node.level] || node.level}
                </span>
              </div>

              <!-- Content Grid: Tasks (Left) & Side Links (Right) -->
              <div style="display: flex; flex-direction: row; font-size: 13px;">
                <!-- Left Section: Description & Checklist -->
                <div style="flex: 1.2; padding: 16px; border-${isHe ? 'left' : 'right'}: 1px solid #e2e8f0;">
                  ${node.description ? `<p style="margin: 0 0 12px 0; color: #334155; line-height: 1.5;">${node.description}</p>` : ''}
                  
                  <div style="font-weight: 700; font-size: 12px; color: #475569; margin-bottom: 8px;">
                    ${isHe ? 'משימות ונקודות בדיקה:' : 'Checklist Items:'}
                  </div>
                  <ul style="margin: 0; padding: 0; list-style: none;">
                    ${(node.items || []).map((item) => `
                      <li style="margin-bottom: 6px; display: flex; align-items: center; gap: 8px; color: ${item.completed ? '#059669' : '#334155'};">
                        <span style="font-weight: 800; font-size: 14px;">${item.completed ? '[✓]' : '[ ]'}</span>
                        <span style="${item.completed ? 'text-decoration: line-through; opacity: 0.8;' : ''}">${item.text}</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>

                <!-- Right Section: Side Links & Hyperlinks Panel -->
                <div style="flex: 1; padding: 16px; background-color: #fafafa;">
                  <div style="font-weight: 700; font-size: 12px; color: #4338ca; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🔗</span>
                    <span>${isHe ? 'מקורות עיון וקישורים בצד:' : 'Side Resources & Links:'}</span>
                  </div>

                  ${(!node.resources || node.resources.length === 0) ? `
                    <div style="font-size: 12px; color: #94a3b8; font-style: italic;">
                      ${isHe ? 'אין קישורים רשומים לנושא זה' : 'No resources attached'}
                    </div>
                  ` : `
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                      ${node.resources.map((res) => `
                        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-weight: 700; font-size: 12px; color: #1e293b;">${res.title}</span>
                            <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background-color: #e0e7ff; color: #3730a3;">
                              ${res.type.toUpperCase()}
                            </span>
                          </div>
                          ${res.provider ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${res.provider}</div>` : ''}
                          ${res.url ? `
                            <div style="margin-top: 4px;">
                              <a href="${res.url}" target="_blank" style="color: #2563eb; font-weight: 600; font-size: 11px; text-decoration: underline; word-break: break-all;">
                                ${res.url}
                              </a>
                            </div>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Master Links Directory Section -->
      ${allResources.length > 0 ? `
        <div style="margin-top: 32px; border-top: 2px solid #e2e8f0; padding-top: 20px; page-break-before: auto;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
            ${isHe ? 'אינדקס קישורים מרוכז (Hyperlinks)' : 'Master Resources Directory (Hyperlinks)'}
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: ${isHe ? 'right' : 'left'};">
            <thead>
              <tr style="background-color: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 8px 10px;">#</th>
                <th style="padding: 8px 10px;">${isHe ? 'נושא' : 'Topic'}</th>
                <th style="padding: 8px 10px;">${isHe ? 'שם המקור' : 'Resource Name'}</th>
                <th style="padding: 8px 10px;">${isHe ? 'סוג' : 'Type'}</th>
                <th style="padding: 8px 10px;">${isHe ? 'קישור ישיר (לחץ לפתיחה)' : 'Direct Link (Click to Open)'}</th>
              </tr>
            </thead>
            <tbody>
              ${allResources.map((item, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding: 8px 10px; font-weight: 700; color: #64748b;">${idx + 1}</td>
                  <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">${item.nodeTitle}</td>
                  <td style="padding: 8px 10px; color: #334155;">${item.resource.title}</td>
                  <td style="padding: 8px 10px;"><span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background-color: #f1f5f9; color: #475569;">${item.resource.type}</span></td>
                  <td style="padding: 8px 10px;">
                    <a href="${item.resource.url}" target="_blank" style="color: #2563eb; font-weight: 700; text-decoration: underline; word-break: break-all;">
                      ${item.resource.url}
                    </a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Visual Tree Flowchart & Sequence Map Section -->
      <div style="margin-top: 40px; border-top: 3px solid #4f46e5; padding-top: 24px; page-break-before: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>🗺️</span>
              <span>${isHe ? 'מפת העץ - תרשים זרימה ועקיבת התקדמות ויזואלית' : 'Visual Tree Map & Progress Roadmap'}</span>
            </h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">
              ${isHe ? 'מציג את רצף הלמידה, השלב הקודם (תלויות) וסטטוס ההתקדמות בכל נושא' : 'Displays learning sequence, prerequisites, and topic completion status'}
            </p>
          </div>
          <div style="background-color: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800;">
            ${isHe ? 'מפת שלבים' : 'Roadmap Map'}
          </div>
        </div>

        <!-- Levels Progression Flow -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${['foundation', 'core', 'advanced', 'specialization'].map((lvl, levelIdx) => {
            const levelNodes = nodesList.filter((n) => n.level === lvl || (!n.level && levelIdx === 0));
            if (levelNodes.length === 0) return '';

            const levelTitles: Record<string, string> = {
              foundation: isHe ? 'שלב 1: יסודות ותשתית (Foundation)' : 'Stage 1: Foundation',
              core: isHe ? 'שלב 2: נושאי ליבה (Core Topics)' : 'Stage 2: Core Topics',
              advanced: isHe ? 'שלב 3: רמה מתקדמת (Advanced)' : 'Stage 3: Advanced Level',
              specialization: isHe ? 'שלב 4: התמחות ויישום (Specialization)' : 'Stage 4: Specialization & Practice'
            };

            const levelHeaderBg: Record<string, string> = {
              foundation: '#f0f9ff',
              core: '#e0e7ff',
              advanced: '#fef3c7',
              specialization: '#faf5ff'
            };

            const levelBorderColor: Record<string, string> = {
              foundation: '#0284c7',
              core: '#4f46e5',
              advanced: '#d97706',
              specialization: '#9333ea'
            };

            return `
              <div style="border: 1.5px solid ${levelBorderColor[lvl] || '#cbd5e1'}; border-radius: 12px; background-color: #ffffff; overflow: hidden;">
                <!-- Level Header -->
                <div style="background-color: ${levelHeaderBg[lvl] || '#f8fafc'}; padding: 10px 16px; border-bottom: 1px solid ${levelBorderColor[lvl] || '#cbd5e1'}; font-weight: 800; font-size: 14px; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
                  <span>${levelTitles[lvl] || lvl}</span>
                  <span style="font-size: 11px; color: #64748b; font-weight: 600;">
                    ${levelNodes.length} ${isHe ? 'נושאים בשלב זה' : 'topics in this stage'}
                  </span>
                </div>

                <!-- Level Nodes Grid -->
                <div style="padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px;">
                  ${levelNodes.map((node) => {
                    const totalItems = (node.items || []).length;
                    const doneItems = (node.items || []).filter(i => i.completed).length;
                    const nodePct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
                    
                    const parentNode = node.parentId && tree.nodes[node.parentId] ? tree.nodes[node.parentId] : null;

                    let statusBadge = `<span style="color: #64748b; font-weight: 700;">⚪ ${isHe ? 'טרם התחיל' : 'Not Started'}</span>`;
                    if (nodePct === 100) {
                      statusBadge = `<span style="color: #059669; font-weight: 700;">🟢 ${isHe ? 'הושלם' : 'Completed'}</span>`;
                    } else if (nodePct > 0) {
                      statusBadge = `<span style="color: #d97706; font-weight: 700;">🟡 ${isHe ? 'בלמידה' : 'In Progress'}</span>`;
                    }

                    return `
                      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                          <!-- Node Title & Status -->
                          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div style="font-weight: 700; font-size: 13px; color: #0f172a; line-height: 1.3;">
                              ${node.title}
                            </div>
                            <div style="font-size: 10px;">${statusBadge}</div>
                          </div>

                          <!-- Parent Prerequisite connection if exists -->
                          ${parentNode ? `
                            <div style="font-size: 10px; color: #4f46e5; background-color: #e0e7ff; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px; font-weight: 600; display: inline-block;">
                              ${isHe ? '⬆️ תלוי בנושא:' : '⬆️ Requires:'} ${parentNode.title}
                            </div>
                          ` : `
                            <div style="font-size: 10px; color: #059669; background-color: #ecfdf5; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px; font-weight: 600; display: inline-block;">
                              ${isHe ? '🌱 נושא בסיס' : '🌱 Root Topic'}
                            </div>
                          `}
                        </div>

                        <!-- Mini Progress Bar -->
                        <div style="margin-top: 8px;">
                          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: 600; margin-bottom: 3px;">
                            <span>${doneItems}/${totalItems} ${isHe ? 'משימות' : 'tasks'}</span>
                            <span>${nodePct}%</span>
                          </div>
                          <div style="width: 100%; height: 6px; background-color: #e2e8f0; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${nodePct}%; height: 100%; background-color: ${nodePct === 100 ? '#10b981' : nodePct > 0 ? '#f59e0b' : '#cbd5e1'}; border-radius: 3px;"></div>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Connector Arrow between Stages -->
              ${levelIdx < 3 && nodesList.some(n => n.level === ['foundation', 'core', 'advanced', 'specialization'][levelIdx + 1]) ? `
                <div style="text-align: center; font-size: 18px; color: #6366f1; margin: -10px 0; font-weight: 800;">
                  ↓
                </div>
              ` : ''}
            `;
          }).join('')}
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        CogniTree AI - ${isHe ? 'נוצר אוטומטית כקובץ PDF נגש' : 'Generated automatically as an accessible PDF'}
      </div>
    </div>
  `;

  // Create isolated hidden iframe to prevent html2canvas from reading parent stylesheets with oklch
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '950px';
  iframe.style.height = '1400px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return false;
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="${isHe ? 'he' : 'en'}" dir="${isHe ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #ffffff;
          color: #0f172a;
          padding: 32px;
          direction: ${isHe ? 'rtl' : 'ltr'};
          width: 950px;
        }
        a { color: #2563eb; text-decoration: underline; }
        ul { list-style: none; }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);
  iframeDoc.close();

  // Wait briefly for DOM/layout write
  await new Promise((resolve) => setTimeout(resolve, 200));

  try {
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Attach clickable link annotations onto the PDF coordinates
    const linkElements = Array.from(iframeDoc.body.querySelectorAll('a[href]'));
    const bodyRect = iframeDoc.body.getBoundingClientRect();

    linkElements.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      const rect = a.getBoundingClientRect();
      const xRatio = (rect.left - bodyRect.left) / iframeDoc.body.offsetWidth;
      const yRatio = (rect.top - bodyRect.top) / iframeDoc.body.offsetHeight;
      const wRatio = rect.width / iframeDoc.body.offsetWidth;
      const hRatio = rect.height / iframeDoc.body.offsetHeight;

      const pdfX = xRatio * imgWidth;
      const pdfYTotal = yRatio * imgHeight;

      const pageIndex = Math.floor(pdfYTotal / pageHeight);
      const pdfY = pdfYTotal % pageHeight;

      if (pageIndex < pdf.getNumberOfPages()) {
        pdf.setPage(pageIndex + 1);
        pdf.link(pdfX, pdfY, Math.max(wRatio * imgWidth, 5), Math.max(hRatio * imgHeight, 3), { url: href });
      }
    });

    const safeFileName = tree.topic.replace(/[^\w\u0590-\u05FF]/g, '_');
    pdf.save(`${safeFileName}_learning_map.pdf`);

    document.body.removeChild(iframe);
    return true;
  } catch (err) {
    console.error('Failed to export tree to PDF:', err);
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    return false;
  }
}

