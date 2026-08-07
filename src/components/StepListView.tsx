import React from 'react';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
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

function levelTagClasses(level: TreeNode['level']): string {
  switch (level) {
    case 'foundation': return 'bg-sage-100 text-sage-800';
    case 'core': return 'bg-accent-100 text-accent-800';
    case 'advanced': return 'bg-sand-200 text-sand-800';
    case 'specialization': return 'border border-ink/20 text-ink/70';
    default: return 'border border-ink/20 text-ink/70';
  }
}

export const StepListView: React.FC<StepListViewProps> = ({
  tree,
  onSelectNode,
  onToggleItem,
  language = 'he',
}) => {
  const nodesList = Object.values(tree.nodes) as TreeNode[];

  return (
    <div className="flex-1 overflow-auto bg-paper font-body">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-9 pb-16">
        <div className="bg-panel/40 border border-ink/10 rounded-card p-5 mb-7">
          <h2 className="font-heading text-xl text-ink">{language === 'he' ? 'מבנה שלבים מפורט ללמידה' : 'Detailed Step Structure'}</h2>
          <p className="text-xs text-ink/55 mt-1">{language === 'he' ? 'תכנית עבודה טורית לעקוב אחר ההתקדמות מכל שלב לשלב' : 'Sequential work plan to track progress step-by-step'}</p>
        </div>

        {/* Timeline Steps */}
        <div className="relative border-r-2 border-ink/10 mr-4 pr-6 space-y-6">
          {nodesList.map((node, index) => {
            const isCompleted = node.completed;
            const completedItemsCount = node.items.filter(i => i.completed).length;

            return (
              <div key={node.id} className="relative">
                {/* Step Circle Marker */}
                <div
                  className={`absolute -right-[35px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-paper ${
                    isCompleted ? 'bg-sage-500 text-paper' : 'bg-panel text-ink/60 border border-ink/15'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} /> : index + 1}
                </div>

                {/* Node Card Container */}
                <div className={`p-5 rounded-card border transition-all ${
                  isCompleted ? 'bg-sage-100/50 border-sage-400' : 'bg-panel/40 border-ink/10 hover:border-accent-300'
                }`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelTagClasses(node.level)}`}>
                          {language === 'he' ? `שלב ${index + 1}` : `Step ${index + 1}`} &middot; {
                            node.level === 'foundation' ? (language === 'he' ? 'יסודות' : 'Foundation') :
                            node.level === 'core' ? (language === 'he' ? 'ליבה' : 'Core') :
                            node.level === 'advanced' ? (language === 'he' ? 'מתקדם' : 'Advanced') : (language === 'he' ? 'התמחות' : 'Specialization')
                          }
                        </span>

                        {isCompleted && (
                          <span className="text-[10px] font-bold text-paper bg-sage-500 px-2 py-0.5 rounded-full">
                            {language === 'he' ? 'ענף הושלם' : 'Branch Completed'}
                          </span>
                        )}
                      </div>

                      <h3 className="font-heading text-base text-ink">{node.title}</h3>
                      <p className="text-xs text-ink/60 mt-1 leading-relaxed">{node.description}</p>
                    </div>

                    <button
                      onClick={() => onSelectNode(node)}
                      className="flex items-center gap-1 text-xs font-heading text-accent-800 hover:bg-accent-200 shrink-0 bg-accent-100 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <span>{language === 'he' ? 'פתח פרטים' : 'Open Details'}</span>
                      <ChevronLeft className={`w-3.5 h-3.5 ${language === 'he' ? '' : 'rotate-180'}`} strokeWidth={2.75} />
                    </button>
                  </div>

                  {/* Checklist Preview */}
                  {node.items.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-ink/10 space-y-2">
                      <div className="text-xs font-bold text-ink/70">{language === 'he' ? 'יעדי למידה' : 'Learning Goals'} ({completedItemsCount}/{node.items.length}):</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {node.items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => onToggleItem(node.id, item.id)}
                            className={`flex items-center gap-2 p-2 rounded-panel text-xs cursor-pointer border transition-colors ${
                              item.completed
                                ? 'bg-sage-100/60 border-sage-300 text-ink line-through opacity-70'
                                : 'bg-paper border-ink/10 text-ink hover:border-accent-300'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border-[1.5px] ${
                              item.completed ? 'bg-sage-500 border-sage-500' : 'border-ink/25'
                            }`}>
                              {item.completed && <CheckCircle2 className="w-3 h-3 text-paper" strokeWidth={3} />}
                            </span>
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
    </div>
  );
};
