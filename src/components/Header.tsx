import React from 'react';
import {
  GitFork,
  Plus,
  Bookmark,
  Download,
  FileText,
  LayoutGrid,
  Network,
  ListTree,
  Library,
  Key,
} from 'lucide-react';
import { calculateTreeProgress } from '../lib/treeStore';
import { LearningTree } from '../types';

interface HeaderProps {
  currentTree: LearningTree | null;
  savedTreesCount: number;
  viewMode: 'graph' | 'list' | 'vault' | 'dashboard';
  setViewMode: (mode: 'graph' | 'list' | 'vault' | 'dashboard') => void;
  onOpenNewModal: () => void;
  onOpenSettings?: () => void;
  onToggleSidebar: () => void;
  onExportImage: () => void;
  onExportPdf?: () => void;
  onExportJson: () => void;
  language: 'he' | 'en';
  setLanguage: (lang: 'he' | 'en') => void;
}

const VIEW_TABS: { id: 'dashboard' | 'graph' | 'list' | 'vault'; icon: React.ElementType; labelHe: string; labelEn: string }[] = [
  { id: 'dashboard', icon: LayoutGrid, labelHe: 'פרויקטים', labelEn: 'Projects' },
  { id: 'graph', icon: Network, labelHe: 'עץ ויזואלי', labelEn: 'Visual Tree' },
  { id: 'list', icon: ListTree, labelHe: 'שלבים', labelEn: 'Steps' },
  { id: 'vault', icon: Library, labelHe: 'מקורות', labelEn: 'Vault' },
];

export const Header: React.FC<HeaderProps> = ({
  currentTree,
  savedTreesCount,
  viewMode,
  setViewMode,
  onOpenNewModal,
  onOpenSettings,
  onToggleSidebar,
  onExportImage,
  onExportPdf,
  language,
  setLanguage,
}) => {
  const progress = currentTree ? calculateTreeProgress(currentTree) : null;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm">
      {/* Brand bar: identity + global actions, always one clean row */}
      <div className="border-b border-slate-100 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
              <GitFork className="w-4.5 h-4.5 rotate-90" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none truncate">
              CogniTree <span className="text-indigo-600 font-extrabold">AI</span>
            </h1>
            {!currentTree && (
              <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                {language === 'he' ? 'מפת למידה חכמה' : 'Smart Learning Map'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Settings API Key Modal Button */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-indigo-600 transition-colors"
                title={language === 'he' ? 'הגדרות מפתח Gemini API' : 'Gemini API Settings'}
              >
                <Key className="w-4 h-4 text-amber-500" />
              </button>
            )}

            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => setLanguage('he')}
                className={`px-2 py-1 rounded-md transition-all ${
                  language === 'he' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                עב
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-md transition-all ${
                  language === 'en' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={onToggleSidebar}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors relative"
            >
              <Bookmark className="w-4 h-4 text-indigo-600" />
              <span>{language === 'he' ? 'שמורים' : 'Saved'}</span>
              {savedTreesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {savedTreesCount}
                </span>
              )}
            </button>
            <button
              onClick={onToggleSidebar}
              className="sm:hidden p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 relative"
              title={language === 'he' ? 'נושאים שמורים בצד' : 'Saved Trees Vault'}
            >
              <Bookmark className="w-4.5 h-4.5 text-indigo-600" />
              {savedTreesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {savedTreesCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenNewModal}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-sm shadow-indigo-200 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">{language === 'he' ? 'נושא חדש' : 'New Tree'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Context bar: only shown once a tree is active - topic, progress, views, exports */}
      {currentTree && progress && (
        <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto scrollbar-none">
            {/* Current Topic + Progress */}
            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
              <div className="w-10 h-10 shrink-0">
                <svg className="transform -rotate-90 overflow-visible" width="40" height="40">
                  <circle cx="20" cy="20" r="16" strokeWidth="4" className="stroke-slate-200" fill="transparent" />
                  <circle
                    cx="20" cy="20" r="16" strokeWidth="4"
                    className={progress.percentage === 100 ? 'stroke-emerald-500' : 'stroke-indigo-600'}
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - progress.percentage / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
              </div>
              <div className="min-w-0 hidden md:block">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[220px]">{currentTree.topic}</p>
                <p className="text-[11px] text-slate-500">
                  {progress.percentage}% &middot; {progress.completedItems}/{progress.totalItems} {language === 'he' ? 'הושלמו' : 'done'}
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 shrink-0" />

            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium shrink-0">
              {VIEW_TABS.map(({ id, icon: Icon, labelHe, labelEn }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                    viewMode === id
                      ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{language === 'he' ? labelHe : labelEn}</span>
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Export Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onExportPdf && (
                <button
                  onClick={onExportPdf}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-xs font-semibold text-indigo-700 transition-colors"
                  title={language === 'he' ? 'ייצא מסמך PDF מקיף עם פירוט נושאים וקישורים פעילים' : 'Export comprehensive PDF document with topics breakdown & hyperlinks'}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{language === 'he' ? 'PDF' : 'PDF'}</span>
                </button>
              )}
              <button
                onClick={onExportImage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 transition-colors"
                title={language === 'he' ? 'ייצא את עץ הלמידה כתמונה ברזולוציה גבוהה' : 'Export tree as image'}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{language === 'he' ? 'תמונה' : 'Image'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
