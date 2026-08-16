/** Site branding & SEO constants for PSTV */
export const SITE = {
  name: "PSTV",
  shortName: "PSTV",
  tagline: "Education-only live TV lab",
  description:
    "PSTV is an education-only live TV lab for learning web streaming and PWAs. Developed by Pasith Pabasara Senevirathna (pasiths / Pasiths Dev / pscreator).",
  publicUrl: "https://tv.pasiths.tech",
  domain: "tv.pasiths.tech",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://tv.pasiths.tech",
  developer: {
    name: "Pasith Pabasara Senevirathna",
    url: "https://pasiths.tech",
    label: "pasiths.tech",
    aliases: [
      "pasith",
      "senevirathna",
      "pasiths",
      "pscreator",
      "pasiths dev",
      "pabasara",
      "pasith pabasara",
      "pasith senevirathna",
      "pasith pabasara senevirathna",
    ],
  },
  copyright: `© ${new Date().getFullYear()} Pasith Pabasara Senevirathna`,
  educationNotice: "Education-only.",
  channelThanks:
    "Thanks to all channels shown here. Copyright and credit belong to their respective owners / broadcasters.",
} as const;
