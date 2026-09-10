import en from "../translations/en.json";
import hi from "../translations/hi.json";
import mr from "../translations/mr.json";
import kn from "../translations/kn.json";
import ta from "../translations/ta.json";
import orDict from "../translations/or.json";
import ne from "../translations/ne.json";

export type Language = "en" | "hi" | "mr" | "kn" | "ta" | "or" | "ne";
export type TranslationKey = keyof typeof en;

const translations: Record<Language, Record<string, string>> = {
  en,
  hi,
  mr,
  kn,
  ta,
  or: orDict,
  ne,
};

export function t(key: TranslationKey, lang: Language = "en"): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.hi[key] || translations.en[key] || (key as string);
}

