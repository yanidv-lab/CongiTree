import React, { useState } from 'react';
import { LearningTree } from '../types';
import { calculateTreeProgress } from '../lib/treeStore';
import { Network, Trash2, Calendar, LayoutGrid, Plus, AlertCircle, X, CheckCircle2, CheckCircle, BarChart2, BookOpen, FileText } from 'lucide-react';

interface DashboardViewProps {
  savedTrees: LearningTree[];
  activeTreeId: string | null;
  onSelectTree: (tree: LearningTree) => void;
  onDeleteTree: (treeId: string) => void;
  onOpenNewModal: () => void;
  onExportPdf?: (tree: LearningTree) => void;
  language?: 'he' | 'en';
}

// Reusable Visual Progress Ring Component
export const ProgressRing: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  className?: string;
}> = ({ percentage, size = 52, strokeWidth = 5, showText = true, className = '' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  const getColors = (pct: number) => {
    if (pct === 100) return { stroke: 'stroke-emerald-500', text: 'text-emerald-700', bgTrack: 'stroke-emerald-100' };
    if (pct >= 50) return { stroke: 'stroke-indigo-600', text: 'text-indigo-700', bgTrack: 'stroke-indigo-100' };
    if (pct > 0) return { stroke: 'stroke-amber-500', text: 'text-amber-700', bgTrack: 'stroke-amber-100' };
    return { stroke: 'stroke-slate-300', text: 'text-slate-400', bgTrack: 'stroke-slate-100' };
  };

  const colors = getColors(percentage);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 overflow-visible" width={size} height={size}>
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colors.bgTrack} transition-colors duration-300`}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colors.stroke} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tracking-tighter">
          <span className={colors.text}>{percentage}%</span>
        </div>
      )}
    </div>
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
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-indigo-600" />
              {language === 'he' ? 'דשבורד פרויקטים' : 'Projects Dashboard'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {language === 'he' ? 'נהל את כל עצי הלמידה שלך ועקוב אחר התקדמות הלימוד' : 'Manage all your learning trees and track completion progress'}
            </p>
          </div>
          
          <button
            onClick={onOpenNewModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-sm font-medium transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            {language === 'he' ? 'צור עץ חדש' : 'New Tree'}
          </button>
        </div>

        {/* Overall Statistics Banner */}
        {savedTrees.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            {/* Average Progress Metric with Ring */}
            <div className="flex items-center gap-4 ltr:border-r rtl:border-l border-slate-100 sm:pr-4 sm:pl-4">
              <ProgressRing percentage={avgCompletion} size={64} strokeWidth={6} />
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {language === 'he' ? 'ממוצע התקדמות' : 'Average Progress'}
                </div>
                <div className="text-xl font-extrabold text-slate-900 flex items-baseline gap-1 mt-0.5">
                  {avgCompletion}%
                  <span className="text-xs font-normal text-slate-500">
                    {language === 'he' ? 'בכל העצים' : 'across projects'}
                  </span>
                </div>
              </div>
            </div>

            {/* Completed Projects Count */}
            <div className="flex items-center gap-3.5 ltr:border-r rtl:border-l border-slate-100 sm:pr-4 sm:pl-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {language === 'he' ? 'פרויקטים שהושלמו' : 'Completed Trees'}
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {completedProjects} <span className="text-xs font-normal text-slate-500">/ {totalProjects}</span>
                </div>
              </div>
            </div>

            {/* Total Tasks Done */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {language === 'he' ? 'משימות ומשאבים' : 'Tasks & Resources'}
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {totalTasksCompleted} <span className="text-xs font-normal text-slate-500">/ {totalTasks}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Trees Grid */}
        {savedTrees.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3">
            <BarChart2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-600">
              {language === 'he' ? 'אין לך פרויקטים כרגע. צור את הפרויקט הראשון שלך!' : "You don't have any projects yet. Create your first one!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {savedTrees.map((tree) => {
              const progress = calculateTreeProgress(tree);
              const isActive = tree.id === activeTreeId;
              const dateObj = new Date(tree.createdAt);
              const dateString = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');

              return (
                <div 
                  key={tree.id}
                  className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 flex flex-col ${
                    isActive 
                      ? 'border-indigo-400 shadow-md ring-2 ring-indigo-50' 
                      : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <div className="p-5 flex-1 cursor-pointer" onClick={() => onSelectTree(tree)}>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          <Network className="w-5 h-5" />
                        </div>
                        {isActive && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                            {language === 'he' ? 'פעיל' : 'Active'}
                          </span>
                        )}
                      </div>

                      {/* Visual Progress Ring Indicator */}
                      <ProgressRing percentage={progress.percentage} size={46} strokeWidth={4.5} />
                    </div>
                    
                    <h3 className="font-bold text-slate-900 line-clamp-2 text-sm mb-1.5" title={tree.topic}>
                      {tree.topic}
                    </h3>
                    
                    {tree.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                        {tree.description}
                      </p>
                    )}

                    {/* Progress Detail Metrics & Bar */}
                    <div className="mt-auto pt-2 space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                        <span>{language === 'he' ? 'משימות הושלמו:' : 'Tasks completed:'}</span>
                        <span className="font-bold text-slate-700">
                          {progress.completedItems}/{progress.totalItems}
                        </span>
                      </div>
                      
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            progress.percentage === 100 
                              ? 'bg-emerald-500' 
                              : progress.percentage >= 50 
                              ? 'bg-indigo-600' 
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions Footer */}
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    {deleteConfirmId === tree.id ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {language === 'he' ? 'למחוק?' : 'Delete?'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTree(tree.id);
                              setDeleteConfirmId(null);
                            }}
                            className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{dateString}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {onExportPdf && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExportPdf(tree);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                              title={language === 'he' ? 'ייצא מסמך PDF מפורט עם קישורים' : 'Export PDF document with hyperlinks'}
                            >
                              <FileText className="w-4 h-4 text-indigo-600" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(tree.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={language === 'he' ? 'מחק עץ' : 'Delete tree'}
                          >
                            <Trash2 className="w-4 h-4" />
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

