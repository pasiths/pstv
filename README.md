# PSTV

Education-only live TV lab by **Pasith Senevirathna** ([pasiths.tech](https://pasiths.tech)).

| | |
| --- | --- |
| **Live** | [https://tv.pasiths.tech](https://tv.pasiths.tech) |
| **Repo** | [github.com/pasiths/pstv](https://github.com/pasiths/pstv) |
| **Developer** | [Pasith Senevirathna](https://pasiths.tech) |

Installable as a Progressive Web App on **iPhone / iPad**, **Android**, and **Windows**.

> **Education-only.**

**System development:** © [Pasith Senevirathna](https://pasiths.tech) — credit for building this app.

**Channels:** Thanks to all channels shown here. Copyright and credit belong to their respective owners / broadcasters.

## Features

- Live **HLS** player (quality, captions, PiP, fullscreen, volume, AirPlay / Cast)
- **PS Demo TV** first channel — education intro video (how to use; no admin detail)
- Channel catalog with search, free / paid filters, and infinite scroll
- Freemium access (free streams vs premium-gated channels)
- Auth, roles, favorites, and watch history
- Optional EPG + auto English captions (Whisper via Groq / OpenAI)
- Admin dashboard for channel management and imports
- PWA install, SEO (`tv.pasiths.tech`), and education notice

## Stack

Next.js 16 · React 19 · TypeScript · Prisma 7 · PostgreSQL · HLS.js · Tailwind CSS · shadcn/ui · PWA

## Setup

```bash
git clone https://github.com/pasiths/pstv.git
cd pstv
cp .env.example .env
# edit DATABASE_URL (and other vars below)

npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in the terminal if 3000 is busy).

### Environment

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_SSL` | `true` for managed DBs (Aiven, Neon, …); `false` for local |
| `DATABASE_SSL_VERIFY` | Optional `true` + matching `DATABASE_CA` for full TLS verify |
| `NEXT_PUBLIC_APP_URL` | Local: `http://localhost:3000` · Prod: `https://tv.pasiths.tech` |
| `COOKIE_SECURE` | `true` in production (HTTPS) |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Optional — auto captions |

Canonical SEO / sitemap host is always **`https://tv.pasiths.tech`**.

### Seed accounts

Password for all: `12345678`

| Email | Access |
| --- | --- |
| `superadmin@fluxtv.local` | Super admin + premium |
| `admin@fluxtv.local` | Admin + premium |
| `premium@fluxtv.local` | Premium |
| `user@fluxtv.local` | Free |

Seed is a **safe upsert** — it does not wipe an existing catalog.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed roles, users, local channels |
| `npm run db:studio` | Prisma Studio |
| `npm run tv:demo-video` | Regenerate PS Demo TV intro video |
| `npm run tv:demo-channel` | Upsert PS Demo TV channel in the DB |
| `npm run tv:import-local` | Import Sri Lanka channels (iptv-org) |
| `npm run tv:import-all` | Broader FTA import |
| `npm run tv:repair` | Probe and repair broken stream URLs |
| `npm run tv:tag-premium` | Tag premium channels |
| `npm run tv:probe` | Probe stream health |

## PWA install

- **Android / Windows / Chrome:** install prompt, or browser menu → **Install app**
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**

## License / copyright

**Education-only.**

**Software / system development:** © [Pasith Senevirathna](https://pasiths.tech). Credit for developing PSTV belongs to the developer. Live: [tv.pasiths.tech](https://tv.pasiths.tech).

**Channels shown:** Thanks to every channel listed in the app. Copyright and credit for those channels belong to their respective owners / broadcasters — not to PSTV.

