# FLO 360 Global — Warehouse Inventory & Approval App

Web app for a sanitary-products warehouse in Ghana. Tracks boxes (24 pcs/box) coming in from overseas suppliers and going out to customers, with a manager-approval workflow, per-product stock ledger, invoice generation, and reporting dashboards.

- Master PRD: [#1](https://github.com/Jeffery-Bernasko/FLO-360-Global/issues/1)
- Feature breakdown: [#2–#10](https://github.com/Jeffery-Bernasko/FLO-360-Global/issues/1#issuecomment-4435907745)

## Status

The app is **feature-complete** through F9. Implemented features:

- **Auth & RBAC** — credentials login, JWT sessions, worker/manager roles, password change, forced password reset
- **Products** — CRUD with active/inactive toggle
- **Suppliers & Customers** — CRUD with active/inactive toggle
- **Inbound forms** — workers submit with receipt attachment, managers approve/reject, approval records stock movement
- **Outbound forms** — workers submit with per-product line items and stock check, managers approve/reject with row-level locking to prevent oversell, approval generates invoice PDF and records stock movements
- **Stock ledger** — append-only per-product ledger with inbound, outbound, and manual adjustment movements
- **Manual adjustments** — managers can adjust stock with a reason (audit-logged)
- **Invoice generation** — PDF invoices rendered on approval and stored in Vercel Blob (served via authenticated proxy)
- **Dashboard** — role-specific metrics (manager sees warehouse-wide, worker sees own submissions)
- **Reports** — movement history, per-customer totals, per-supplier totals with CSV export
- **User management** — managers can create users, toggle active, reset passwords

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, server components) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 (mobile-first) |
| Database | Postgres (Neon recommended) |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | Auth.js (NextAuth) v5 — credentials provider, bcryptjs, JWT sessions (8 h idle timeout) |
| PDF | @react-pdf/renderer |
| File storage | Vercel Blob (served via authenticated API route) |
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
# then edit .env and set DATABASE_URL, AUTH_SECRET, and optionally BLOB_READ_WRITE_TOKEN
#   DATABASE_URL=postgres://user:pass@host/db
#   AUTH_SECRET=$(openssl rand -base64 32)
#   BLOB_READ_WRITE_TOKEN=vercel_blob_...   (for invoice PDFs and receipt uploads)
#   WAREHOUSE_NAME="Your Warehouse"         (appears on invoices)
#   WAREHOUSE_CONTACT="+233 ..."            (appears on invoices)

# 3. Apply migrations
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
    page.tsx                 # Dashboard (role-specific)
    sign-in/page.tsx         # Email + password sign-in
    change-password/page.tsx # Password change
    products/                # Product CRUD
    suppliers/               # Supplier CRUD
    customers/               # Customer CRUD
    inbound/                 # Inbound form submission & detail
    outbound/                # Outbound form submission & detail
    approvals/               # Manager approval queues (inbound + outbound)
    adjustments/             # Manual stock adjustments
    reports/                 # Movement history, customer & supplier reports
    users/                   # User management (manager only)
    api/auth/[...nextauth]/  # Auth.js handlers
    api/blob/                # Authenticated blob proxy
  db/
    schema.ts                # Drizzle schema
    index.ts                 # Postgres client + Drizzle instance
  lib/
    stock-ledger.ts          # Append-only stock ledger
    inbound-forms.ts         # Inbound form logic
    outbound-forms.ts        # Outbound form logic + invoice generation
    attachments.ts           # Vercel Blob upload/URL helpers
    invoice-pdf.ts           # PDF rendering
    dashboard.ts             # Dashboard metrics
    reports.ts               # Report queries
    adjustments.ts           # Manual stock adjustments
    customers.ts             # Customer logic
    suppliers.ts             # Supplier logic
    users.ts                 # User management logic
    passwords.ts             # Password hashing
    money.ts                 # Currency formatting
    report-csv.ts            # CSV export
  auth.ts                    # NextAuth config
  auth-helpers.ts            # Pure helpers: requireUserFromSession, errors
  auth-server.ts             # Server helpers: requireUser, requireManager
  audit.ts                   # log() — append-only audit log writer
middleware.ts                # Coarse route guard: redirects anon to /sign-in
drizzle/                     # Generated SQL migrations
scripts/
  migrate.ts                 # Migration runner
  seed-admin.ts              # First-manager seed script
```

## Auth & RBAC

- **Sessions** are JWTs (the only strategy Auth.js v5 supports cleanly with the credentials provider). Idle timeout is 8 hours; sliding refresh every 30 minutes.
- **Roles** are an enum on `users.role`: `worker | manager`.
- **Server-side guards** live in `src/auth-server.ts`:
  - `requireUser()` — returns the signed-in user or throws `UnauthorizedError`.
  - `requireManager()` — additionally throws `ForbiddenError` for non-managers.
- **Coarse route guard** is in `middleware.ts`: any path that isn't `/sign-in` or `/api/auth/*` requires a session, otherwise the user is redirected to `/sign-in?from=…`.
- Every mutating handler calls one of the guards AND emits an audit-log entry via `log()`.

## Audit Log

`src/audit.ts` exposes a single `log({ action, entityType, entityId, payload, actorUserId }, tx?)` function. Every state-changing action uses it. The `tx` parameter accepts a Drizzle transaction so the audit row commits or rolls back atomically with the action it describes. The table is append-only by convention.

## Tests

```bash
npm test
```

Unit tests cover auth helpers, audit logging, stock ledger, inbound/outbound form logic, customers, suppliers, users, adjustments, dashboard, reports, passwords, money formatting, and CSV export. Tests mock the database layer and validate business rules in isolation.

## Deploy (Vercel)

1. Push the branch to GitHub.
2. Import the repo in Vercel.
3. Set environment variables in Vercel: `DATABASE_URL`, `AUTH_SECRET`, and `BLOB_READ_WRITE_TOKEN`.
4. Deploy. The first deploy will fail to sign in until you run `npm run db:migrate` and `npm run seed:admin` against the production database.
