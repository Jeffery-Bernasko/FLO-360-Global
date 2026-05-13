# FLO 360 Global — Warehouse Inventory & Approval App

Web app for a sanitary-products warehouse in Ghana. Tracks boxes (24 pcs/box) coming in from overseas suppliers and going out to customers, with a manager-approval workflow.

- Master PRD: [#1](https://github.com/Jeffery-Bernasko/FLO-360-Global/issues/1)
- Feature breakdown: [#2–#10](https://github.com/Jeffery-Bernasko/FLO-360-Global/issues/1#issuecomment-4435907745)

## Status

**F1 Foundation** is in place: Next.js 15 + TypeScript + Tailwind + Postgres (Drizzle) + Auth.js v5 (credentials, JWT sessions) + RBAC guards + append-only audit log. The signed-in landing page is a placeholder; business features land in F2–F9.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, server components) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 (mobile-first) |
| Database | Postgres (Neon recommended) |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | Auth.js (NextAuth) v5 — credentials provider, bcryptjs, JWT sessions (8 h idle timeout) |
| Validation | Zod |
| Tests | Vitest |
| Hosting | Vercel (free tier to start) |

## Prerequisites

- Node.js 20+ (tested on 24)
- A Postgres database. For production use a [Neon](https://neon.tech) project; for local dev either Neon or a local Postgres works.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env
# then edit .env and set DATABASE_URL and AUTH_SECRET
#   DATABASE_URL=postgres://user:pass@host/db
#   AUTH_SECRET=$(openssl rand -base64 32)

# 3. Apply migrations (creates `users`, `audit_log`, and the `user_role` enum)
npm run db:migrate

# 4. Seed the first manager account. The password is printed once.
npm run seed:admin -- --email=you@example.com --name="Your Name"

# 5. Start the dev server
npm run dev
# open http://localhost:3000 and sign in with the printed credentials
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with `next lint` |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:generate` | Generate a new SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the database in `DATABASE_URL` |
| `npm run db:studio` | Open Drizzle Studio against the database |
| `npm run seed:admin` | Create the first manager account |

## Project Layout

```
src/
  app/                       # Next.js App Router
    layout.tsx               # Root layout
    page.tsx                 # Signed-in landing
    sign-in/page.tsx         # Email + password sign-in
    api/auth/[...nextauth]/  # Auth.js handlers
  db/
    schema.ts                # Drizzle schema (users, audit_log, enums)
    index.ts                 # Postgres client + Drizzle instance
  types/
    next-auth.d.ts           # Adds `id` and `role` to Session/JWT
  auth.ts                    # NextAuth config
  auth-helpers.ts            # Pure helpers: requireUserFromSession, errors
  auth-server.ts             # Server helpers: requireUser, requireManager
  audit.ts                   # log() — append-only audit log writer
middleware.ts                # Coarse route guard: redirects anon to /sign-in
drizzle/                     # Generated SQL migrations
scripts/
  migrate.ts                 # Migration runner (used by `npm run db:migrate`)
  seed-admin.ts              # First-manager seed script
```

## Auth & RBAC

- **Sessions** are JWTs (the only strategy Auth.js v5 supports cleanly with the credentials provider). Idle timeout is 8 hours; sliding refresh every 30 minutes.
- **Roles** are an enum on `users.role`: `worker | manager`.
- **Server-side guards** live in `src/auth-server.ts`:
  - `requireUser()` — returns the signed-in user or throws `UnauthorizedError`.
  - `requireManager()` — additionally throws `ForbiddenError` for non-managers.
- **Coarse route guard** is in `middleware.ts`: any path that isn't `/sign-in` or `/api/auth/*` requires a session, otherwise the user is redirected to `/sign-in?from=…`.
- Every later mutating handler must call one of the guards AND emit an audit-log entry via `log()`. This is defence in depth — the middleware is convenience, the guard is correctness.

## Audit Log

`src/audit.ts` exposes a single `log({ action, entityType, entityId, payload, actorUserId }, tx?)` function. Every later feature is required to use it for state-changing actions. The `tx` parameter accepts a Drizzle transaction so the audit row commits or rolls back atomically with the action it describes.

The table is append-only by convention (no update/delete code paths); a future migration may revoke `UPDATE`/`DELETE` privileges from the application database role for a stronger guarantee.

## Tests

```bash
npm test
```

F1 ships unit tests for the pure auth helpers (`requireUserFromSession`, `requireManagerFromSession`) and the audit `log()` function. Database-backed integration tests land with the modules that need them (F3 onwards).

## Deploy (Vercel)

1. Push the branch to GitHub.
2. Import the repo in Vercel.
3. Set environment variables in Vercel: `DATABASE_URL` and `AUTH_SECRET`.
4. Deploy. The first deploy will fail to sign in until you run `npm run db:migrate` and `npm run seed:admin` against the production database (run them locally with the production `DATABASE_URL` set, or via a one-off Vercel build hook).

## What's Next

See the open feature issues for the implementation roadmap. Suggested order: **F3 → F4 → F5 → F6 → F8 → F9**, with **F2** and **F7** slotted in opportunistically.
