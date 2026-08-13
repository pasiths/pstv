# FluxTV

Free live TV for local Sri Lankan channels and international free streams.

**Stack:** Next.js · Prisma · PostgreSQL · shadcn/ui · role-based auth

## Versions

| Branch | Focus |
|--------|--------|
| `main` | Project init only |
| `dev` | Integration branch |
| `v1` | MVP — local channels + HLS player |
| `v2` | International catalog, proxy, search/filters |
| `v3` | Admin dashboard + RBAC CRUD |
| `v4` | User accounts, favorites, watch history |
| `v5` | EPG, PiP, PWA, live chat |

## Setup

```bash
cp .env.example .env
# set DATABASE_URL to your PostgreSQL database

npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Admin:** `superadmin@fluxtv.local` / `12345678`

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run db:seed` — seed roles, admin, local channels
