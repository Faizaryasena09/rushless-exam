'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import translations from '@/app/lib/translations';
import { DEFAULT_TIMEZONE, isValidTimezone, formatDate, formatTime, formatDateTime, formatClock } from '@/app/lib/timezone';

const LanguageContext = createContext({ lang: 'id', t: (key) => key });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('id');
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    fetch('/api/web-settings?mode=branding')
      .then((res) => res.json())
      .then((data) => {
        if (data.app_language === 'en' || data.app_language === 'id') {
          setLang(data.app_language);
        }
        if (isValidTimezone(data.app_timezone)) {
          setTimezone(data.app_timezone);
        }
      })
      .catch(() => {});
  }, []);

  const t = (key) => {
    return translations[lang]?.[key] ?? translations['id']?.[key] ?? key;
  };

  // Opsi timezone per halaman. Semua halaman cukup pakai `tz` lalu memanggil
  // helper dari '@/app/lib/timezone' dengan { locale: t('dash_date_locale'), timeZone: tz }.
  const dateLocale = translations[lang]?.dash_date_locale || 'id-ID';

  const fmt = useMemo(() => ({
    date: (v) => formatDate(v, { locale: dateLocale, timeZone: timezone }),
    time: (v) => formatTime(v, { locale: dateLocale, timeZone: timezone }),
    dateTime: (v) => formatDateTime(v, { locale: dateLocale, timeZone: timezone }),
    clock: (v) => formatClock(v, { locale: dateLocale, timeZone: timezone }),
  }), [dateLocale, timezone]);

  const setAppTimezone = useCallback((tz) => {
    if (isValidTimezone(tz)) setTimezone(tz);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, timezone, setTimezone: setAppTimezone, fmt, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}