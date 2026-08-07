import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, Check, AlertCircle, Trash2, X, ExternalLink, Loader2 } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, validateApiKey } from '../lib/apiKeyStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
  language: 'he' | 'en';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onKeySaved, language }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadKey();
    }
  }, [isOpen]);

  const loadKey = async () => {
    const key = await getStoredApiKey();
    setApiKey(key);
    setStatusMessage(null);
  };

  const t = (he: string, en: string) => (language === 'he' ? he : en);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'error', text: t('אנא הזן מפתח API תקין', 'Please enter a valid API key') });
      return;
    }

    setIsValidating(true);
    setStatusMessage({ type: 'info', text: t('מאמת מפתח מול שרתי Google Gemini...', 'Validating key against Google Gemini servers...') });

    const result = await validateApiKey(apiKey);
    setIsValidating(false);

    if (result.valid) {
      await setStoredApiKey(apiKey);
      setStatusMessage({ type: 'success', text: t('מפתח ה-API נאמת ונשמר בהצלחה במכשיר!', 'API key validated and saved to this device!') });
      if (onKeySaved) onKeySaved();
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: `${t('אימות המפתח נכשל', 'Key validation failed')}: ${result.message}` });
    }
  };

  const handleClear = async () => {
    await clearStoredApiKey();
    setApiKey('');
    setStatusMessage({ type: 'info', text: t('מפתח ה-API נמחק בהצלחה מהמכשיר.', 'API key removed from this device.') });
    if (onKeySaved) onKeySaved();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/35 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-ink/10 rounded-dialog w-full max-w-lg shadow-elev-lg overflow-hidden flex flex-col max-h-[90vh] font-body"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-4.5 h-4.5" strokeWidth={2.75} />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-base text-ink">{t('הגדרות מפתח Gemini API', 'Gemini API Key Settings')}</h2>
              <p className="text-xs text-ink/55">{t('אבטחה וחיבור ישיר למודל AI', 'Secure, direct connection to the AI model')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-ink/50 hover:text-ink hover:bg-panel transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2.75} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Security Banner */}
          <div className="flex items-start gap-3 p-3.5 bg-sage-100 border border-sage-300 rounded-panel text-sage-800 text-xs">
            <ShieldCheck className="w-5 h-5 shrink-0 text-sage-600 mt-0.5" strokeWidth={2.5} />
            <div>
              <strong className="font-semibold block mb-0.5 text-sage-900">
                {t('אבטחה מלאה ללא דליפות', 'Fully secure, no leaks')}
              </strong>
              {t(
                'מפתח ה-API שלך נשמר בצורה מוצפנת ומקומית בלבד במכשיר שלך. כל הפניות נשלחות ישירות מהמכשיר לשרתי Google הרשמיים בלבד (generativelanguage.googleapis.com).',
                'Your API key is stored locally and securely on this device only. Requests go directly from your device to Google’s official servers (generativelanguage.googleapis.com).'
              )}
            </div>
          </div>

          {/* API Key Input */}
          <div className="field">
            <label className="block text-xs font-semibold text-ink/70 mb-2">
              {t('מפתח Gemini API (של Google AI Studio)', 'Gemini API Key (from Google AI Studio)')}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                dir="ltr"
                className={`w-full bg-panel/40 border border-ink/15 rounded-full px-4 py-3 text-sm font-mono text-ink placeholder-ink/35 focus:outline-none focus:border-accent transition-all ${
                  language === 'he' ? 'pl-11' : 'pr-11'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className={`absolute top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink transition-colors ${
                  language === 'he' ? 'left-3.5' : 'right-3.5'
                }`}
              >
                {showKey ? <EyeOff className="w-4 h-4" strokeWidth={2.5} /> : <Eye className="w-4 h-4" strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-panel text-xs border ${
                statusMessage.type === 'success'
                  ? 'bg-sage-100 border-sage-300 text-sage-800'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-accent-100 border-accent-300 text-accent-800'
              }`}
            >
              {statusMessage.type === 'success' && <Check className="w-4 h-4 text-sage-600 shrink-0" strokeWidth={2.5} />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" strokeWidth={2.5} />}
              {statusMessage.type === 'info' && <Loader2 className="w-4 h-4 text-accent-700 shrink-0 animate-spin" strokeWidth={2.5} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Link to Get API Key */}
          <div className="text-xs text-ink/55 flex items-center justify-between gap-2 flex-wrap">
            <span>{t('אין לך מפתח API עדיין?', 'Don’t have an API key yet?')}</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-700 hover:text-accent-800 font-semibold inline-flex items-center gap-1 hover:underline"
            >
              {t('הפק מפתח בחינם ב-Google AI Studio', 'Get a free key from Google AI Studio')}
              <ExternalLink className="w-3 h-3" strokeWidth={2.5} />
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-panel/40 border-t border-ink/10 shrink-0">
          <button
            onClick={handleClear}
            disabled={!apiKey || isValidating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
            {t('מחק מפתח', 'Clear key')}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-ink hover:bg-panel rounded-full transition-colors"
            >
              {t('ביטול', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isValidating || !apiKey.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-heading text-xs bg-accent hover:bg-accent-700 text-paper disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('מאמת...', 'Validating...')}
                </>
              ) : (
                t('אימות ושמירה', 'Validate & Save')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
