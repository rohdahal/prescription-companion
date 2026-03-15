# Prescription Companion

Prescription Companion is a monorepo for a medication management app with prescription parsing, schedules, care context, and an AI companion.

## Repo Layout

```text
prescription-companion
├ apps
│  ├ web
│  └ api
├ packages
│  ├ ai
│  ├ scheduler
│  ├ security
│  ├ observability
│  └ supabase
└ infra
```

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Run [`infra/sql/schema.sql`](infra/sql/schema.sql) in the Supabase SQL editor.
3. Ensure the Supabase Storage bucket `prescriptions` exists, or set `SUPABASE_STORAGE_BUCKET`.
4. Install dependencies:

```bash
npm i
npm i @mariozechner/pi-ai open --workspace @prescription-companion/ai
```

## Run

Start the API and web app in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Web: `http://localhost:3000`  
API: `http://localhost:3001`

## App Preview

Current prototype screens. Layout, styling, and interaction details are still in progress.

- [`screenshots/signin.png`](screenshots/signin.png)
- [`screenshots/home.png`](screenshots/home.png)
- [`screenshots/care.png`](screenshots/care.png)
- [`screenshots/companion.png`](screenshots/companion.png)

## Seed Demo Data

Sign into the web app first, then run:

```bash
npm run seed:demo
```

That reuses the locally cached authenticated session and seeds demo data for the current user.

Optional alternatives:

```bash
npm run seed:demo -- --email your-user@example.com --password 'your-password'
DEMO_SEED_ACCESS_TOKEN=your_access_token npm run seed:demo
```

The seed fixture lives in [`scripts/seed-data.json`](scripts/seed-data.json).
