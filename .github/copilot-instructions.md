# Copilot Instructions

## Build, test, lint
- `npm run lint`
- `npm test` (Vitest, runs `src/**/*.test.ts`)
- Single test: `npm test -- src/audit.test.ts` (any `src/**/*.test.ts` path works)
- `npm run build` (requires `DATABASE_URL` and `AUTH_SECRET` in env; see `.env.example`)

## High-level architecture
- Next.js 15 App Router under `src/app`, with feature routes like `customers`, `suppliers`, `inbound`, `outbound`, `approvals`, `reports`, `users`, and auth pages (`sign-in`, `change-password`). API routes live under `src/app/api`.
- Auth is Auth.js v5 credentials + JWT sessions in `src/auth.ts`, with handlers at `src/app/api/auth/[...nextauth]` and session typing in `src/types/next-auth.d.ts`.
- Route protection is layered: `middleware.ts` blocks unauthenticated requests (except `/sign-in` and `/api/auth/*`), and server-side guards `requireUser` / `requireManager` live in `src/auth-server.ts` (pure helpers in `src/auth-helpers.ts`).
- Data layer uses Drizzle: schema in `src/db/schema.ts`, db client in `src/db/index.ts`, migrations in `drizzle/`, and DB scripts in `scripts/` (`db:migrate`, `seed:admin`). Audit logging is centralized in `src/audit.ts`.

## Key conventions
- Every mutating action should call `requireUser` or `requireManager` and emit an audit entry via `log()` (preferably in the same Drizzle transaction). The audit log is append-only by convention.
- Use the `@` path alias for `src` imports.
- Roles are constrained to `worker` and `manager` (enum in `src/db/schema.ts`) and enforced in auth/session helpers.
- When a pull request diff is provided, run a review and address issues found before finalizing.
