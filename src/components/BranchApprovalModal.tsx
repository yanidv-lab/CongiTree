import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Scissors, 
  Edit3, 
  BookOpen, 
  Youtube, 
  GraduationCap, 
  Check, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { TreeNode } from '../types';

interface ProposedBranchItem {
  node: TreeNode;
  approved: boolean;
  isEditing?: boolean;
}

interface BranchApprovalModalProps {
  parentTitle?: string;
  proposedNodes: TreeNode[];
  onConfirm: (approvedNodes: TreeNode[]) => void;
  onCancel: () => void;
  titleText?: string;
  subtitleText?: string;
  language?: 'he' | 'en';
}

export const BranchApprovalModal: React.FC<BranchApprovalModalProps> = ({
  parentTitle,
  proposedNodes,
  onConfirm,
  onCancel,
  titleText,
  subtitleText,
  language = 'he',
}) => {
  const isHe = language === 'he';

  const defaultTitle = isHe 
    ? "הצעת ענפי למידה לבחירה לאישור" 
    : "Proposed Learning Branches for Approval";
  const defaultSubtitle = isHe 
    ? "סמן ואשר את הענפים שמעניינים אותך. ענפים שלא תאשר ייגדעו ולא יתווספו לעץ." 
    : "Review and approve the branches you want. Unapproved branches will be pruned.";

  const displayTitle = titleText || defaultTitle;
  const displaySubtitle = subtitleText || defaultSubtitle;
  const [items, setItems] = useState<ProposedBranchItem[]>(() =>
    proposedNodes.map(node => ({ node: { ...node }, approved: true }))
  );

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const approvedCount = items.filter(i => i.approved).length;

  const handleToggleApprove = (index: number) => {
    setItems(prev =>
      prev.map((item, idx) =>
        idx === index ? { ...item, approved: !item.approved } : item
      )
    );
  };

  const handleSelectAll = () => {
    setItems(prev => prev.map(i => ({ ...i, approved: true })));
  };

  const handleRejectAll = () => {
    setItems(prev => prev.map(i => ({ ...i, approved: false })));
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    setItems(prev =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, node: { ...item.node, title: newTitle } }
          : item
      )
    );
  };

  const handleDescriptionChange = (index: number, newDesc: string) => {
    setItems(prev =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, node: { ...item.node, description: newDesc } }
          : item
      )
    );
  };

  const handleConfirm = () => {
    const approvedNodes = items.filter(i => i.approved).map(i => i.node);
    onConfirm(approvedNodes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 fill-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{displayTitle}</h2>
                {parentTitle && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {isHe ? 'תחת:' : 'Under:'} {parentTitle}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{displaySubtitle}</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-600 font-semibold">
            {approvedCount} {isHe ? `מתוך ${items.length} ענפים מאושרים להוספה` : `out of ${items.length} branches approved`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50 font-semibold transition-colors shadow-2xs"
            >
              {isHe ? 'אישור הכל' : 'Approve All'}
            </button>
            <button
              onClick={handleRejectAll}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 font-semibold transition-colors shadow-2xs flex items-center gap-1"
            >
              <Scissors className="w-3 h-3" />
              <span>{isHe ? 'גדע הכל' : 'Prune All'}</span>
            </button>
          </div>
        </div>

        {/* List of Proposed Branches */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.map((item, idx) => {
            const isApproved = item.approved;
            const node = item.node;
            const isExpanded = expandedIndex === idx;

            return (
              <div
                key={node.id || idx}
                className={`rounded-2xl border transition-all p-4 ${
                  isApproved
                    ? 'bg-white border-indigo-200 shadow-sm ring-2 ring-indigo-50/50'
                    : 'bg-slate-50/80 border-slate-200 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Branch Status Toggle & Info */}
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleApprove(idx)}
                      className={`mt-1 p-1 rounded-xl transition-all shrink-0 ${
                        isApproved
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                      }`}
                      title={isApproved ? 'ענף מאושר (לחץ לגדיעה)' : 'ענף גדוע (לחץ לאישור)'}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="w-6 h-6 fill-emerald-500 stroke-white" />
                      ) : (
                        <XCircle className="w-6 h-6" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          node.level === 'foundation' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                          node.level === 'core' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          node.level === 'advanced' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-teal-50 text-teal-700 border-teal-200'
                        }`}>
                          {node.level === 'foundation' ? 'יסודות' :
                           node.level === 'core' ? 'ליבה' :
                           node.level === 'advanced' ? 'מתקדם' : 'התמחות'}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {isApproved ? 'מאושר להוספה' : 'ענף גדוע / נדחה'}
                        </span>
                      </div>

                      {/* Editable or Displayed Title */}
                      <input
                        type="text"
                        value={node.title}
                        onChange={(e) => handleTitleChange(idx, e.target.value)}
                        className={`w-full text-base font-bold bg-transparent border-b border-transparent focus:border-indigo-500 focus:bg-slate-50 rounded px-1 py-0.5 text-slate-900 ${
                          !isApproved ? 'line-through text-slate-400' : ''
                        }`}
                      />

                      {/* Description */}
                      <textarea
                        value={node.description}
                        onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                        rows={2}
                        className="w-full text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 focus:bg-slate-50 rounded p-1 mt-1 leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Actions & Expand Details */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleApprove(idx)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                        isApproved
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isApproved ? 'גדע ענף זה' : 'אשר ענף זה'}
                    </button>

                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium mt-1"
                    >
                      <span>{isExpanded ? 'הסתר פרטים' : 'הצג יעדים ומקורות'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Items & Resources Preview */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 bg-slate-50/60 p-3 rounded-xl">
                    {/* Objectives */}
                    {node.items && node.items.length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 mb-1">יעדי למידה מוצעים:</div>
                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 pr-1">
                          {node.items.map((item, iIdx) => (
                            <li key={iIdx}>{item.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Resources */}
                    {node.resources && node.resources.length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 mb-1">מקורות לימוד שנמצאו:</div>
                        <div className="space-y-1.5">
                          {node.resources.map((res, rIdx) => (
                            <div key={rIdx} className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                              <div className="truncate">
                                <span className="font-semibold text-slate-800">{res.title}</span>
                                {res.provider && <span className="text-slate-500 font-normal"> ({res.provider})</span>}
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                {res.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            ביטול
          </button>

          <button
            onClick={handleConfirm}
            disabled={approvedCount === 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
              approvedCount === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>אשר {approvedCount} ענפים נבחרים והוסף לעץ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
