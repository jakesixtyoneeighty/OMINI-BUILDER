import { useStore } from '@nanostores/react';
import { languageStore } from '~/lib/stores/language';
import { translations } from './translations';

/**
 * Translation hook — returns a `t()` function bound to the current language.
 *
 * Usage:
 *   const t = useT();
 *   <button>{t('deploy.button')}</button>
 *
 * If a key is missing in the current language, it falls back to Portuguese (pt),
 * then to the raw key.
 */
export function useT() {
  const lang = useStore(languageStore);

  function t(key: string): string {
    return translations[lang]?.[key] || translations.pt?.[key] || key;
  }

  return t;
}

/**
 * Non-hook version for use outside React components (e.g. in event handlers).
 * Reads the current language from the store directly.
 */
export function getT() {
  const lang = languageStore.get();

  function t(key: string): string {
    return translations[lang as keyof typeof translations]?.[key] || translations.pt?.[key] || key;
  }

  return t;
}
