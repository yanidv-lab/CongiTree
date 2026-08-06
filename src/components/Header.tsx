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
  Sparkles,
  CheckCircle2,
  Share2
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

export const Header: React.FC<HeaderProps> = ({
  currentTree,
  savedTreesCount,
  viewMode,
  setViewMode,
  onOpenNewModal,
  onToggleSidebar,
  onExportImage,
  onExportPdf,
  onExportJson,
  language,
  setLanguage,
}) => {
  const progress = currentTree ? calculateTreeProgress(currentTree) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo & Current Subject Title */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black shadow-sm">
              <GitFork className="w-5 h-5 rotate-90" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                  CogniTree <span className="text-indigo-600 font-extrabold">AI</span>
                </h1>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {language === 'he' ? 'מפת למידה חכמה' : 'Smart Learning Map'}
                </span>
              </div>
              {currentTree ? (
                <p className="text-xs text-slate-500 truncate max-w-xs md:max-w-md mt-0.5">
                  {language === 'he' ? 'נושא:' : 'Topic:'} <span className="text-slate-800 font-semibold">{currentTree.topic}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">{language === 'he' ? 'בנה עץ ידע מבוסס מקורות מחקריים' : 'Build a research-backed knowledge tree'}</p>
              )}
            </div>
          </div>

          {/* Mobile buttons */}
          <div className="flex md:hidden items-center gap-2">
            {/* Language Switcher Mobile */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
              <button
                onClick={() => setLanguage('he')}
                className={`px-1.5 py-0.5 rounded ${language === 'he' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'}`}
              >
                עב
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-1.5 py-0.5 rounded ${language === 'en' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'}`}
              >
                EN
              </button>
            </div>

            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 relative"
              title={language === 'he' ? "נושאים שמורים בצד" : "Saved Trees Vault"}
            >
              <Bookmark className="w-5 h-5 text-indigo-600" />
              {savedTreesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {savedTreesCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenNewModal}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Progress Bar & View Selector */}
        {currentTree && progress && (
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-50 border border-slate-200 p-1.5 sm:px-3.5 sm:py-1.5 rounded-xl w-full md:w-auto justify-between md:justify-start overflow-x-auto scrollbar-none">
            {/* Overall Progress */}
            <div className="flex items-center gap-2 min-w-[140px] shrink-0">
              <div className="text-right">
                <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">{language === 'he' ? 'התקדמות' : 'Progress'}</div>
                <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <span>{progress.percentage}%</span>
                  <span className="text-[10px] text-slate-500 font-normal hidden sm:inline">
                    ({progress.completedItems}/{progress.totalItems})
                  </span>
                </div>
              </div>
              <div className="w-12 sm:w-16 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />

            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium shrink-0">
              <button
                onClick={() => setViewMode('dashboard')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  viewMode === 'dashboard'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'פרויקטים' : 'Projects'}</span>
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  viewMode === 'graph'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'עץ ויזואלי' : 'Visual Tree'}</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  viewMode === 'list'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'שלבים' : 'Steps'}</span>
              </button>
              <button
                onClick={() => setViewMode('vault')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  viewMode === 'vault'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'מקורות' : 'Vault'}</span>
              </button>
            </div>

            {/* Mobile Export Quick Buttons */}
            {currentTree && (
              <div className="flex md:hidden items-center gap-1 shrink-0 ml-1">
                {onExportPdf && (
                  <button
                    onClick={onExportPdf}
                    className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700"
                    title={language === 'he' ? "ייצא ל-PDF" : "Export PDF"}
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onExportImage}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700"
                  title={language === 'he' ? "ייצא תמונה" : "Export Image"}
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Language Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px] font-medium mr-2">
            <button
              onClick={() => setLanguage('he')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                language === 'he' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              עברית
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                language === 'en' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              EN
            </button>
          </div>

          {currentTree && (
            <>
              {onExportPdf && (
                <button
                  onClick={onExportPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 shadow-2xs transition-all hover:scale-105 active:scale-95"
                  title={language === 'he' ? "ייצא מסמך PDF מקיף עם פירוט נושאים וקישורים פעילים" : "Export comprehensive PDF document with topics breakdown & hyperlinks"}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'he' ? 'ייצוא ל-PDF' : 'Export PDF'}</span>
                </button>
              )}
              <button
                onClick={onExportImage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm transition-colors"
                title={language === 'he' ? "ייצא את עץ הלמידה כתמונה ברזולוציה גבוהה" : "Export tree as image"}
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'he' ? 'ייצוא תמונה' : 'Export Image'}</span>
              </button>
            </>
          )}

          <button
            onClick={onToggleSidebar}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm transition-colors relative"
          >
            <Bookmark className="w-4 h-4 text-indigo-600" />
            <span>{language === 'he' ? 'נושאים שמורים' : 'Saved Trees'}</span>
            {savedTreesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {savedTreesCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{language === 'he' ? 'נושא חדש' : 'New Tree'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
