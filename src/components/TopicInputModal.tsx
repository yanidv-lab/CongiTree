import React, { useState, useEffect } from 'react';
import { Sparkles, X, BookOpen, Layers, Compass, Loader2, Search, CheckCircle2, Shuffle } from 'lucide-react';

interface TopicInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (topic: string, depthLevel: 'basic' | 'comprehensive' | 'mastery', customInstructions: string) => void;
  isLoading: boolean;
  language: 'he' | 'en';
}

const ALL_PRESET_TOPICS_HE = [
  { label: 'אינטליגנציה מלאכותית ולמידת מכונה', desc: 'מתמטיקה, Python, למידה עמוקה ו-LLMs' },
  { label: 'פיתוח אפליקציות Web מקצה לקצה', desc: 'React, Node.js, בסיסי נתונים ו-Cloud' },
  { label: 'פיזיקה קוונטית ואסטרופיזיקה', desc: 'מכניקת קוונטים, חורים שחורים ויחסות' },
  { label: 'נגינה בגיטרה ותיאוריית מוזיקה', desc: 'סולמות, אקורדים, תווים ואימון שמיעה' },
  { label: 'כלכלה התנהגותית ומדעי הנתונים', desc: 'קבלת החלטות, סטטיסטיקה וקבלת נתונים' },
  { label: 'עריכת וידאו ואפקטים קולנועיים', desc: 'Premiere, After Effects וקומפוזיציה' },
  { label: 'פסיכולוגיה קוגניטיבית', desc: 'זיכרון, תפיסה, קשב ופתרון בעיות' },
  { label: 'שפות תכנות מערכות', desc: 'C, C++, Rust וניהול זיכרון' },
  { label: 'היסטוריה של המזרח התיכון', desc: 'אימפריות, דתות, ותמורות גיאו-פוליטיות' },
  { label: 'בישול ואמנות קולינרית', desc: 'טכניקות יסוד, רטבים, פיתוח טעמים וצלחות' },
  { label: 'אנימציה בתלת מימד ו-CGI', desc: 'Blender, Maya, מידול וריג' },
  { label: 'ניהול מוצר וטכנולוגיה', desc: 'אסטרטגיה, מדדים, אפיון חווית משתמש ופיתוח' }
];

const ALL_PRESET_TOPICS_EN = [
  { label: 'Artificial Intelligence & Machine Learning', desc: 'Math, Python, Deep Learning & LLMs' },
  { label: 'End-to-End Web App Development', desc: 'React, Node.js, Databases & Cloud' },
  { label: 'Quantum Physics & Astrophysics', desc: 'Quantum Mechanics, Black Holes & Relativity' },
  { label: 'Guitar Playing & Music Theory', desc: 'Scales, Chords, Notes & Ear Training' },
  { label: 'Behavioral Economics & Data Science', desc: 'Decision Making, Statistics & Data' },
  { label: 'Video Editing & VFX', desc: 'Premiere, After Effects & Composition' },
  { label: 'Cognitive Psychology', desc: 'Memory, Perception, Attention & Problem Solving' },
  { label: 'Systems Programming Languages', desc: 'C, C++, Rust & Memory Management' },
  { label: 'History of the Middle East', desc: 'Empires, Religions, and Geopolitical Shifts' },
  { label: 'Cooking & Culinary Arts', desc: 'Basic Techniques, Sauces, Flavor & Plating' },
  { label: '3D Animation & CGI', desc: 'Blender, Maya, Modeling & Rigging' },
  { label: 'Product & Tech Management', desc: 'Strategy, Metrics, UX & Development' }
];

