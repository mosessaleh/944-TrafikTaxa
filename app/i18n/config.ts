export const locales = ["en", "ar", "da"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en";
