# PSTV

Education-only live TV lab by **Pasith Senevirathna** ([pasiths.tech](https://pasiths.tech)).

**Live:** [https://tv.pasiths.tech](https://tv.pasiths.tech)

Installable as a Progressive Web App on **iPhone / iPad**, **Android**, and **Windows**.

**Stack:** Next.js · Prisma · PostgreSQL · shadcn/ui · PWA

## Purpose

PSTV is an **education & development** project for learning:

- live HLS streaming
- IPTV-style channel catalogs
- auth / freemium access patterns
- Progressive Web Apps across mobile and desktop

It is **not** a commercial broadcast service.

## Setup

```bash
cp .env.example .env
# set DATABASE_URL + NEXT_PUBLIC_APP_URL=https://tv.pasiths.tech for production

npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3002](http://localhost:3002)

**Seed accounts** (password `12345678`):

- `superadmin@fluxtv.local` — super admin + premium
- `admin@fluxtv.local` — admin + premium
- `premium@fluxtv.local` — premium
- `user@fluxtv.local` — free

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run db:seed` — seed roles, admin/premium users, local channels
- `npm run tv:import-local` — import Sri Lanka channels
- `npm run tv:repair` — probe and repair broken stream URLs

## Install (PWA)

- **Android / Windows / Chrome:** browser install prompt, or menu → Install app
- **iPhone / iPad (Safari):** Share → Add to Home Screen
