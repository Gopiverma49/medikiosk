import en from "../translations/en.json";
import hi from "../translations/hi.json";

export type Language = "en" | "hi";
export type TranslationKey = keyof typeof en;

const translations: Record<Language, Record<string, string>> = {
  en,
  hi,
};

export function t(key: TranslationKey, lang: Language = "en"): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || key;
}
