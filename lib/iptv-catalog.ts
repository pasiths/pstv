/** iptv-org free-to-air catalog sources used by FluxTV. */

export const LOCAL_COUNTRY = "lk";

export const FTA_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "lk", name: "Sri Lanka" },
  { code: "in", name: "India" },
  { code: "bd", name: "Bangladesh" },
  { code: "pk", name: "Pakistan" },
  { code: "np", name: "Nepal" },
  { code: "mv", name: "Maldives" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "qa", name: "Qatar" },
  { code: "sg", name: "Singapore" },
  { code: "my", name: "Malaysia" },
  { code: "th", name: "Thailand" },
  { code: "id", name: "Indonesia" },
  { code: "ph", name: "Philippines" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "cn", name: "China" },
  { code: "hk", name: "Hong Kong" },
  { code: "tw", name: "Taiwan" },
  { code: "au", name: "Australia" },
  { code: "nz", name: "New Zealand" },
  { code: "us", name: "United States" },
  { code: "ca", name: "Canada" },
  { code: "gb", name: "United Kingdom" },
  { code: "ie", name: "Ireland" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "it", name: "Italy" },
  { code: "es", name: "Spain" },
  { code: "pt", name: "Portugal" },
  { code: "nl", name: "Netherlands" },
  { code: "be", name: "Belgium" },
  { code: "ch", name: "Switzerland" },
  { code: "at", name: "Austria" },
  { code: "se", name: "Sweden" },
  { code: "no", name: "Norway" },
  { code: "dk", name: "Denmark" },
  { code: "fi", name: "Finland" },
  { code: "pl", name: "Poland" },
  { code: "cz", name: "Czech Republic" },
  { code: "tr", name: "Turkey" },
  { code: "ru", name: "Russia" },
  { code: "ua", name: "Ukraine" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "ar", name: "Argentina" },
  { code: "cl", name: "Chile" },
  { code: "za", name: "South Africa" },
  { code: "ng", name: "Nigeria" },
  { code: "eg", name: "Egypt" },
];

export const FTA_CATEGORIES = [
  "news",
  "sports",
  "entertainment",
  "movies",
  "series",
  "kids",
  "music",
  "documentary",
  "education",
  "comedy",
  "cooking",
  "travel",
  "outdoor",
  "religion",
  "culture",
  "legislative",
  "general",
] as const;

export function countryPlaylistUrl(code: string) {
  return `https://iptv-org.github.io/iptv/countries/${code.toLowerCase()}.m3u`;
}

export function categoryPlaylistUrl(category: string) {
  return `https://iptv-org.github.io/iptv/categories/${category.toLowerCase()}.m3u`;
}

export const COUNTRY_NAME_BY_CODE = Object.fromEntries(
  FTA_COUNTRIES.map((c) => [c.code.toUpperCase(), c.name]),
) as Record<string, string>;
