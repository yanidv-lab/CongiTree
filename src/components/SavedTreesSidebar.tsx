import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Bookmark, 
  GitFork, 
  Trash2, 
  Download, 
  FileText,
  Upload, 
  Plus, 
  CheckCircle2, 
  Copy,
  Clock,
  Sparkles,
  Link2
} from 'lucide-react';
import { LearningTree } from '../types';
import { calculateTreeProgress } from '../lib/treeStore';
import { ProgressRing } from './ProgressRing';
import { ConfirmModal } from './ConfirmModal';

interface SavedTreesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  savedTrees: LearningTree[];
  activeTreeId: string | null;
  onSelectTree: (tree: LearningTree) => void;
  onDeleteTree: (treeId: string) => void;
  onDuplicateTree: (tree: LearningTree) => void;
  onOpenNewModal: () => void;
  onImportJson: (jsonString: string) => void;
  onExportPdf?: (tree: LearningTree) => void;
  language?: 'he' | 'en';
}

export const SavedTreesSidebar: React.FC<SavedTreesSidebarProps> = ({
  isOpen,
  onClose,
  savedTrees,
  activeTreeId,
  onSelectTree,
  onDeleteTree,
  onDuplicateTree,
  onOpenNewModal,
  onImportJson,
  onExportPdf,
  language = 'he',
}) => {
  const isHe = language === 'he';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'related' | 'independent'>('all');
  const [deleteConfirmTree, setDeleteConfirmTree] = useState<LearningTree | null>(null);

  if (!isOpen) return null;

  const currentTree = savedTrees.find(t => t.id === activeTreeId);

  const filteredTrees = savedTrees.filter(tree => {
    const matchesSearch = tree.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (tree.description && tree.description.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (activeCategoryTab === 'related' && currentTree) {
      // Check if related by topic words
      const currentWords = currentTree.topic.toLowerCase().split(/\s+/);
      const isRelated = currentWords.some(w => w.length > 3 && tree.topic.toLowerCase().includes(w));
      return isRelated && tree.id !== currentTree.id;
    }

    return true;
  });

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJson(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white border-r border-slate-200 h-full flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{isHe ? 'מאגר עצי הלמידה שלך' : 'Your Learning Trees Vault'}</h2>
              <p className="text-xs text-slate-500">{isHe ? 'נושאים שמורים במאגר' : 'Saved projects and subject trees'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: Open New Tree */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => {
              onClose();
              onOpenNewModal();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isHe ? 'פתח נושא חדש כעץ נפרד' : 'Open New Tree'}</span>
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="p-4 space-y-3 border-b border-slate-200">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isHe ? "חפש נושא שמור..." : "Search saved tree..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pr-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveCategoryTab('all')}
              className={`flex-1 py-1 rounded-lg text-center font-medium transition-all text-[11px] ${
                activeCategoryTab === 'all'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHe ? `כל הנושאים (${savedTrees.length})` : `All Trees (${savedTrees.length})`}
            </button>
            <button
              onClick={() => setActiveCategoryTab('related')}
              className={`flex-1 py-1 rounded-lg text-center font-medium transition-all text-[11px] ${
                activeCategoryTab === 'related'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHe ? 'נושאים קשורים' : 'Related'}
            </button>
          </div>
        </div>

        {/* Trees List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTrees.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {isHe ? 'לא נמצאו נושאים שמורים' : 'No saved trees found'}
            </div>
          ) : (
            filteredTrees.map((tree) => {
              const isActive = tree.id === activeTreeId;
              const progress = calculateTreeProgress(tree);

              return (
                <div
                  key={tree.id}
                  onClick={() => {
                    onSelectTree(tree);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
                    isActive
                      ? 'bg-indigo-50/70 border-2 border-indigo-500 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.2 bg-indigo-600 text-white rounded-full">
                            {isHe ? 'פעיל כעת' : 'Active'}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tree.createdAt).toLocaleDateString(isHe ? 'he-IL' : 'en-US')}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {tree.topic}
                      </h3>

                      {tree.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {tree.description}
                        </p>
                      )}
                    </div>

                    {/* Progress Ring & Items Count */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <ProgressRing percentage={progress.percentage} size={42} strokeWidth={4} />
                      <div className="text-[10px] font-medium text-slate-400">
                        {progress.completedItems}/{progress.totalItems}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 group-hover:text-indigo-600 font-medium">
                      {isHe ? 'לחץ לפתיחת עץ הלמידה ←' : 'Click to view tree →'}
                    </span>

                    <div className="flex items-center gap-1">
                      {onExportPdf && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onExportPdf(tree);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title={isHe ? "ייצא מסמך PDF מפורט עם קישורים" : "Export detailed PDF document with hyperlinks"}
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateTree(tree);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title={isHe ? "שכפל עץ למידה" : "Duplicate tree"}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmTree(tree);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={isHe ? "מחק עץ" : "Delete tree"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmTree && (
          <ConfirmModal
            isOpen={!!deleteConfirmTree}
            title={isHe ? 'מחיקת עץ למידה' : 'Delete Learning Tree'}
            message={isHe ? `האם אתה בטוח שברצונך למחוק את עץ הלמידה "${deleteConfirmTree.topic}"? פעולה זו אינה ניתנת לביטול.` : `Are you sure you want to delete learning tree "${deleteConfirmTree.topic}"? This action cannot be undone.`}
            confirmLabel={isHe ? 'מחק עץ' : 'Delete Tree'}
            variant="danger"
            iconType="delete"
            onConfirm={() => {
              onDeleteTree(deleteConfirmTree.id);
              setDeleteConfirmTree(null);
            }}
            onCancel={() => setDeleteConfirmTree(null)}
            language={language}
          />
        )}

        {/* JSON Import/Export Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-colors shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isHe ? 'ייבא קובץ JSON' : 'Import JSON File'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
