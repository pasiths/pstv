/** Language helpers for FluxTV filters and imports. */

const languageDisplayNames =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "language" })
    : null;

/** Common primary language by ISO country code (fallback when M3U has no tvg-language). */
export const PRIMARY_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  LK: "Sinhala",
  IN: "Hindi",
  BD: "Bengali",
  PK: "Urdu",
  NP: "Nepali",
  MV: "Dhivehi",
  AE: "Arabic",
  SA: "Arabic",
  QA: "Arabic",
  EG: "Arabic",
  SG: "English",
  MY: "Malay",
  TH: "Thai",
  ID: "Indonesian",
  PH: "Filipino",
  JP: "Japanese",
  KR: "Korean",
  CN: "Chinese",
  HK: "Chinese",
  TW: "Chinese",
  AU: "English",
  NZ: "English",
  US: "English",
  CA: "English",
  GB: "English",
  UK: "English",
  IE: "English",
  DE: "German",
  AT: "German",
  CH: "German",
  FR: "French",
  BE: "Dutch",
  NL: "Dutch",
  IT: "Italian",
  ES: "Spanish",
  PT: "Portuguese",
  BR: "Portuguese",
  MX: "Spanish",
  AR: "Spanish",
  CL: "Spanish",
  SE: "Swedish",
  NO: "Norwegian",
  DK: "Danish",
  FI: "Finnish",
  PL: "Polish",
  CZ: "Czech",
  TR: "Turkish",
  RU: "Russian",
  UA: "Ukrainian",
  ZA: "English",
  NG: "English",
  GR: "Greek",
  XX: "International",
};

export function getLanguageLongName(codeOrName?: string | null): string {
  if (!codeOrName) return "Unknown";
  const raw = codeOrName.trim();
  if (!raw) return "Unknown";
  if (raw.toLowerCase() === "all") return "All languages";
  if (raw.length > 3) return raw;

  const normalized = raw.toLowerCase();
  try {
    const label = languageDisplayNames?.of(normalized);
    if (label && label !== normalized) return label;
  } catch {
    // ignore invalid language codes
  }
  return raw;
}

export function languageForCountry(country?: string | null): string | null {
  if (!country) return null;
  return PRIMARY_LANGUAGE_BY_COUNTRY[country.trim().toUpperCase()] || null;
}
