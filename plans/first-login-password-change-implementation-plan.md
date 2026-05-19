# Plan: First-Login Password Change

> Source PRD: `plans/first-login-password-change-prd.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: use `/change-password` as the required setup destination for authenticated users who must replace a temporary password.
- **Schema**: add `users.must_change_password boolean not null default false`; existing accounts remain usable after migration.
- **Key models**: `User` gains password-change state; account lifecycle flows set or clear that state.
- **Authentication**: credentials sign-in still validates email and password through Auth.js; the password-change requirement is enforced after successful authentication.
- **Authorization**: active authenticated users may access `/change-password`; users with `must_change_password = true` may not access normal protected workflows until the flag is cleared.
- **Password policy**: require matching password confirmation, minimum 8 characters, and no reuse of the current temporary password.
- **Audit**: password setup completion emits a password-change audit event with no plaintext password or hash in payloads.
- **Rollout**: no feature flag; migration defaults existing users to `false`, and the first affected users are workers created after deployment.

---

## Phase 1: Bootstrap State On New Workers

**User stories**: 1, 2

### What to build

Add persisted password-change state and wire the worker creation flow so every newly created worker is marked as needing to set a custom password. The manager still creates a worker and sees the temporary password once, but the system now records that the password is only a bootstrap credential.

### Acceptance criteria

- [ ] The database has a non-null `must_change_password` flag for users, defaulting existing users to `false`.
- [ ] New manager-created workers are saved with `must_change_password = true`.
- [ ] Existing users are not forced through password setup after migration.
- [ ] The worker creation success UI states that the temporary password must be changed at first sign-in.
- [ ] Tests verify that worker creation sets the password-change requirement and preserves existing temp-password behavior.

---

## Phase 2: Authenticated Password Setup Page

**User stories**: 1, 4

### What to build

Create the first complete password setup path. A newly created worker can sign in with the temporary password, land on `/change-password`, submit a custom password, and have the account updated so the new password becomes the only valid password.

### Acceptance criteria

- [ ] `/change-password` is only available to authenticated active users.
- [ ] The page lets the user enter and confirm a new password without re-entering the temporary password.
- [ ] The setup flow rejects short passwords, mismatched confirmation, and reuse of the current password.
- [ ] Successful setup hashes the new password, clears `must_change_password`, and writes an audit event without credential material.
- [ ] After successful setup, the user is sent to the dashboard or the originally requested safe destination.
- [ ] Tests cover successful setup and validation failures.

---

## Phase 3: Enforce Setup Before App Access

**User stories**: 1

### What to build

Restrict users who still have `must_change_password = true` so they cannot use normal protected application routes. This phase closes the bypass where a user could authenticate with the temporary password and navigate directly to inventory, approval, report, or user-management pages.

### Acceptance criteria

- [ ] Authenticated users with `must_change_password = true` are redirected to `/change-password` from protected app routes.
- [ ] `/change-password`, `/sign-in`, and Auth.js API routes do not create redirect loops.
- [ ] Users with `must_change_password = false` continue to access protected routes normally.
- [ ] Inactive users remain blocked from protected routes and password setup.
- [ ] Tests cover required-change routing, normal access, and loop prevention.

---

## Phase 4: Temporary Password Resets Also Require Setup

**User stories**: 3, 4

### What to build

Extend the same first-login mechanism to manager password resets. When a manager resets a user's password, the generated temporary password becomes a bootstrap credential and the target user must choose a custom password on next sign-in.

### Acceptance criteria

- [ ] Manager password reset sets `must_change_password = true` for the target user.
- [ ] The reset-password UI copy explains that the temporary password must be changed on next sign-in.
- [ ] A user signing in with a reset temporary password is routed through the same `/change-password` flow.
- [ ] Password reset and password setup each produce distinct audit events.
- [ ] Tests verify reset behavior, setup enforcement after reset, and unchanged manager authorization rules.

---

## Phase 5: Seeded Manager Bootstrap Policy

**User stories**: 4

### What to build

Apply the password-change state consistently to the first-manager seed path. Generated seed passwords should force setup on first sign-in, while explicit development passwords can remain immediately usable if the team keeps that escape hatch.

### Acceptance criteria

- [ ] A seeded manager created with a generated password is marked with `must_change_password = true`.
- [ ] A seeded manager created with an explicit password follows the agreed policy for local/development usage.
- [ ] Seed output tells the operator whether the manager will be forced to change the password.
- [ ] Tests or documented manual verification cover both generated and explicit-password seed paths.

---

## Phase 6: End-To-End Polish And Operational Readiness

**User stories**: 1, 2, 3, 4

### What to build

Harden the full onboarding and reset experience so it is safe to deploy. This phase verifies the complete flow across creation, sign-in, setup, normal access, reset, and audit history.

### Acceptance criteria

- [ ] A manager can create a worker, copy the temporary password, and the worker can complete first-login setup end to end.
- [ ] A manager can reset a password, and the target user is forced through setup before normal app access.
- [ ] Browser-facing copy consistently describes temporary passwords as one-time bootstrap credentials.
- [ ] Full test suite passes.
- [ ] Manual smoke test instructions are documented for local and production-like environments.
- [ ] Rollout notes call out the migration order and the fact that existing users are not backfilled.
