import React, { useState } from 'react';
import { X, GitBranchPlus, Plus, Sparkles, PlusCircle } from 'lucide-react';
import { TreeNode, NodeLevel, ResourceType, Resource } from '../types';

interface CustomBranchModalProps {
  parentNode: TreeNode;
  onAddSubNode: (parentNodeId: string, newNode: Partial<TreeNode>) => void;
  onClose: () => void;
  language?: 'he' | 'en';
}

export const CustomBranchModal: React.FC<CustomBranchModalProps> = ({
  parentNode,
  onAddSubNode,
  onClose,
  language = 'he',
}) => {
  const isHe = language === 'he';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<NodeLevel>('core');
  const [itemsRaw, setItemsRaw] = useState('');
  
  // Custom Resource input
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resProvider, setResProvider] = useState('');
  const [resType, setResType] = useState<ResourceType>('youtube');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Parse checklist items
    const itemsList = itemsRaw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((text, idx) => ({
        id: `custom_item_${Date.now()}_${idx}`,
        text,
        completed: false,
      }));

    // Parse optional resource
    const resourcesList: Resource[] = [];
    if (resTitle.trim()) {
      resourcesList.push({
        id: `custom_res_${Date.now()}`,
        title: resTitle.trim(),
        url: resUrl.trim() || `https://www.google.com/search?q=${encodeURIComponent(resTitle.trim())}`,
        provider: resProvider.trim() || (isHe ? 'מקור אישי' : 'Personal Resource'),
        type: resType,
        description: isHe ? 'מקור בלעדי שהוסיף הלומד לפיתוח הענף' : 'Custom source added by the learner',
        isVerifiedAcademic: true,
        completed: false,
      });
    }

    const newNodeData: Partial<TreeNode> = {
      title: title.trim(),
      description: description.trim() || (isHe ? `ענף מותאם אישית שנוצר תחת "${parentNode.title}"` : `Custom branch created under "${parentNode.title}"`),
      level,
      isBaseNode: false,
      parentId: parentNode.id,
      items: itemsList,
      resources: resourcesList,
    };

    onAddSubNode(parentNode.id, newNodeData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{isHe ? 'יצירת ענף מותאם אישית (פיתוח אישי)' : 'Create Custom Branch'}</h2>
              <p className="text-xs text-slate-500">{isHe ? `הוסף ענף למידה חדש ביוזמתך תחת: "${parentNode.title}"` : `Add a new learning branch under: "${parentNode.title}"`}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Branch Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {isHe ? 'שם הענף / תת-הנושא:' : 'Branch / Sub-Topic Title:'} <span className="text-indigo-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isHe ? "למשל: יישומים מעשיים, ניתוח מקרים, פרויקט גמר..." : "e.g. Practical Applications, Case Studies, Final Project..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              required
              autoFocus
            />
          </div>

          {/* Level Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">{isHe ? 'רמת מורכבות הענף:' : 'Complexity Level:'}</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'foundation', label: isHe ? 'יסודות' : 'Foundation' },
                { id: 'core', label: isHe ? 'ליבה' : 'Core' },
                { id: 'advanced', label: isHe ? 'מתקדם' : 'Advanced' },
                { id: 'specialization', label: isHe ? 'התמחות' : 'Specialization' },
              ].map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setLevel(lvl.id as NodeLevel)}
                  className={`py-2 rounded-xl border text-center font-bold transition-all ${
                    level === lvl.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-100'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">{isHe ? 'תיאור הענף ומהות הלימוד:' : 'Branch Description:'}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isHe ? "הסבר קצר מה נלמד בענף זה ולמה הוא חשוב..." : "Brief overview of what is taught in this branch..."}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Checklist Objectives */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {isHe ? 'יעדי למידה ותת-משימות (שורה נפרדת לכל יעד):' : 'Learning Goals (one per line):'}
            </label>
            <textarea
              value={itemsRaw}
              onChange={e => setItemsRaw(e.target.value)}
              placeholder={isHe ? "הבנת עקרונות היסוד\nביצוע תרגיל מעשי\nכתיבת סיכום אישי" : "Understand core principles\nComplete practical exercise\nWrite summary"}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Optional First Resource */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="font-bold text-slate-800">{isHe ? 'הוסף מקור לימוד מומלץ ראשון (אופציונלי):' : 'Add First Learning Source (Optional):'}</div>
            <input
              type="text"
              value={resTitle}
              onChange={e => setResTitle(e.target.value)}
              placeholder={isHe ? "שם המקור / הקורס / הספר..." : "Source, course or book title..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="url"
                value={resUrl}
                onChange={e => setResUrl(e.target.value)}
                placeholder={isHe ? "קישור URL (אם קיים)..." : "Direct URL link..."}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
              />
              <select
                value={resType}
                onChange={e => setResType(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
              >
                <option value="youtube">{isHe ? 'סרטון / ערוץ YouTube' : 'YouTube Video'}</option>
                <option value="course_free">{isHe ? 'קורס חינמי (edX/Coursera)' : 'Free Course (edX/Coursera)'}</option>
                <option value="course_paid">{isHe ? 'קורס בתשלום (Udemy)' : 'Paid Course (Udemy)'}</option>
                <option value="book">{isHe ? 'ספר אקדמי / eBook' : 'Textbook & eBook'}</option>
                <option value="article">{isHe ? 'מאמר / PDF' : 'Academic Paper / PDF'}</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              {isHe ? 'ביטול' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                !title.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
              }`}
            >
              {isHe ? 'צור ענף מותאם אישית' : 'Create Custom Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