export const TopicInputModal: React.FC<TopicInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  language,
}) => {
  const [topic, setTopic] = useState('');
  const [depthLevel, setDepthLevel] = useState<'basic' | 'comprehensive' | 'mastery'>('comprehensive');
  const [customInstructions, setCustomInstructions] = useState('');
  
  const currentPresets = language === 'he' ? ALL_PRESET_TOPICS_HE : ALL_PRESET_TOPICS_EN;
  const [displayedPresets, setDisplayedPresets] = useState(currentPresets.slice(0, 6));

  // Reset/Shuffle when modal opens or language changes
  useEffect(() => {
    if (isOpen) {
      shufflePresets();
    }
  }, [isOpen, language]);

  const shufflePresets = () => {
    const shuffled = [...currentPresets].sort(() => 0.5 - Math.random());
    setDisplayedPresets(shuffled.slice(0, 6));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;
    onSubmit(topic.trim(), depthLevel, customInstructions.trim());
  };

  const handleSelectPreset = (presetTopic: string) => {
    setTopic(presetTopic);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{language === 'he' ? 'צור עץ למידה חדש' : 'Create New Learning Tree'}</h2>
              <p className="text-xs text-slate-500">{language === 'he' ? 'CogniTree AI יבנה מפה ויזואלית עם מקורות מחקריים מאומתים' : 'CogniTree AI will generate a visual map with verified learning resources'}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Main Topic Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {language === 'he' ? 'מהו הנושא או התחום שתרצה להעמיק וללמוד?' : 'What topic or domain would you like to master?'} <span className="text-indigo-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={language === 'he' ? "למשל: יסודות הבינה המלאכותית, אסטרופיזיקה, תיאוריה מוזיקלית..." : "e.g. Artificial Intelligence Basics, Astrophysics, Music Theory..."}
                disabled={isLoading}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs ${language === 'he' ? 'pr-10' : 'pl-10'}`}
                autoFocus
                dir="auto"
              />
              <Search className={`w-4 h-4 text-slate-400 absolute top-3.5 ${language === 'he' ? 'right-3.5' : 'left-3.5'}`} />
            </div>
          </div>

          {/* Preset Recommendation Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-[11px] font-medium text-slate-500">
                {language === 'he' ? 'או בחר מתוך נושאים פופולריים:' : 'Or choose from popular topics:'}
              </span>
              <button
                type="button"
                onClick={shufflePresets}
                disabled={isLoading}
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
              >
                <Shuffle className="w-3 h-3" />
                {language === 'he' ? 'רענן הצעות' : 'Shuffle Options'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayedPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset.label)}
                  disabled={isLoading}
                  className={`text-right p-2.5 rounded-xl border text-xs transition-all ${
                    topic === preset.label
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-100 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold">{preset.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Depth Level Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {language === 'he' ? 'רמת מורכבות והיקף העץ:' : 'Complexity and Scope:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'basic', label: language === 'he' ? 'ממוקד / בסיסי' : 'Basic', desc: language === 'he' ? '4-5 שלבים יסודיים' : '4-5 core steps' },
                { id: 'comprehensive', label: language === 'he' ? 'מקיף (מומלץ)' : 'Comprehensive', desc: language === 'he' ? '6-8 שלבים מפורטים' : '6-8 detailed steps' },
                { id: 'mastery', label: language === 'he' ? 'שליטה מוחלטת' : 'Mastery', desc: language === 'he' ? '8+ שלבים מעמיקים' : '8+ deep steps' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setDepthLevel(lvl.id as any)}
                  disabled={isLoading}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    depthLevel === lvl.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold ring-2 ring-indigo-100'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-medium">{lvl.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom instructions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {language === 'he' ? 'הנחיות מיוחדות (אופציונלי):' : 'Custom Instructions (Optional):'}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={language === 'he' ? "למשל: התמקד בקורסים חינמיים בעברית ובאנגלית, ערוצי יוטיוב אקדמיים וספרים מומלצים למתחילים..." : "e.g. Focus on free courses, academic YouTube channels, and books for beginners..."}
              rows={2}
              disabled={isLoading}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              dir="auto"
            />
          </div>

          {/* Footer actions / Loading State */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            {!isLoading && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                {language === 'he' ? 'ביטול' : 'Cancel'}
              </button>
            )}

            <button
              type="submit"
              disabled={!topic.trim() || isLoading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                !topic.trim() || isLoading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{language === 'he' ? 'AI מחפש ובונה עץ ידע...' : 'AI is building the knowledge tree...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>{language === 'he' ? 'צור עץ למידה' : 'Create Tree'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
