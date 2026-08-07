import React, { useState } from 'react';
import { LearningTree } from '../types';
import { calculateTreeProgress } from '../lib/treeStore';
import { Network, Trash2, Calendar, Plus, AlertCircle, X, CheckCircle2, CheckCircle, BarChart2, BookOpen, FileText } from 'lucide-react';

interface DashboardViewProps {
  savedTrees: LearningTree[];
  activeTreeId: string | null;
  onSelectTree: (tree: LearningTree) => void;
  onDeleteTree: (treeId: string) => void;
  onOpenNewModal: () => void;
  onExportPdf?: (tree: LearningTree) => void;
  language?: 'he' | 'en';
}

// Progress color bands per the Organic design tokens: sage once complete, accent while
// meaningfully underway, sand while barely started - matches the mockup's ring/bar logic.
function progressBand(pct: number): { stroke: string; bar: string } {
  if (pct === 100) return { stroke: 'stroke-sage-500', bar: 'bg-sage-500' };
  if (pct >= 40) return { stroke: 'stroke-accent', bar: 'bg-accent' };
  return { stroke: 'stroke-sand-400', bar: 'bg-sand-400' };
}

const DashProgressRing: React.FC<{ percentage: number; size: number; strokeWidth: number }> = ({ percentage, size, strokeWidth }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;
  const { stroke } = progressBand(percentage);

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" style={{ overflow: 'visible' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-ink/10" fill="transparent" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth}
        className={`${stroke} transition-all duration-700 ease-out`}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        fill="transparent"
      />
    </svg>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  savedTrees,
  activeTreeId,
  onSelectTree,
  onDeleteTree,
  onOpenNewModal,
  onExportPdf,
  language = 'he',
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Overall Statistics Calculation
  const totalProjects = savedTrees.length;
  const completedProjects = savedTrees.filter(t => calculateTreeProgress(t).percentage === 100).length;
  const avgCompletion = totalProjects > 0
    ? Math.round(savedTrees.reduce((acc, t) => acc + calculateTreeProgress(t).percentage, 0) / totalProjects)
    : 0;
  const totalTasksCompleted = savedTrees.reduce((acc, t) => acc + calculateTreeProgress(t).completedItems, 0);
  const totalTasks = savedTrees.reduce((acc, t) => acc + calculateTreeProgress(t).totalItems, 0);

  return (
    <div className="flex-1 overflow-auto bg-paper font-body">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-9 pb-16">

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="font-heading text-[28px] sm:text-[32px] text-ink leading-tight mb-1">
              {language === 'he' ? 'עצי הלמידה שלך' : 'Your learning trees'}
            </h1>
            <p className="text-ink/60 text-sm">
              {language === 'he' ? 'כל נושא שאתה מפתח, וכמה התקדמת בו.' : "Every topic you're growing, and how far each has come."}
            </p>
          </div>

          <button
            onClick={onOpenNewModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-700 text-paper rounded-full font-heading text-sm transition-colors active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.75} />
            {language === 'he' ? 'צור עץ חדש' : 'New Tree'}
          </button>
        </div>

        {/* Overall Statistics Banner */}
        {savedTrees.length > 0 && (
          <div className="bg-panel/50 border border-ink/10 rounded-card shadow-elev-sm flex flex-col sm:flex-row items-stretch sm:items-center mb-7 overflow-hidden">
            <div className="flex-1 flex items-center gap-4 px-6 py-5 border-b sm:border-b-0 ltr:sm:border-r rtl:sm:border-l border-ink/10">
              <DashProgressRing percentage={avgCompletion} size={56} strokeWidth={6} />
              <div>
                <div className="text-[11px] font-semibold text-ink/50 uppercase tracking-wider">
                  {language === 'he' ? 'ממוצע התקדמות' : 'Average progress'}
                </div>
                <div className="font-heading text-2xl text-ink mt-0.5">{avgCompletion}%</div>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-3.5 px-6 py-5 border-b sm:border-b-0 ltr:sm:border-r rtl:sm:border-l border-ink/10">
              <div className="w-11 h-11 rounded-full bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" strokeWidth={2.75} />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-ink/50 uppercase tracking-wider">
                  {language === 'he' ? 'פרויקטים שהושלמו' : 'Completed trees'}
                </div>
                <div className="font-heading text-2xl text-ink mt-0.5">
                  {completedProjects} <span className="font-body text-[13px] text-ink/50">/ {totalProjects}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-3.5 px-6 py-5">
              <div className="w-11 h-11 rounded-full bg-accent-100 text-accent-800 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" strokeWidth={2.75} />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-ink/50 uppercase tracking-wider">
                  {language === 'he' ? 'משימות ומשאבים' : 'Tasks & resources done'}
                </div>
                <div className="font-heading text-2xl text-ink mt-0.5">
                  {totalTasksCompleted} <span className="font-body text-[13px] text-ink/50">/ {totalTasks}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Trees Grid */}
        {savedTrees.length === 0 ? (
          <div className="bg-panel/40 border border-ink/10 rounded-card p-14 text-center space-y-3">
            <BarChart2 className="w-10 h-10 text-ink/25 mx-auto" strokeWidth={2.25} />
            <p className="font-medium text-ink/60">
              {language === 'he' ? 'אין לך פרויקטים כרגע. צור את הפרויקט הראשון שלך!' : "You don't have any projects yet. Create your first one!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedTrees.map((tree) => {
              const progress = calculateTreeProgress(tree);
              const isActive = tree.id === activeTreeId;
              const dateObj = new Date(tree.createdAt);
              const dateString = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
              const { bar } = progressBand(progress.percentage);

              return (
                <div
                  key={tree.id}
                  className={`bg-panel/40 border rounded-card shadow-elev-sm overflow-hidden transition-all duration-200 flex flex-col ${
                    isActive ? 'border-accent' : 'border-ink/10 hover:border-accent-300 hover:shadow-elev-md'
                  }`}
                >
                  <div className="p-5 flex-1 cursor-pointer" onClick={() => onSelectTree(tree)}>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 ${isActive ? 'bg-accent-100 text-accent-800' : 'bg-sand-100 text-sand-700'}`}>
                          <Network className="w-4 h-4" strokeWidth={2.75} />
                        </div>
                        {isActive && (
                          <span className="text-[10px] font-bold text-accent-800 bg-accent-100 px-2.5 py-1 rounded-full">
                            {language === 'he' ? 'פעיל' : 'Active'}
                          </span>
                        )}
                      </div>

                      <DashProgressRing percentage={progress.percentage} size={46} strokeWidth={4.5} />
                    </div>

                    <h3 className="font-heading text-[17px] text-ink line-clamp-2 mb-1.5" title={tree.topic}>
                      {tree.topic}
                    </h3>

                    {tree.description && (
                      <p className="text-[13px] text-ink/65 line-clamp-2 mb-4">
                        {tree.description}
                      </p>
                    )}

                    <div className="mt-auto pt-2 space-y-1.5">
                      <div className="flex justify-between text-[11px] text-ink/55 font-medium">
                        <span>{language === 'he' ? 'משימות הושלמו:' : 'Tasks completed:'}</span>
                        <span className="font-bold text-ink">
                          {progress.completedItems}/{progress.totalItems}
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-ink/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${bar}`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-5 py-3 border-t border-ink/10 flex items-center justify-between">
                    {deleteConfirmId === tree.id ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-red-700 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {language === 'he' ? 'למחוק?' : 'Delete?'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="p-1.5 text-ink/50 hover:bg-panel rounded-full"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTree(tree.id);
                              setDeleteConfirmId(null);
                            }}
                            className="p-1.5 bg-red-700 text-paper rounded-full hover:bg-red-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5 text-[11px] text-ink/45">
                          <Calendar className="w-3.5 h-3.5" strokeWidth={2.75} />
                          {dateString}
                        </span>

                        <div className="flex items-center gap-1">
                          {onExportPdf && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExportPdf(tree);
                              }}
                              className="p-1.5 text-ink/40 hover:text-accent-700 hover:bg-panel rounded-full transition-colors"
                              title={language === 'he' ? 'ייצא מסמך PDF מפורט עם קישורים' : 'Export PDF document with hyperlinks'}
                            >
                              <FileText className="w-4 h-4" strokeWidth={2.75} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(tree.id);
                            }}
                            className="p-1.5 text-ink/40 hover:text-red-700 hover:bg-panel rounded-full transition-colors"
                            title={language === 'he' ? 'מחק עץ' : 'Delete tree'}
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2.75} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
