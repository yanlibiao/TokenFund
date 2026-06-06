import { NextRequest } from "next/server";

const SUPPORTED_LOCALES = ["en", "zh"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

function getLocale(request: NextRequest): Locale {
  // Check cookie first
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // Check Accept-Language header
  const acceptLang = request.headers.get("accept-language");
  if (acceptLang) {
    const preferred = acceptLang.split(",")[0].split("-")[0];
    if (preferred === "zh") return "zh";
  }

  return DEFAULT_LOCALE;
}

// Public paths that don't require authentication
const PUBLIC_PATH_PATTERNS = [
  /^\/[a-z]{2}\/auth\//,
  /^\/[a-z]{2}\/projects\/?$/,
  /^\/[a-z]{2}\/projects\/[^/]+$/,
  /^\/[a-z]{2}\/?$/, // home page
  /^\/api\/auth\//,
  /^\/api\/projects\/?$/,
  /^\/api\/projects\/[^/]+$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, getLocale, isPublicPath };
export type { Locale };
