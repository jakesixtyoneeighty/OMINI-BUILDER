import { atom } from 'nanostores';

export type AppLanguage = 'pt' | 'en' | 'es' | 'zh';

export const LANGUAGE_FLAGS: Record<AppLanguage, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
  zh: '🇨🇳',
};

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  zh: '中文',
};

function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'pt';
  try {
    const stored = localStorage.getItem('omni-language');
    if (stored && ['pt', 'en', 'es', 'zh'].includes(stored)) {
      return stored as AppLanguage;
    }
  } catch {}
  return 'pt';
}

export const languageStore = atom<AppLanguage>(getStoredLanguage());

languageStore.listen((lang) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('omni-language', lang);
    } catch {}
  }
});

export function setLanguage(lang: AppLanguage) {
  languageStore.set(lang);
}
