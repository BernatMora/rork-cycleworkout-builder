import { useCallback, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS, AppLanguage, TranslationKey } from '@/constants/translations';
import { STORAGE_KEYS } from '@/constants/workout-options';

export function useTranslation() {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.APP_LANGUAGE).then((saved) => {
      if (saved && (saved === 'en' || saved === 'ca' || saved === 'es')) {
        setLanguageState(saved);
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text = TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return text;
    },
    [language]
  );

  const cycleLanguage = useCallback(() => {
    const langs: AppLanguage[] = ['en', 'ca', 'es'];
    const currentIndex = langs.indexOf(language);
    const nextLang = langs[(currentIndex + 1) % langs.length];
    setLanguage(nextLang);
  }, [language, setLanguage]);

  return {
    language,
    setLanguage,
    t,
    cycleLanguage,
  };
}

export type TranslationHook = ReturnType<typeof useTranslation>;
