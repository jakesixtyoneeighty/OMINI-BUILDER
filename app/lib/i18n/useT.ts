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
 * If a key is missing, it falls back to the raw key.
 */
export function useT() {
  const lang = useStore(languageStore);

  function t(key: string, params?: Record<string, string | number>): string {
    let value = translations[lang]?.[key] || translations.en?.[key] || key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return value;
  }

  return t;
}

/**
 * Non-hook version for use outside React components (e.g. in event handlers).
 * Reads the current language from the store directly.
 */
export function getT() {
  const lang = languageStore.get();

  function t(key: string, params?: Record<string, string | number>): string {
    let value = translations[lang as keyof typeof translations]?.[key] || translations.en?.[key] || key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return value;
  }

  return t;
}
