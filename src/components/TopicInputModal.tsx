import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, Search, Shuffle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/35 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-paper border border-ink/10 rounded-dialog w-full max-w-xl shadow-elev-lg overflow-hidden flex flex-col max-h-[90vh] font-body" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5" strokeWidth={2.75} />
            </div>
            <div>
              <h2 className="font-heading text-base text-ink">{language === 'he' ? 'צור עץ למידה חדש' : 'Start a new learning tree'}</h2>
              <p className="text-xs text-ink/55">{language === 'he' ? 'CogniTree AI יבנה מפה ויזואלית עם מקורות מחקריים מאומתים' : 'CogniTree AI will generate a visual map with verified learning resources'}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-2 rounded-full text-ink/50 hover:text-ink hover:bg-panel transition-colors shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={2.75} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Main Topic Input */}
          <div className="field">
            <label className="block text-xs font-semibold text-ink/70 mb-2">
              {language === 'he' ? 'מהו הנושא או התחום שתרצה להעמיק וללמוד?' : 'Topic'} <span className="text-accent-700">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={language === 'he' ? "למשל: יסודות הבינה המלאכותית, אסטרופיזיקה, תיאוריה מוזיקלית..." : "e.g. Distributed Systems, Behavioral Economics..."}
                disabled={isLoading}
                className={`w-full bg-panel/40 border border-ink/15 rounded-full px-4 py-3 text-sm text-ink placeholder-ink/40 focus:outline-none focus:border-accent transition-all ${language === 'he' ? 'pr-10' : 'pl-10'}`}
                autoFocus
                dir="auto"
              />
              <Search className={`w-4 h-4 text-ink/35 absolute top-3.5 ${language === 'he' ? 'right-3.5' : 'left-3.5'}`} strokeWidth={2.5} />
            </div>
          </div>

          {/* Preset Recommendation Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-[11px] font-medium text-ink/50">
                {language === 'he' ? 'או בחר מתוך נושאים פופולריים:' : 'Or choose from popular topics:'}
              </span>
              <button
                type="button"
                onClick={shufflePresets}
                disabled={isLoading}
                className="flex items-center gap-1 text-[10px] text-accent-700 hover:text-accent-800 font-medium px-2.5 py-1 bg-accent-100 hover:bg-accent-200 rounded-full transition-colors"
              >
                <Shuffle className="w-3 h-3" strokeWidth={2.75} />
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
                  className={`text-right rtl:text-right ltr:text-left p-2.5 rounded-panel border text-xs transition-all ${
                    topic === preset.label
                      ? 'bg-accent-100 border-accent-300 text-accent-900 font-bold'
                      : 'bg-panel/40 border-ink/10 text-ink/80 hover:border-accent-300'
                  }`}
                >
                  <div className="font-semibold">{preset.label}</div>
                  <div className="text-[10px] text-ink/50 mt-0.5 truncate">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Depth Level Selector */}
          <div className="field">
            <label className="block text-xs font-semibold text-ink/70 mb-2">
              {language === 'he' ? 'רמת מורכבות והיקף העץ:' : 'Depth'}
            </label>
            <div className="flex bg-panel border border-ink/10 rounded-full p-1">
              {[
                { id: 'basic', label: language === 'he' ? 'בסיסי' : 'Basic', desc: language === 'he' ? '4-5 שלבים' : '4-5 steps' },
                { id: 'comprehensive', label: language === 'he' ? 'מקיף' : 'Comprehensive', desc: language === 'he' ? '6-8 שלבים' : '6-8 steps' },
                { id: 'mastery', label: language === 'he' ? 'שליטה מוחלטת' : 'Mastery', desc: language === 'he' ? '8+ שלבים' : '8+ steps' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setDepthLevel(lvl.id as any)}
                  disabled={isLoading}
                  className={`flex-1 py-2 rounded-full text-center transition-colors font-heading ${
                    depthLevel === lvl.id ? 'bg-accent text-paper' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  <div className="text-xs">{lvl.label}</div>
                  <div className={`text-[10px] mt-0.5 font-body ${depthLevel === lvl.id ? 'text-paper/75' : 'text-ink/40'}`}>{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom instructions */}
          <div className="field">
            <label className="block text-xs font-semibold text-ink/70 mb-1.5">
              {language === 'he' ? 'הנחיות מיוחדות (אופציונלי):' : 'Custom instructions (optional)'}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={language === 'he' ? "למשל: התמקד בקורסים חינמיים בעברית ובאנגלית, ערוצי יוטיוב אקדמיים וספרים מומלצים למתחילים..." : "Focus areas, prior knowledge to assume, tone..."}
              rows={2}
              disabled={isLoading}
              className="w-full bg-panel/40 border border-ink/15 rounded-panel p-3 text-xs text-ink placeholder-ink/40 focus:outline-none focus:border-accent"
              dir="auto"
            />
          </div>

          {/* Footer actions / Loading State */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-ink/10">
            {!isLoading && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-ink/60 hover:text-ink hover:bg-panel transition-colors"
              >
                {language === 'he' ? 'ביטול' : 'Cancel'}
              </button>
            )}

            <button
              type="submit"
              disabled={!topic.trim() || isLoading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-heading text-xs transition-all ${
                !topic.trim() || isLoading
                  ? 'bg-panel text-ink/35 cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-700 text-paper active:scale-95'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'he' ? 'AI מחפש ובונה עץ ידע...' : 'AI is building the knowledge tree...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" strokeWidth={2.75} />
                  <span>{language === 'he' ? 'צור עץ למידה' : 'Generate tree'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
