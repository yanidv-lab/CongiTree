import { Preferences } from '@capacitor/preferences';

export type LlmProvider = 'gemini' | 'openai' | 'anthropic';

const PROVIDER_STORAGE_KEY = 'congitree_llm_provider';
const API_KEY_STORAGE_PREFIX = 'congitree_secure_api_key_';
// Legacy key from before multi-provider support - still read as a fallback so users who saved a
// Gemini key before this change don't get logged out of standalone mode after an app update.
const LEGACY_GEMINI_KEY = 'congitree_secure_gemini_api_key';

export const DEFAULT_PROVIDER: LlmProvider = 'gemini';

export const PROVIDER_INFO: Record<LlmProvider, { label: string; keyPlaceholder: string; getKeyUrl: string; getKeyLabel: { he: string; en: string } }> = {
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIzaSy...',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    getKeyLabel: { he: 'הפק מפתח בחינם ב-Google AI Studio', en: 'Get a free key from Google AI Studio' },
  },
  openai: {
    label: 'OpenAI (GPT)',
    keyPlaceholder: 'sk-...',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    getKeyLabel: { he: 'הפק מפתח ב-OpenAI Platform', en: 'Get a key from the OpenAI Platform' },
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    keyPlaceholder: 'sk-ant-...',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    getKeyLabel: { he: 'הפק מפתח ב-Anthropic Console', en: 'Get a key from the Anthropic Console' },
  },
};

function storageKeyFor(provider: LlmProvider): string {
  return `${API_KEY_STORAGE_PREFIX}${provider}`;
}

/**
 * Read the currently selected LLM provider (defaults to Gemini for backwards compatibility).
 */
export async function getStoredProvider(): Promise<LlmProvider> {
  try {
    const { value } = await Preferences.get({ key: PROVIDER_STORAGE_KEY });
    if (value === 'gemini' || value === 'openai' || value === 'anthropic') return value;
  } catch (err) {
    // Fallback to localStorage below
  }

  try {
    const localVal = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (localVal === 'gemini' || localVal === 'openai' || localVal === 'anthropic') return localVal;
  } catch (err) {
    // Ignore localStorage errors
  }

  return DEFAULT_PROVIDER;
}

export async function setStoredProvider(provider: LlmProvider): Promise<void> {
  try {
    await Preferences.set({ key: PROVIDER_STORAGE_KEY, value: provider });
  } catch (err) {
    // Fallback to localStorage
  }
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch (err) {
    // Ignore localStorage errors
  }
}

/**
 * Securely retrieve the stored API key for the given provider (or the currently selected
 * provider if none is passed) from local storage. Reads from Capacitor Preferences (native
 * Android SharedPreferences) with fallback to localStorage.
 */
export async function getStoredApiKey(provider?: LlmProvider): Promise<string> {
  const targetProvider = provider || (await getStoredProvider());
  const storageKey = storageKeyFor(targetProvider);

  try {
    const { value } = await Preferences.get({ key: storageKey });
    if (value && value.trim()) {
      return value.trim();
    }
  } catch (err) {
    // Fallback to localStorage if Capacitor Preferences is unavailable
  }

  try {
    const localVal = localStorage.getItem(storageKey);
    if (localVal && localVal.trim()) {
      return localVal.trim();
    }
  } catch (err) {
    // Ignore localStorage errors
  }

  // Legacy single-key storage, only relevant for Gemini (the only provider that existed before).
  if (targetProvider === 'gemini') {
    try {
      const { value } = await Preferences.get({ key: LEGACY_GEMINI_KEY });
      if (value && value.trim()) return value.trim();
    } catch (err) {
      // Ignore
    }
    try {
      const localVal = localStorage.getItem(LEGACY_GEMINI_KEY);
      if (localVal && localVal.trim()) return localVal.trim();
    } catch (err) {
      // Ignore
    }
  }

  // Deliberately NO build-time env fallback here. Vite inlines every VITE_* variable into the
  // client bundle at build time, so reading one would bake whatever key the build machine had
  // straight into the shipped JavaScript and into the Android APK - in a public repository, and
  // in an app whose whole key model is "each user supplies their own, stored on their own
  // device". A server-side key still works: it lives in GEMINI_API_KEY, is read only by
  // server.ts, and never reaches the browser.
  return '';
}

/**
 * Securely save the API key for the given provider to local device storage.
 */
export async function setStoredApiKey(apiKey: string, provider: LlmProvider): Promise<void> {
  const cleanKey = (apiKey || '').trim();
  const storageKey = storageKeyFor(provider);
  try {
    await Preferences.set({ key: storageKey, value: cleanKey });
  } catch (err) {
    // Fallback to localStorage
  }

  try {
    if (cleanKey) {
      localStorage.setItem(storageKey, cleanKey);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (err) {
    // Ignore localStorage errors
  }
}

/**
 * Securely remove the stored API key for the given provider from local device storage.
 */
export async function clearStoredApiKey(provider: LlmProvider): Promise<void> {
  const storageKey = storageKeyFor(provider);
  try {
    await Preferences.remove({ key: storageKey });
  } catch (err) {}

  try {
    localStorage.removeItem(storageKey);
  } catch (err) {}

  if (provider === 'gemini') {
    try {
      await Preferences.remove({ key: LEGACY_GEMINI_KEY });
    } catch (err) {}
    try {
      localStorage.removeItem(LEGACY_GEMINI_KEY);
    } catch (err) {}
  }
}

/**
 * Validate an API key by making a minimal, light request directly to the given provider's API.
 */
export async function validateApiKey(apiKey: string, provider: LlmProvider): Promise<{ valid: boolean; message?: string }> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { valid: false, message: 'מפתח API ריק' };
  }

  try {
    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
      );
      if (response.ok) return { valid: true };
      const data = await response.json().catch(() => ({}));
      return { valid: false, message: data?.error?.message || `שגיאת אימות (${response.status})` };
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (response.ok) return { valid: true };
      const data = await response.json().catch(() => ({}));
      return { valid: false, message: data?.error?.message || `שגיאת אימות (${response.status})` };
    }

    // anthropic - there's no unauthenticated "list models" style endpoint that's cheap to call
    // without also being billable, so send the smallest possible real request instead.
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (response.ok) return { valid: true };
    const data = await response.json().catch(() => ({}));
    return { valid: false, message: data?.error?.message || `שגיאת אימות (${response.status})` };
  } catch (err: any) {
    return { valid: false, message: err?.message || 'שגיאת תקשורת בחיבור לשרתי ה-API' };
  }
}
