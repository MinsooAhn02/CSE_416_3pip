/**
 * i18n Configuration for MorningBrief AI
 * 
 * This file sets up react-i18next for localization.
 * Supports: English (en), Korean (ko)
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './en.json';
import ko from './ko.json';

// Get saved language from localStorage or default to 'en'
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
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

// Function to change language and persist to localStorage
export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  localStorage.setItem('language', lng);
};

// Function to get current language
export const getCurrentLanguage = () => i18n.language;

// Function to toggle between languages
export const toggleLanguage = () => {
  const newLang = i18n.language === 'ko' ? 'en' : 'ko';
  changeLanguage(newLang);
  return newLang;
};

export default i18n;
