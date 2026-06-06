import { atom } from 'nanostores';

export type AppLanguage = 'en';

function getStoredLanguage(): AppLanguage {
  return 'en';
}

export const languageStore = atom<AppLanguage>(getStoredLanguage());

export function setLanguage(_lang: AppLanguage) {
  languageStore.set('en');
}
