'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import translations from '@/app/lib/translations';

const LanguageContext = createContext({ lang: 'id', t: (key) => key });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('id');

  useEffect(() => {
    fetch('/api/web-settings?mode=branding')
      .then((res) => res.json())
      .then((data) => {
        if (data.app_language === 'en' || data.app_language === 'id') {
          setLang(data.app_language);
        }
      })
      .catch(() => {});
  }, []);

  const t = (key) => {
    return translations[lang]?.[key] ?? translations['id']?.[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
