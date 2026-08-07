import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  CheckSquare, 
  Square, 
  ExternalLink, 
  GitBranchPlus, 
  BookOpen, 
  Youtube, 
  GraduationCap, 
  Award,
  ChevronLeft
} from 'lucide-react';
import { LearningTree, TreeNode } from '../types';

interface StepListViewProps {
  tree: LearningTree;
  onSelectNode: (node: TreeNode) => void;
  onToggleItem: (nodeId: string, itemId: string) => void;
  onToggleResource: (nodeId: string, resourceId: string) => void;
  onExpandNode: (node: TreeNode) => void;
  isLoadingExpand?: boolean;
  language?: 'he' | 'en';
}

export const StepListView: React.FC<StepListViewProps> = ({
  tree,
  onSelectNode,
  onToggleItem,
  onToggleResource,
  onExpandNode,
  isLoadingExpand = false,
  language = 'he',
}) => {
  const nodesList = Object.values(tree.nodes) as TreeNode[];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 text-slate-900 flex items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{language === 'he' ? 'מבנה שלבים מפורט ללמידה' : 'Detailed Step Structure'}</h2>
          <p className="text-xs text-slate-500">{language === 'he' ? 'תכנית עבודה טורית לעקוב אחר ההתקדמות מכל שלב לשלב' : 'Sequential work plan to track progress step-by-step'}</p>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="relative border-r-2 border-slate-200 mr-4 pr-6 space-y-8">
        {nodesList.map((node, index) => {
          const isCompleted = node.completed;
          const completedItemsCount = node.items.filter(i => i.completed).length;
          const completedResCount = node.resources.filter(r => r.completed).length;
          const totalCheckables = node.items.length + node.resources.length;
          const completedCheckables = completedItemsCount + completedResCount;

          return (
            <div key={node.id} className="relative">
              {/* Step Circle Marker */}
              <div
                className={`absolute -right-[35px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-slate-50 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white font-black'
                    : 'bg-slate-100 text-slate-500 border border-slate-300'
                }`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>

              {/* Node Card Container */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isCompleted
                  ? 'bg-emerald-50/60 border-2 border-emerald-500 shadow-sm'
                  : 'bg-white border-slate-200 shadow-xs hover:border-indigo-200'
              }`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        node.level === 'foundation' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        node.level === 'core' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        node.level === 'advanced' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>
                        {language === 'he' ? `שלב ${index + 1}` : `Step ${index + 1}`} • {
                          node.level === 'foundation' ? (language === 'he' ? 'יסודות' : 'Foundation') :
                          node.level === 'core' ? (language === 'he' ? 'ליבה' : 'Core') :
                          node.level === 'advanced' ? (language === 'he' ? 'מתקדם' : 'Advanced') : (language === 'he' ? 'התמחות' : 'Specialization')
                        }
                      </span>

                      {isCompleted && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {language === 'he' ? 'ענף הושלם' : 'Branch Completed'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{node.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{node.description}</p>
                  </div>

                  <button
                    onClick={() => onSelectNode(node)}
                    className={`flex items-center gap-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shrink-0 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors ${language === 'he' ? '' : 'flex-row-reverse'}`}
                  >
                    <span>{language === 'he' ? 'פתח פרטים' : 'Open Details'}</span>
                    <ChevronLeft className={`w-4 h-4 ${language === 'he' ? '' : 'rotate-180'}`} />
                  </button>
                </div>

                {/* Checklist Preview */}
                {node.items.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-xs font-bold text-slate-700">{language === 'he' ? 'יעדי למידה' : 'Learning Goals'} ({completedItemsCount}/{node.items.length}):</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {node.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onToggleItem(node.id, item.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer border ${
                            item.completed
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 line-through'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          {item.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 fill-emerald-500 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
