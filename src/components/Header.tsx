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
} from 'lucide-react';
import { calculateTreeProgress } from '../lib/treeStore';
import { LearningTree } from '../types';

interface HeaderProps {
  currentTree: LearningTree | null;
  savedTreesCount: number;
  viewMode: 'graph' | 'list' | 'vault' | 'dashboard';
  setViewMode: (mode: 'graph' | 'list' | 'vault' | 'dashboard') => void;
  onOpenNewModal: () => void;
  onToggleSidebar: () => void;
  onExportImage: () => void;
  onExportPdf?: () => void;
  onExportJson: () => void;
  language: 'he' | 'en';
  setLanguage: (lang: 'he' | 'en') => void;
}

const VIEW_TABS: { id: 'dashboard' | 'graph' | 'vault' | 'list'; icon: React.ElementType; labelHe: string; labelEn: string }[] = [
  { id: 'dashboard', icon: LayoutGrid, labelHe: 'פרויקטים', labelEn: 'Projects' },
  { id: 'graph', icon: Network, labelHe: 'עץ ויזואלי', labelEn: 'Visual Tree' },
  { id: 'vault', icon: Library, labelHe: 'מקורות', labelEn: 'Resource Vault' },
  { id: 'list', icon: ListTree, labelHe: 'שלבים', labelEn: 'Steps' },
];

export const Header: React.FC<HeaderProps> = ({
  currentTree,
  savedTreesCount,
  viewMode,
  setViewMode,
  onOpenNewModal,
  onToggleSidebar,
  onExportImage,
  onExportPdf,
  language,
  setLanguage,
}) => {
  const progress = currentTree ? calculateTreeProgress(currentTree) : null;

  return (
    <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur-md font-body">
      {/* Brand bar: identity + global actions, always one clean row */}
      <div className="border-b border-ink/10 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-[38px] h-[38px] rounded-full bg-accent flex items-center justify-center shrink-0">
              <GitFork className="w-[18px] h-[18px] text-paper rotate-90" strokeWidth={2.75} />
            </div>
            <h1 className="font-heading text-lg text-ink leading-none truncate">CogniTree</h1>
            {!currentTree && (
              <span className="hidden sm:inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border border-ink/20 text-ink/70 shrink-0">
                {language === 'he' ? 'עצי למידה חכמים' : 'AI Learning Trees'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Toggle */}
            <div className="flex items-center bg-panel border border-ink/10 rounded-full p-1 text-[11px] font-bold">
              <button
                onClick={() => setLanguage('he')}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  language === 'he' ? 'bg-accent text-paper' : 'text-ink/60 hover:text-ink'
                }`}
              >
                עב
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  language === 'en' ? 'bg-accent text-paper' : 'text-ink/60 hover:text-ink'
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={onToggleSidebar}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-ink/15 text-xs font-semibold text-ink hover:bg-panel transition-colors relative"
            >
              <Bookmark className="w-4 h-4" strokeWidth={2.75} />
              <span>{language === 'he' ? 'שמורים' : 'Saved'}</span>
              {savedTreesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-accent text-paper text-[10px] font-bold">
                  {savedTreesCount}
                </span>
              )}
            </button>
            <button
              onClick={onToggleSidebar}
              className="sm:hidden p-2 rounded-full border border-ink/15 text-ink relative"
              title={language === 'he' ? 'נושאים שמורים בצד' : 'Saved Trees Vault'}
            >
              <Bookmark className="w-[18px] h-[18px]" strokeWidth={2.75} />
              {savedTreesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-paper text-[10px] font-bold flex items-center justify-center">
                  {savedTreesCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenNewModal}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full bg-accent hover:bg-accent-700 text-paper font-heading text-sm transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" strokeWidth={2.75} />
              <span className="hidden sm:inline">{language === 'he' ? 'נושא חדש' : 'New Tree'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Context bar: only shown once a tree is active - views, topic, progress, exports */}
      {currentTree && progress && (
        <div className="border-b border-ink/10 bg-panel/40 px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto scrollbar-none">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-panel border border-ink/10 rounded-full p-1 shrink-0">
              {VIEW_TABS.map(({ id, icon: Icon, labelHe, labelEn }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-heading text-[13px] transition-colors whitespace-nowrap ${
                    viewMode === id ? 'bg-accent text-paper' : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.75} />
                  <span>{language === 'he' ? labelHe : labelEn}</span>
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Current Topic + Progress */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0 min-w-0">
              <div className="w-9 h-9 shrink-0">
                <svg className="transform -rotate-90 overflow-visible" width="36" height="36">
                  <circle cx="18" cy="18" r="14.5" strokeWidth="3.5" className="stroke-ink/10" fill="transparent" />
                  <circle
                    cx="18" cy="18" r="14.5" strokeWidth="3.5"
                    className={progress.percentage === 100 ? 'stroke-sage-500' : 'stroke-accent'}
                    strokeDasharray={2 * Math.PI * 14.5}
                    strokeDashoffset={2 * Math.PI * 14.5 * (1 - progress.percentage / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink truncate max-w-[200px]">{currentTree.topic}</p>
                <p className="text-[11px] text-ink/60">
                  {progress.percentage}% &middot; {progress.completedItems}/{progress.totalItems} {language === 'he' ? 'הושלמו' : 'done'}
                </p>
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {onExportPdf && (
                <button
                  onClick={onExportPdf}
                  className="p-2 rounded-full text-ink/60 hover:text-ink hover:bg-panel transition-colors"
                  title={language === 'he' ? 'ייצא מסמך PDF מקיף עם פירוט נושאים וקישורים פעילים' : 'Export comprehensive PDF document with topics breakdown & hyperlinks'}
                >
                  <FileText className="w-4 h-4" strokeWidth={2.75} />
                </button>
              )}
              <button
                onClick={onExportImage}
                className="p-2 rounded-full text-ink/60 hover:text-ink hover:bg-panel transition-colors"
                title={language === 'he' ? 'ייצא את עץ הלמידה כתמונה ברזולוציה גבוהה' : 'Export tree as image'}
              >
                <Download className="w-4 h-4" strokeWidth={2.75} />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
