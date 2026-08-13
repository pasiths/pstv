# PS Demo TV — video generation prompt

Use this with **Kling / Runway / Veo / Sora / Pika** (or similar).  
After export, replace:

`public/videos/ps-demo-tv.mp4`

Then commit. Keep filename exactly `ps-demo-tv.mp4`.

---

## Target specs

- **Duration:** 35–50 seconds  
- **Aspect:** 16:9 (1280×720 or 1920×1080)  
- **Format:** MP4 (H.264 + AAC)  
- **Style:** premium product intro, dark cinematic UI, teal accents  
- **Audience:** first-time site visitors (public + logged-in)  
- **Do NOT include:** admin panels, developer tools, dashboards, code, backend, “how it was built”

---

## Master prompt (copy-paste)

```text
Create a polished 40-second cinematic product intro video for “PSTV”, an education-only live TV web app.

LOOK & FEEL:
- Dark modern interface (#0b0f14 background), soft teal (#14b8a6) accents, clean sans typography
- Smooth motion graphics, gentle camera pushes, soft particle light, premium SaaS / streaming-app energy
- Friendly 2D/3D animated characters (not childish cartoon): a young adult viewer with headphones, a small glowing TV/orb mascot named “PS”
- High production value, crisp UI mockups, no clutter, no stock-looking corporate clichés
- Soft modern background music (upbeat ambient electronic, warm and inviting) + clear friendly English voiceover
- On-screen titles synced with voiceover

STORYBEATS (in order):
1) 0–5s OPEN: Logo moment “PSTV” + subtitle “Education-only live TV lab”. Mascot PS waves. Soft music starts.
2) 5–12s WHAT IT IS: Character opens a laptop/phone; PSTV UI appears with a live player and channel list. VO: “Welcome to PSTV — watch live channels right in your browser.”
3) 12–20s HOW TO USE: Character taps a channel; player starts; shows volume, quality, fullscreen icons with micro-animations. VO: “Pick a channel, press play, and enjoy. Search and filter anytime.”
4) 20–28s ACCOUNT + INSTALL: Split screen — guest watching free channels, then optional sign-in for favorites; then “Install app” / Add to Home Screen. VO: “Browse free as a guest. Sign in to save favorites. Install PSTV like an app on phone or Windows.”
5) 28–36s THANKS: Montage of generic colorful channel tiles (no real broadcaster logos). VO: “Thanks to every channel shown here — copyright and credit belong to their owners.”
6) 36–42s CLOSE: Big title “PS Demo TV” + “You’re ready — start watching”. End card: “Education-only · PSTV · tv.pasiths.tech”. Music fades.

VOICEOVER STYLE:
- Warm, clear, confident, mid-tempo British or neutral English
- Short sentences, welcoming, never salesy
- Exact lines can match the beats above

NEGATIVE / AVOID:
- No admin, developer, coding, servers, database, or behind-the-scenes
- No real TV network logos/trademarks
- No violence, spammy UI, neon cyberpunk overload, purple gradients, stock handshake footage
- No watermark from the generator if possible
```

---

## Short prompt (if the tool has a low character limit)

```text
40s cinematic intro for PSTV education-only live TV web app. Dark UI, teal accents, friendly animated viewer + glowing TV mascot “PS”. Show browser player, channel list, search/filters, optional sign-in, PWA install. Soft electronic music + clear English VO. End: “PS Demo TV — You’re ready” and “Education-only · tv.pasiths.tech”. No admin/dev, no real broadcaster logos.
```

---

## Voiceover script (optional, for tools that take separate VO)

```text
Welcome to PSTV — an education-only live TV lab in your browser.
Pick a channel, press play, and enjoy.
Search and filter anytime.
Watch free as a guest, or sign in to save favorites.
Install PSTV like an app on your phone or Windows.
Thanks to every channel shown here — copyright stays with their owners.
You’re ready. Start watching on PS Demo TV.
```

---

## After you generate

1. Export MP4 (H.264), 16:9  
2. Replace file: `public/videos/ps-demo-tv.mp4`  
3. Hard-refresh the site (or restart `npm run dev`)  
4. Open the site → **PS Demo TV** should play the new video first  

Optional regenerate helper still exists for the old motion-graphics version:

```bash
npm run tv:demo-video
```
