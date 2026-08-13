/** Site branding & SEO constants for PSTV */
export const SITE = {
  name: "PSTV",
  shortName: "PSTV",
  tagline: "Education-only live TV lab",
  description:
    "PSTV is an education-only web app for learning live streaming, IPTV catalogs, and progressive web apps. Developed for study and development — not a commercial broadcast service.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://tv.pasiths.tech",
  domain: "tv.pasiths.tech",
  developer: {
    name: "Pasiths",
    url: "https://pasiths.tech",
    label: "pasiths.tech",
  },
  educationNotice:
    "Education & development only. PSTV is a learning project for web, streaming, and PWA skills. Not affiliated with any broadcaster.",
} as const;
