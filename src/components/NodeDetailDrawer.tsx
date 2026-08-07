import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  ExternalLink,
  Youtube,
  GraduationCap,
  BookOpen,
  FileText,
  GitBranchPlus,
  Plus,
  CheckSquare,
  Square,
  Award,
  Scissors,
  FolderPlus,
  PlusCircle
} from 'lucide-react';
import { TreeNode, Resource, ResourceType } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface NodeDetailDrawerProps {
  node: TreeNode | null;
  treeTopic: string;
  rootNodeId?: string;
  onClose: () => void;
  onToggleItem: (nodeId: string, itemId: string) => void;
  onToggleResource: (nodeId: string, resourceId: string) => void;
  onAddItem: (nodeId: string, itemText: string) => void;
  onAddResource: (nodeId: string, resource: Partial<Resource>) => void;
  onSaveNotes: (nodeId: string, notes: string) => void;
  onExpandNode: (node: TreeNode) => void;
  onPruneNode?: (nodeId: string) => void;
  onPromoteNodeToTree?: (node: TreeNode) => void;
  onOpenCustomBranchModal?: (node: TreeNode) => void;
  isLoadingExpand?: boolean;
  language?: 'he' | 'en';
}

const RESOURCE_TYPE_META: Record<ResourceType, { icon: React.ElementType; labelHe: string; labelEn: string }> = {
  course_free: { icon: GraduationCap, labelHe: 'edX / Coursera', labelEn: 'edX / Coursera' },
  course_paid: { icon: Award, labelHe: 'Udemy', labelEn: 'Udemy' },
  youtube: { icon: Youtube, labelHe: 'YouTube', labelEn: 'YouTube' },
  book: { icon: BookOpen, labelHe: 'ספר / eBook', labelEn: 'Book / eBook' },
  article: { icon: FileText, labelHe: 'מאמר אקדמי', labelEn: 'Academic PDF' },
  doc: { icon: FileText, labelHe: 'תיעוד רשמי', labelEn: 'Official Doc' },
};

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  treeTopic,
  rootNodeId,
  onClose,
  onToggleItem,
  onToggleResource,
  onAddItem,
  onAddResource,
  onSaveNotes,
  onExpandNode,
  onPruneNode,
  onPromoteNodeToTree,
  onOpenCustomBranchModal,
  isLoadingExpand = false,
  language = 'he',
}) => {
  const [activeResTab, setActiveResTab] = useState<string>('all');
  const [newItemText, setNewItemText] = useState('');
  const [showAddResForm, setShowAddResForm] = useState(false);

  // Custom resource input state
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resProvider, setResProvider] = useState('');
  const [resType, setResType] = useState<ResourceType>('youtube');
  const [resDesc, setResDesc] = useState('');

  // Personal note
  const [notesText, setNotesText] = useState(node?.notes || '');
  const [confirmAction, setConfirmAction] = useState<{ type: 'promote' | 'prune' } | null>(null);

  if (!node) return null;

  const isCompleted = node.completed;
  const isRoot = node.id === rootNodeId;

  const itemsCompletedCount = node.items.filter(i => i.completed).length;
  const resCompletedCount = node.resources.filter(r => r.completed).length;

  const filteredResources = node.resources.filter(r => {
    if (activeResTab === 'all') return true;
    if (activeResTab === 'course_free') return r.type === 'course_free';
    if (activeResTab === 'course_paid') return r.type === 'course_paid';
    if (activeResTab === 'youtube') return r.type === 'youtube';
    if (activeResTab === 'book') return r.type === 'book';
    if (activeResTab === 'paper_doc') return r.type === 'article' || r.type === 'doc';
    return true;
  });

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    onAddItem(node.id, newItemText.trim());
    setNewItemText('');
  };

  const handleAddResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;
    onAddResource(node.id, {
      title: resTitle.trim(),
      url: resUrl.trim() || `https://www.google.com/search?q=${encodeURIComponent(resTitle)}`,
      provider: resProvider.trim() || (language === 'he' ? 'מקור מותאם' : 'Custom Source'),
      type: resType,
      description: resDesc.trim(),
      isVerifiedAcademic: true,
      completed: false,
    });

    // Reset form
    setResTitle('');
    setResUrl('');
    setResProvider('');
    setResDesc('');
    setShowAddResForm(false);
  };

  const handleNotesBlur = () => {
    onSaveNotes(node.id, notesText);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-[420px] bg-paper border-l border-ink/10 h-full flex flex-col shadow-elev-lg overflow-hidden font-body" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="px-6 py-[22px] border-b border-ink/10 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              isRoot ? 'border border-ink/25 text-ink/70' :
              node.level === 'foundation' ? 'bg-sage-100 text-sage-800' :
              node.level === 'core' ? 'bg-accent-100 text-accent-800' :
              node.level === 'advanced' ? 'bg-sand-200 text-sand-800' :
              'border border-ink/20 text-ink/70'
            }`}>
              {isRoot ? (language === 'he' ? 'נושא שורש' : 'Root topic') :
               node.level === 'foundation' ? (language === 'he' ? 'יסודות / דרישת קדם' : 'Foundation / Prerequisite') :
               node.level === 'core' ? (language === 'he' ? 'נושא ליבה' : 'Core Topic') :
               node.level === 'advanced' ? (language === 'he' ? 'נושא מתקדם' : 'Advanced Topic') : (language === 'he' ? 'התמחות' : 'Specialization')}
            </span>

            <h2 className="font-heading text-xl text-ink">{node.title}</h2>
            <p className="text-[13px] text-ink/60 leading-relaxed">{node.description}</p>

            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              isCompleted ? 'bg-sage-500 text-paper' : 'bg-panel text-ink/70'
            }`}>
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.75} />
                  <span>{language === 'he' ? 'ענף הושלם' : 'Completed'}</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 text-ink/35" strokeWidth={2.75} />
                  <span>{language === 'he' ? 'בתהליך למידה' : 'In Progress'}</span>
                </>
              )}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-ink/50 hover:text-ink hover:bg-panel transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2.75} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-[22px]">

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
                      ? `האם להפוך את הענף "${node.title}" וכל תתי-הענפים שתחתיו לעץ למידה עצמאי ונפרד במאגר?`
                      : `Promote branch "${node.title}" and its sub-branches into an independent learning tree?`)
                  : (language === 'he'
                      ? `האם להסיר ולגדע את הענף "${node.title}" וכל תתי-הענפים שלו מעץ הלמידה הנוכחי?`
                      : `Remove and prune branch "${node.title}" and its sub-branches from the current learning tree?`)
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
                  onPromoteNodeToTree(node);
                } else if (confirmAction.type === 'prune' && onPruneNode) {
                  onPruneNode(node.id);
                }
                setConfirmAction(null);
              }}
              onCancel={() => setConfirmAction(null)}
              language={language}
            />
          )}

          {/* Sub-Topics Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h6 className="text-[13px] uppercase tracking-[0.08em] text-ink/50 font-semibold">
                {language === 'he' ? 'משימות ויעדי למידה' : 'Checklist'}
              </h6>
              <span className="text-[11px] text-ink/50 font-semibold">
                {itemsCompletedCount} / {node.items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              {node.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onToggleItem(node.id, item.id)}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <span className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center border-[1.5px] transition-colors ${
                    item.completed ? 'bg-sage-500 border-sage-500' : 'border-ink/25 group-hover:border-accent-400'
                  }`}>
                    {item.completed && <CheckCircle2 className="w-3.5 h-3.5 text-paper" strokeWidth={3} />}
                  </span>
                  <span className={`text-[13px] leading-relaxed ${item.completed ? 'line-through opacity-55 text-ink' : 'text-ink'}`}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Add Custom Item Form */}
            <form onSubmit={handleAddItemSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder={language === 'he' ? "+ הוסף תת-נושא ללמידה..." : "+ Add learning topic..."}
                className="flex-1 bg-panel/50 border border-ink/15 rounded-full px-4 py-2 text-xs text-ink placeholder-ink/40 focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!newItemText.trim()}
                className="px-4 py-2 rounded-full bg-accent hover:bg-accent-700 text-paper text-xs font-heading disabled:opacity-40 transition-colors"
              >
                {language === 'he' ? 'הוסף' : 'Add'}
              </button>
            </form>
          </div>

          {/* Verified Resources Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h6 className="text-[13px] uppercase tracking-[0.08em] text-ink/50 font-semibold">
                {language === 'he' ? 'מקורות למידה' : 'Resources'}
              </h6>
              <button
                onClick={() => setShowAddResForm(!showAddResForm)}
                className="text-[11px] text-accent-700 hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.75} />
                <span>{language === 'he' ? 'הוסף מקור' : 'Add Source'}</span>
              </button>
            </div>

            {/* Resource Type Filter Tabs */}
            <div className="flex items-center gap-1 bg-panel border border-ink/10 p-1 rounded-full text-xs mb-3 overflow-x-auto scrollbar-none">
              {[
                { id: 'all', label: language === 'he' ? 'הכל' : 'All' },
                { id: 'course_free', label: language === 'he' ? 'edX/Coursera' : 'edX/Coursera' },
                { id: 'course_paid', label: language === 'he' ? 'Udemy' : 'Udemy' },
                { id: 'youtube', label: language === 'he' ? 'YouTube' : 'YouTube' },
                { id: 'book', label: language === 'he' ? 'ספרים' : 'Books' },
                { id: 'paper_doc', label: language === 'he' ? 'PDFs' : 'PDFs' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveResTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full transition-colors text-[11px] font-heading whitespace-nowrap ${
                    activeResTab === tab.id ? 'bg-accent text-paper' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Add Resource Form */}
            {showAddResForm && (
              <form onSubmit={handleAddResourceSubmit} className="bg-panel/50 border border-ink/10 rounded-panel p-4 mb-4 space-y-3">
                <div className="text-xs font-bold text-ink">
                  {language === 'he' ? 'הוסף מקור למידה חדש' : 'Add New Learning Source'}
                </div>
                <input
                  type="text"
                  value={resTitle}
                  onChange={e => setResTitle(e.target.value)}
                  placeholder={language === 'he' ? "שם הקורס, הספר או המאמר..." : "Course, book, or paper title..."}
                  className="w-full bg-paper border border-ink/15 rounded-full px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  required
                />
                <input
                  type="url"
                  value={resUrl}
                  onChange={e => setResUrl(e.target.value)}
                  placeholder={language === 'he' ? "קישור ישיר (URL)..." : "Direct URL link..."}
                  className="w-full bg-paper border border-ink/15 rounded-full px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={resProvider}
                    onChange={e => setResProvider(e.target.value)}
                    placeholder={language === 'he' ? "ספק (MIT, edX, Coursera, Udemy)" : "Provider (MIT, edX, Coursera, Udemy)"}
                    className="bg-paper border border-ink/15 rounded-full px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  />
                  <select
                    value={resType}
                    onChange={e => setResType(e.target.value as any)}
                    className="bg-paper border border-ink/15 rounded-full px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  >
                    <option value="course_free">{language === 'he' ? 'קורס אוניברסיטאי (edX/Coursera)' : 'University Course (edX/Coursera)'}</option>
                    <option value="course_paid">{language === 'he' ? 'קורס מעשי (Udemy)' : 'Practical Course (Udemy)'}</option>
                    <option value="youtube">{language === 'he' ? 'הרצאת YouTube' : 'YouTube Video'}</option>
                    <option value="book">{language === 'he' ? 'ספר לימוד / eBook' : 'Textbook & eBook'}</option>
                    <option value="article">{language === 'he' ? 'מאמר מחקרי / PDF' : 'Academic Paper / PDF'}</option>
                    <option value="doc">{language === 'he' ? 'תיעוד רשמי' : 'Official Documentation'}</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddResForm(false)}
                    className="px-3.5 py-1.5 rounded-full text-xs text-ink/60 hover:text-ink"
                  >
                    {language === 'he' ? 'ביטול' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-700 text-paper font-heading text-xs transition-colors"
                  >
                    {language === 'he' ? 'שמור מקור' : 'Save Source'}
                  </button>
                </div>
              </form>
            )}

            {/* Resource List */}
            <div className="flex flex-col gap-2">
              {filteredResources.length === 0 ? (
                <div className="text-center py-6 text-xs text-ink/45 bg-panel/40 rounded-panel border border-ink/10">
                  {language === 'he' ? 'אין מקורות בקטגוריה זו עדיין' : 'No sources in this category yet'}
                </div>
              ) : (
                filteredResources.map((res) => {
                  const meta = RESOURCE_TYPE_META[res.type];
                  const TypeIcon = meta.icon;
                  return (
                    <div
                      key={res.id}
                      className={`p-3 rounded-panel border transition-all ${
                        res.completed ? 'bg-sage-100/60 border-sage-300' : 'bg-panel/40 border-ink/10 hover:border-accent-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            onClick={() => onToggleResource(node.id, res.id)}
                            className="mt-0.5 shrink-0"
                            title={language === 'he' ? "סמן כנקרא/הושלם" : "Mark completed"}
                          >
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center border-[1.5px] transition-colors ${
                              res.completed ? 'bg-sage-500 border-sage-500' : 'border-ink/25'
                            }`}>
                              {res.completed && <CheckCircle2 className="w-3.5 h-3.5 text-paper" strokeWidth={3} />}
                            </span>
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-panel text-ink/65 flex items-center gap-1">
                                <TypeIcon className="w-3 h-3 text-accent-600" strokeWidth={2.75} />
                                {language === 'he' ? meta.labelHe : meta.labelEn}
                              </span>
                              {res.provider && (
                                <span className="text-[10px] text-ink/50 font-semibold">&middot; {res.provider}</span>
                              )}
                              {res.isVerifiedAcademic && (
                                <span className="text-[9px] font-bold text-sand-800 bg-sand-200 px-1.5 py-0.5 rounded-full">
                                  {language === 'he' ? 'מאומת' : 'Verified'}
                                </span>
                              )}
                            </div>

                            <h4 className={`text-[13px] font-bold leading-snug ${res.completed ? 'line-through opacity-55 text-ink' : 'text-ink'}`}>
                              {res.title}
                            </h4>

                            {res.description && (
                              <p className="text-[11px] text-ink/55 mt-1 leading-relaxed">
                                {res.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {res.url && (
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="p-2 rounded-full bg-panel hover:bg-accent hover:text-paper text-ink/60 transition-colors shrink-0"
                            title={language === 'he' ? "פתח מקור זה בחלון חדש" : "Open source in new tab"}
                          >
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.75} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Personal Notes */}
          <div className="field">
            <label className="text-[13px] uppercase tracking-[0.08em] text-ink/50 font-semibold block mb-2.5">
              {language === 'he' ? 'ההערות שלך' : 'Your notes'}
            </label>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder={language === 'he' ? "כתוב תובנות, סיכומים או תזכורות אישיות על נושא זה..." : "Jot down what clicked, what didn't..."}
              rows={3}
              className="w-full bg-panel/50 border border-ink/15 rounded-panel p-3 text-xs text-ink placeholder-ink/40 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-ink/10 flex items-center gap-2">
          <button
            onClick={() => onExpandNode(node)}
            disabled={isLoadingExpand}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-full font-heading text-xs transition-all active:scale-95 disabled:opacity-50 ${
              node.expansionExhausted
                ? 'border border-ink/20 text-ink/60 hover:bg-panel'
                : 'bg-accent hover:bg-accent-700 text-paper'
            }`}
            // Still clickable when "exhausted" - see VisualTreeGraph: that flag is persisted, so
            // disabling it outright made nodes permanently unexpandable after a single failure.
            title={node.expansionExhausted
              ? (language === 'he' ? 'לא נמצאו תתי-נושאים חדשים בניסיון הקודם - לחץ לניסיון נוסף' : 'No new sub-topics were found last time - click to try again')
              : undefined}
          >
            <GitBranchPlus className="w-3.5 h-3.5" strokeWidth={2.75} />
            <span>
              {isLoadingExpand
                ? (language === 'he' ? 'מרחיב...' : 'Expanding...')
                : node.expansionExhausted
                ? (language === 'he' ? 'נסה שוב' : 'Try again')
                : (language === 'he' ? 'גדל ענף' : 'Grow branch')}
            </span>
          </button>

          {onOpenCustomBranchModal && (
            <button
              onClick={() => onOpenCustomBranchModal(node)}
              className="p-2.5 rounded-full border border-ink/15 text-ink/70 hover:bg-panel transition-colors"
              title={language === 'he' ? "הוסף ענף מותאם אישית תחת נושא זה" : "Add custom branch"}
            >
              <PlusCircle className="w-4 h-4" strokeWidth={2.75} />
            </button>
          )}

          {onPromoteNodeToTree && !isRoot && (
            <button
              onClick={() => setConfirmAction({ type: 'promote' })}
              className="px-3.5 py-2.5 rounded-full border border-ink/15 text-ink/80 hover:bg-panel font-heading text-xs transition-colors"
              title={language === 'he' ? "ייצא ענף זה והופך אותו לפרויקט עץ עצמאי במאגר" : "Promote this branch into a new independent subject tree"}
            >
              {language === 'he' ? 'פצל לעץ' : 'Split off'}
            </button>
          )}

          {onPruneNode && !isRoot && (
            <button
              onClick={() => setConfirmAction({ type: 'prune' })}
              className="p-2.5 rounded-full border border-ink/15 text-red-700 hover:bg-red-50 transition-colors"
              title={language === 'he' ? "גדע ענף זה מהעץ" : "Prune branch"}
            >
              <Scissors className="w-4 h-4" strokeWidth={2.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
