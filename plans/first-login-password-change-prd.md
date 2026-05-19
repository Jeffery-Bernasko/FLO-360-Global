## Problem Statement

Managers currently create worker accounts with a generated temporary password that is shown once and shared out-of-band. The worker can continue using that temporary password indefinitely. FLO 360 needs newly created users to be forced to set their own password the first time they sign in, so the manager-issued credential is only a bootstrap secret.

## Current State Findings

- The app is a Next.js 15 App Router application using Auth.js v5 credentials auth, bcrypt password hashes, JWT sessions, Drizzle ORM, Postgres, and Vitest.
- `src/lib/users.ts` owns manager-driven user management. `createWorker` generates a temp password, hashes it, inserts a worker row, and returns the plaintext temp password exactly once. `resetUserPassword` uses the same temp-password pattern.
- `src/app/users/new/new-worker-form.tsx` displays the temporary password after worker creation and tells the manager to share it out-of-band.
- `src/auth.ts` validates credentials by email and bcrypt password hash, rejects inactive users, and returns only `id`, `email`, `name`, and `role` into the JWT/session flow.
- `middleware.ts` only checks whether a valid JWT exists. It does not inspect database user state beyond the token claims.
- `src/auth-server.ts` re-fetches the database user for protected server-side flows and rejects inactive users, but it does not currently model password state.
- The `users` table currently has `email`, `password_hash`, `name`, `role`, `is_active`, `created_at`, and `updated_at`. There is no persisted first-login or password-reset-required state.
- The app already has an append-only audit log convention for state-changing actions, and user creation/password reset already emit `user.create` and `user.password_reset`.

## Proposed Solution

Add a required first-login password-change flow for accounts created with a temporary password.

When a manager creates a worker, the system should store the generated temp password as it does today and also mark the account as requiring a password change. The worker signs in with the temporary password, but before accessing the dashboard or business workflows they are routed to a dedicated password setup page. On that page they enter a new password and confirmation. Once the password is accepted, the system hashes and stores the new password, clears the password-change requirement, audits the change, and redirects the worker to their intended destination or the dashboard.

The same underlying mechanism should be usable for manager password resets, because reset passwords are also temporary. The product requirement is first-login after creation; applying the flag to password reset should be treated as a recommended extension unless the team explicitly wants reset passwords to remain reusable.

## User Stories

1. As a newly created worker, I want to sign in with the temporary password and immediately set my own password, so I do not keep using a manager-issued credential.
2. As a manager, I want the worker creation flow to remain simple and still show a temporary password once, so I can onboard staff without an email delivery dependency.
3. As a manager, I want password resets to optionally force a new custom password, so a reset credential is also temporary.
4. As an auditor, I want password setup completion to be logged without storing the plaintext password, so account security events remain traceable.

## Reuse And Change Surface

### Reuse

- `generateTempPassword` and `hashPassword` in `src/lib/passwords.ts` for bootstrap password generation and bcrypt hashing.
- `createWorker` and `resetUserPassword` in `src/lib/users.ts` as the account lifecycle entry points that should set password-change state.
- Existing Auth.js credentials provider in `src/auth.ts` for validating the temporary password before routing to setup.
- Existing `requireUser` server guard pattern in `src/auth-server.ts` for protecting the setup action and page.
- Existing UI primitives such as `Input`, `Button`, `Alert`, `FormField`, and sign-in password-field behavior for the password setup form.
- Existing audit writer `log()` for recording password setup completion.
- Vitest unit test style in `src/lib/users.test.ts` and existing auth helper tests.

### Modify

- `users` schema and migrations: add a persisted boolean such as `must_change_password` with a default suitable for existing users.
- User creation: set `must_change_password` to `true` for new manager-created workers.
- Password reset: recommended to also set `must_change_password` to `true` when a manager resets a password.
- Auth callbacks/token/session: expose the password-change requirement in a durable way, or use a server-side database check after authentication.
- Middleware or server guard behavior: prevent required-change users from accessing normal protected routes before completing setup, while allowing `/change-password`, `/sign-in`, and `/api/auth`.
- Sign-in redirect handling: after successful temp-password sign-in, route required-change users to the setup page and preserve the original destination.
- User management UI copy: make it clear that temporary passwords are bootstrap credentials and the worker will be prompted to create their own password.

