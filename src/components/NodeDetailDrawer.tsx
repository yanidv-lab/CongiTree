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
  Sparkles,
  Link as LinkIcon,
  Search,
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
      provider: resProvider.trim() || 'מקור מותאם',
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Drawer Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                node.level === 'foundation' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                node.level === 'core' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                node.level === 'advanced' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                'bg-teal-50 text-teal-700 border-teal-200'
              }`}>
                {node.level === 'foundation' ? (language === 'he' ? 'יסודות / דרישת קדם' : 'Foundation / Prerequisite') :
                 node.level === 'core' ? (language === 'he' ? 'נושא ליבה' : 'Core Topic') :
                 node.level === 'advanced' ? (language === 'he' ? 'נושא מתקדם' : 'Advanced Topic') : (language === 'he' ? 'התמחות' : 'Specialization')}
              </span>

              {/* Green / Gray Status */}
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                isCompleted 
                  ? 'bg-emerald-500 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 fill-white stroke-emerald-500" />
                    <span>{language === 'he' ? 'ענף הושלם' : 'Completed'}</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5 text-slate-400" />
                    <span>{language === 'he' ? 'בתהליך למידה' : 'In Progress'}</span>
                  </>
                )}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">{node.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Node Description & Purpose */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {language === 'he' ? 'הקשר ומהות הנושא' : 'Context & Core Concept'}
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">{node.description}</p>
          </div>

          {/* Action: Expand Sub-Branches & Add Custom Branch */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-4 space-y-3 shadow-xs">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 mb-0.5">
                <Sparkles className="w-4 h-4" />
                <span>{language === 'he' ? 'פיתוח והרחבת ענפים לענף זה' : 'Expand & Develop Branch'}</span>
              </div>
              <p className="text-xs text-slate-600">
                {language === 'he'
                  ? 'בחר כיצד ברצונך להעמיק ולפתח ענף זה: צור ענפים חכמים עם AI או הוסף ענף מותאם אישית ביוזמתך.'
                  : 'Choose how to expand this branch: generate AI sub-branches or add custom manual sub-branches.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                onClick={() => onExpandNode(node)}
                disabled={isLoadingExpand}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <GitBranchPlus className="w-4 h-4" />
                <span>{isLoadingExpand ? (language === 'he' ? 'מרחיב ענפים...' : 'Expanding...') : (language === 'he' ? 'הרחבה חכמה עם AI' : 'Smart AI Expansion')}</span>
              </button>

              {onOpenCustomBranchModal && (
                <button
                  onClick={() => onOpenCustomBranchModal(node)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs transition-all active:scale-95 shadow-2xs"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'he' ? '+ ענף מותאם אישית' : '+ Custom Branch'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Advanced Structural Operations: Promote & Prune */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'he' ? 'פעולות מבניות מתקדמות' : 'Advanced Structural Operations'}
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Promote to Standalone Project */}
              {onPromoteNodeToTree && node.id !== rootNodeId && (
                <button
                  onClick={() => setConfirmAction({ type: 'promote' })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-bold text-xs transition-all shadow-2xs"
                  title={language === 'he' ? "ייצא ענף זה והופך אותו לפרויקט עץ עצמאי במאגר" : "Promote this branch into a new independent subject tree"}
                >
                  <FolderPlus className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'he' ? 'הפוך לפרויקט עצמאי' : 'Make Independent Tree'}</span>
                </button>
              )}

              {/* Prune Branch */}
              {onPruneNode && node.id !== rootNodeId && (
                <button
                  onClick={() => setConfirmAction({ type: 'prune' })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-slate-200 text-red-600 font-bold text-xs transition-all shadow-2xs"
                  title={language === 'he' ? "גדע ענף זה מהעץ (הסר אותו ואת תת-הענפים שלו)" : "Cut / Prune this branch and sub-branches from the tree"}
                >
                  <Scissors className="w-4 h-4 text-red-600" />
                  <span>{language === 'he' ? 'גדע ענף זה מהעץ' : 'Cut / Prune Branch'}</span>
                </button>
              )}
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'he' ? 'נושאים ויעדי למידה' : 'Learning Topics & Goals'}</span>
                <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  {itemsCompletedCount} / {node.items.length} {language === 'he' ? 'הושלמו' : 'completed'}
                </span>
              </h3>
            </div>

            <div className="space-y-2 mb-3">
              {node.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onToggleItem(node.id, item.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    item.completed
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <button className="mt-0.5 shrink-0 text-emerald-600">
                    {item.completed ? (
                      <CheckSquare className="w-5 h-5 fill-emerald-500 text-white" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <span className={`text-xs leading-relaxed ${item.completed ? 'line-through text-slate-400' : ''}`}>
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
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newItemText.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-40 shadow-xs"
              >
                {language === 'he' ? 'הוסף' : 'Add'}
              </button>
            </form>
          </div>

          {/* Verified Resources Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'he' ? 'מקורות למידה מחקריים ומאומתים' : 'Verified Academic Learning Sources'}</span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {resCompletedCount} / {node.resources.length} {language === 'he' ? 'נקראו' : 'completed'}
                </span>
              </h3>
              <button
                onClick={() => setShowAddResForm(!showAddResForm)}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'הוסף מקור' : 'Add Source'}</span>
              </button>
            </div>

            {/* Resource Type Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs mb-3 overflow-x-auto">
              {[
                { id: 'all', label: language === 'he' ? 'הכל' : 'All' },
                { id: 'course_free', label: language === 'he' ? '🎓 edX/Coursera' : '🎓 edX/Coursera' },
                { id: 'course_paid', label: language === 'he' ? '🏆 Udemy' : '🏆 Udemy' },
                { id: 'youtube', label: language === 'he' ? '🎥 YouTube' : '🎥 YouTube' },
                { id: 'book', label: language === 'he' ? '📚 ספרים ו-eBooks' : '📚 Books & eBooks' },
                { id: 'paper_doc', label: language === 'he' ? '📄 PDFs ומאמרים' : '📄 PDFs & Papers' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveResTab(tab.id)}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] font-medium whitespace-nowrap ${
                    activeResTab === tab.id
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Add Resource Form Modal */}
            {showAddResForm && (
              <form onSubmit={handleAddResourceSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 space-y-3">
                <div className="text-xs font-bold text-slate-900">
                  {language === 'he' ? 'הוסף מקור למידה חדש' : 'Add New Learning Source'}
                </div>
                <input
                  type="text"
                  value={resTitle}
                  onChange={e => setResTitle(e.target.value)}
                  placeholder={language === 'he' ? "שם הקורס, הספר או המאמר..." : "Course, book, or paper title..."}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  required
                />
                <input
                  type="url"
                  value={resUrl}
                  onChange={e => setResUrl(e.target.value)}
                  placeholder={language === 'he' ? "קישור ישיר (URL)..." : "Direct URL link..."}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={resProvider}
                    onChange={e => setResProvider(e.target.value)}
                    placeholder={language === 'he' ? "ספק (MIT, edX, Coursera, Udemy)" : "Provider (MIT, edX, Coursera, Udemy)"}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={resType}
                    onChange={e => setResType(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="course_free">{language === 'he' ? '🎓 קורס אוניברסיטאי (edX/Coursera)' : '🎓 University Course (edX/Coursera)'}</option>
                    <option value="course_paid">{language === 'he' ? '🏆 קורס מעשי (Udemy)' : '🏆 Practical Course (Udemy)'}</option>
                    <option value="youtube">{language === 'he' ? '🎥 הרצאת YouTube' : '🎥 YouTube Video'}</option>
                    <option value="book">{language === 'he' ? '📚 ספר לימוד / eBook (OpenStax)' : '📚 Textbook & eBook'}</option>
                    <option value="article">{language === 'he' ? '📄 מאמר מחקרי / PDF (Google Scholar)' : '📄 Academic Paper / PDF'}</option>
                    <option value="doc">{language === 'he' ? '📝 תיעוד רשמי (Official Docs)' : '📝 Official Documentation'}</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddResForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800"
                  >
                    {language === 'he' ? 'ביטול' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs"
                  >
                    {language === 'he' ? 'שמור מקור' : 'Save Source'}
                  </button>
                </div>
              </form>
            )}

            {/* Resource List */}
            <div className="space-y-3">
              {filteredResources.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  {language === 'he' ? 'אין מקורות בקטגוריה זו עדיין' : 'No sources in this category yet'}
                </div>
              ) : (
                filteredResources.map((res) => (
                  <div
                    key={res.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      res.completed
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => onToggleResource(node.id, res.id)}
                          className="mt-0.5 text-emerald-600 shrink-0"
                          title={language === 'he' ? "סמן כנקרא/הושלם" : "Mark completed"}
                        >
                          {res.completed ? (
                            <CheckSquare className="w-5 h-5 fill-emerald-500 text-white" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {res.type === 'course_free' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><GraduationCap className="w-3 h-3"/> edX / Coursera</span>}
                            {res.type === 'course_paid' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"><Award className="w-3 h-3"/> Udemy</span>}
                            {res.type === 'youtube' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 flex items-center gap-1"><Youtube className="w-3 h-3"/> YouTube</span>}
                            {res.type === 'book' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"><BookOpen className="w-3 h-3"/> Book / eBook</span>}
                            {res.type === 'article' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"><FileText className="w-3 h-3"/> Academic PDF</span>}
                            {res.type === 'doc' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1"><FileText className="w-3 h-3"/> Official Doc</span>}

                            {res.provider && (
                              <span className="text-[10px] text-indigo-600 font-semibold">
                                • {res.provider}
                              </span>
                            )}

                            {res.isVerifiedAcademic && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-0.5" title="מקור מחקרי/אקדמי אמין ומאומת">
                                <Award className="w-2.5 h-2.5 text-amber-600" /> {language === 'he' ? 'מאומת' : 'Verified'}
                              </span>
                            )}
                          </div>

                          <h4 className={`text-xs font-bold leading-snug ${res.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {res.title}
                          </h4>

                          {res.description && (
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                              {res.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Direct External Link */}
                      {res.url && (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 transition-all shrink-0 flex items-center gap-1 text-[11px] font-semibold shadow-xs"
                          title={language === 'he' ? "פתח מקור זה בחלון חדש" : "Open source in new tab"}
                        >
                          <span>{language === 'he' ? 'פתח' : 'Open'}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Personal Notes */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              {language === 'he' ? 'הערות אישיות לנושא זה' : 'Personal Notes for Topic'}
            </h3>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder={language === 'he' ? "כתוב תובנות, סיכומים או תזכורות אישיות על נושא זה..." : "Write insights, summaries, or notes for this topic..."}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
