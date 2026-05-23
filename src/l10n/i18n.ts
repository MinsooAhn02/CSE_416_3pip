import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ko from './ko.json';

const savedLanguage = localStorage.getItem('language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export const changeLanguage = (lng: string): void => {
  void i18n.changeLanguage(lng);
  localStorage.setItem('language', lng);
};

export const getCurrentLanguage = (): string => i18n.language;

export const toggleLanguage = (): string => {
  const newLang = i18n.language === 'ko' ? 'en' : 'ko';
  changeLanguage(newLang);
  return newLang;
};

export default i18n;