### Net-new

- A password setup page, for example `/change-password`, available only to authenticated users.
- A server action or route handler to validate and save the new password.
- Password validation rules and user-facing validation messages.
- Audit action, for example `user.password_changed`, with payload that does not include password material.
- Tests for the new password-change state, routing/guard behavior, and password update service.

## Implementation Decisions

- Persist the requirement as `users.must_change_password boolean not null default false`.
- Existing users should default to `false` during migration so the feature does not lock out current workers or managers.
- New workers created through the manager UI should be inserted with `mustChangePassword: true`.
- A user who signs in with valid credentials while `must_change_password = true` should be authenticated but restricted to the password setup flow until completion.
- The setup action must require an authenticated active user, validate that `newPassword` and `confirmPassword` match, enforce a minimum password policy, hash the new password with the existing bcrypt helper, set `must_change_password = false`, and write an audit log entry.
- The new password must not equal the temporary password. The implementation can check this by comparing the submitted new password against the current `password_hash` before updating.
- The setup page should not require the user to re-enter the temporary password if they have already authenticated successfully.
- Inactive users remain blocked exactly as they are today.
- Managers should not be able to bypass the requirement for a worker except by resetting the password, which should still leave the worker required to choose a custom password.
- Audit payloads must exclude plaintext passwords and password hashes.

## Tooling And Delivery Plan

- Use `/prd-to-plan` after PRD approval to split delivery into schema, auth routing, setup UI, and test phases.
- Use `/write-tests` or the repo's Vitest patterns to add coverage around the user service and auth guard behavior.
- Use `/design-api` only if the implementation chooses a route handler instead of a server action for password setup.
- Use Drizzle Kit through the existing `npm run db:generate` workflow to create the migration after editing `src/db/schema.ts`.

## Testing And Observability

- Unit-test that `createWorker` sets the password-change requirement for new workers.
- Unit-test that `resetUserPassword` sets the password-change requirement if the reset extension is accepted.
- Unit-test the new password update service: rejects non-matching confirmation, rejects weak passwords, rejects password reuse of the temp password, updates hash, clears the flag, and writes an audit entry.
- Test that existing users with `must_change_password = false` can sign in and access normal routes.
- Test that users with `must_change_password = true` are routed to the setup page and cannot access normal protected pages until completion.
- Test that inactive users cannot use the setup route.
- Log password setup completion as an audit event, but do not add application logs containing credentials.

## Rollout And Migration

- Add a database migration with `must_change_password boolean not null default false`.
- Deploy the migration before code paths start writing or reading the new column.
- Existing users should not be forced through the setup flow unless explicitly backfilled later.
- New users created after deployment should be forced through setup.
- Recommended optional rollout: set `must_change_password = true` on future manager password resets.
- No feature flag is required if the migration default is `false` and the first slice only affects newly created workers.

## Risks And Open Questions

- Auth.js redirect behavior may require careful handling so users are authenticated before being redirected to `/change-password`, without creating redirect loops.
- Middleware reads JWT state, while the source of truth lives in the database. If `must_change_password` is stored in the JWT, the session must refresh after password setup; if middleware queries the database, each protected request becomes more expensive. A practical compromise is to store the flag in the JWT on sign-in and force a sign-in/session refresh after setup, while server-side guards still check the database for correctness where needed.
- Password policy is not defined. Proposed minimum: at least 8 characters, with no match to the current temporary password. Stronger composition rules can be added later if needed.
- The seed-admin script also creates a user with a bootstrap password. Decide whether seeded managers should be forced to change their password on first sign-in. Recommended: yes for generated seed passwords, no when an explicit `--password` is supplied for local/dev use.
- The user request specifically names first login after account creation. Applying the same flow to manager password resets is recommended but should be confirmed before implementation.

## Out Of Scope

- Email-based invitations or password reset links.
- Self-service forgotten-password recovery.
- Multi-factor authentication.
- Password expiry policies.
- Admin ability to view, recover, or export user passwords.
