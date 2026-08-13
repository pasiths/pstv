/** Site branding & SEO constants for PSTV */
export const SITE = {
  name: "PSTV",
  shortName: "PSTV",
  tagline: "Education-only live TV lab",
  description:
    "PSTV is an education-only live TV lab for learning web streaming and PWAs. Developed by Pasith Senevirathna (pasiths.tech).",
  /** Canonical public site used for SEO, sitemap, Open Graph */
  publicUrl: "https://tv.pasiths.tech",
  domain: "tv.pasiths.tech",
  /** Runtime app origin (local or deployed). Prefer NEXT_PUBLIC_APP_URL. */
  url: process.env.NEXT_PUBLIC_APP_URL || "https://tv.pasiths.tech",
  developer: {
    name: "Pasith Senevirathna",
    url: "https://pasiths.tech",
    label: "pasiths.tech",
  },
  copyright: `© ${new Date().getFullYear()} Pasith Senevirathna`,
  /** Keep short — education label only */
  educationNotice: "Education-only.",
  /** Thanks + copyright for channels shown in the app (rights holders) */
  channelThanks:
    "Thanks to all channels shown here. Copyright and credit belong to their respective owners / broadcasters.",
} as const;
