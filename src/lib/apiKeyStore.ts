import { Preferences } from '@capacitor/preferences';

const API_KEY_STORAGE_KEY = 'congitree_secure_gemini_api_key';

/**
 * Securely retrieve the stored Gemini API key from local storage.
 * Reads from Capacitor Preferences (native Android SharedPreferences) with fallback to localStorage.
 */
export async function getStoredApiKey(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: API_KEY_STORAGE_KEY });
    if (value && value.trim()) {
      return value.trim();
    }
  } catch (err) {
    // Fallback to localStorage if Capacitor Preferences is unavailable
  }

  try {
    const localVal = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (localVal && localVal.trim()) {
      return localVal.trim();
    }
  } catch (err) {
    // Ignore localStorage errors
  }

  // Check fallback from Vite environment variable if available
  return (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
}

/**
 * Securely save the Gemini API key to local device storage.
 */
export async function setStoredApiKey(apiKey: string): Promise<void> {
  const cleanKey = (apiKey || '').trim();
  try {
    await Preferences.set({ key: API_KEY_STORAGE_KEY, value: cleanKey });
  } catch (err) {
    // Fallback to localStorage
  }

  try {
    if (cleanKey) {
      localStorage.setItem(API_KEY_STORAGE_KEY, cleanKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch (err) {
    // Ignore localStorage errors
  }
}

/**
 * Securely remove the Gemini API key from local device storage.
 */
export async function clearStoredApiKey(): Promise<void> {
  try {
    await Preferences.remove({ key: API_KEY_STORAGE_KEY });
  } catch (err) {}

  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch (err) {}
}

/**
 * Validate an API key by making a minimal light request to Google Gemini API.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; message?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, message: 'מפתח API ריק' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
    );
    if (response.ok) {
      return { valid: true };
    }
    const data = await response.json().catch(() => ({}));
    const errorMsg = data?.error?.message || `שגיאת אימות (${response.status})`;
    return { valid: false, message: errorMsg };
  } catch (err: any) {
    return { valid: false, message: err?.message || 'שגיאת תקשורת בחיבור למאגר API של גוגל' };
  }
}
