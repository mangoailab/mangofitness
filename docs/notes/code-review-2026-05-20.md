# Mango Fitness code/security review — 2026-05-20

## Executive summary

I reviewed the static frontend, Supabase SQL/RLS/RPC files, and Edge Functions with focus on coach vs athlete boundaries, data integrity, autosave/delete behavior, XSS, secrets exposure, and mobile/responsive risk.

No production behavior was changed. I found several important issues to fix before treating this as production-safe. The biggest concerns are server-side data integrity gaps around athlete result writes/status writes, a likely unprotected AI parsing Edge Function, and historical benchmark RPC duplication/visibility behavior.

## High priority issues

1. **Athletes can write result rows for any known workout exercise ID**
   - Files: `assets/app.js`, `supabase/harden-rls.sql`, `supabase/schema-draft.sql`
   - Current RLS for `athlete_workout_results` insert/update checks only that `auth_user_id = auth.uid()` and `athlete_id in current_athlete_ids()`.
   - It does **not** check that `workout_exercise_id` belongs to a workout the athlete is allowed to see or is assigned to.
   - Impact: an athlete with a valid session could craft direct Supabase requests to log results against another individual athlete’s workout exercise if they learn/guess the UUID. This can pollute coach history and leaderboard records for that athlete’s own profile.
   - Recommended fix: add a `can_log_workout_exercise(exercise_id, athlete_id)` SQL helper and require it in insert/update `with check`. It should allow coach writes, the athlete’s visible/everyone workouts, assigned individual workouts, athlete-created workouts assigned to that athlete, and historical benchmark placeholder exercises if intended.

2. **`parse-body-scan` Edge Function appears to allow OpenAI API use without app-level auth verification**
   - File: `supabase/functions/parse-body-scan/index.ts`
   - The function accepts POST requests, calls OpenAI with `OPENAI_API_KEY`, and does not verify the Supabase user/JWT or check athlete identity in code.
   - Supabase Edge Functions may enforce JWT at deploy/config level, but the repo does not show that guarantee. If deployed with `--no-verify-jwt`, or if config changes later, this becomes an abuse/billing endpoint.
   - Impact: anyone who discovers the function URL could send images/base64 payloads and consume OpenAI quota.
   - Recommended fix: explicitly verify `Authorization` using `supabase.auth.getUser(token)` before doing any OpenAI call. Reject missing/invalid users. Add image count/size limits and a clearer 401/403 response.

3. **Athlete direct result writes can mark arbitrary PRs and influence leaderboard-like views**
   - Files: `assets/app.js`, `supabase/leaderboard-checkbox-only.sql`, `supabase/schema-draft.sql`
   - `is_pr` is client-provided and accepted by RLS. `leaderboard_results()` uses athlete result data and notes from the database.
   - Impact: athletes can intentionally or accidentally create misleading PR/leaderboard data through direct API calls. The UI auto-PR logic helps normal use, but server-side rules are the authority.
   - Recommended fix: consider moving PR detection to a SQL RPC or server-side validation path. At minimum, restrict what athlete clients can set for `is_pr`, or keep `is_pr` as athlete-reported until coach-verified.

## Medium priority issues

1. **Workout status RPC can mark any known workout UUID as done/skipped**
   - File: `supabase/workout-status.sql`
   - `set_athlete_workout_status()` is `security definer` and only checks that the caller has an athlete profile. It does not check `public.can_view_workout()` or an assignment relationship for `p_workout_id`.
   - Impact: a user can mark status for a workout they are not assigned to if they know the UUID. This is lower sensitivity than result writes, but it weakens data integrity.
   - Recommended fix: before insert/upsert, verify the workout is visible/loggable for `v_athlete_id`. Also remove `skipped` support if the product intentionally does not support skip.

2. **Historical benchmark RPC creates duplicate hidden workouts**
   - File: `supabase/historical-benchmark-rpc.sql`
   - The statement `insert into public.workouts (...) on conflict do nothing` has no unique constraint to conflict on, so every call can insert another `Historical Benchmarks` workout.
   - The function then selects the earliest matching hidden workout, leaving duplicates behind.
   - Impact: database clutter, confusing coach/admin data, and possible future display issues.
   - Recommended fix: add a stable unique key/constraint for the hidden system workout, or replace with `select first; if null then insert;` inside the function.

3. **Historical benchmark placeholder workout is `assignment_type = 'everyone'`**
   - File: `supabase/historical-benchmark-rpc.sql`
   - Because `can_view_workout()` allows `everyone`, the hidden historical benchmark workout may be visible to all authenticated athletes if it appears in normal workout queries.
   - Impact: possible confusing “Historical Benchmarks” item in athlete workout lists, depending on date filters and UI.
   - Recommended fix: use a dedicated non-visible assignment type such as `system_history`, and update `can_view_workout()` and UI filters intentionally.

4. **Autosave can race and overwrite newer field values**
   - File: `assets/app.js`
   - Each result form schedules autosave after 900ms. There is no per-form in-flight cancellation/version guard.
   - Impact: on slow network, an earlier save can finish after a later save and leave stale data in the database. This is especially possible when athletes type quickly or change multiple set rows.
   - Recommended fix: track a monotonically increasing save version per form and ignore/avoid stale completions. Disable manual submit while an autosave is in-flight or force the manual submit to wait for/cancel the pending autosave.

5. **Result delete is broader in store than some UI contexts imply**
   - File: `assets/app.js`
   - `MangoFitnessStore.deleteResult(id)` deletes by ID only. RLS protects cross-athlete deletes, but it allows an athlete to delete any of their own result rows, including historical/coach-programmed results.
   - Impact: may be intended, but if coach-programmed results should remain auditable, deletion should be restricted or soft-deleted.
   - Recommended fix: decide product rule. If auditability matters, replace hard delete with `deleted_at`/`deleted_by`, or restrict athlete deletion to athlete-created/self-reported entries.

6. **Edge Function returns temporary passwords to browser UI**
   - Files: `supabase/functions/create-athlete-user/index.ts`, `assets/app.js`
   - This is probably intentional for coach setup, and the service role key is not exposed. Still, temporary passwords are displayed in plain text in the coach browser.
   - Impact: accidental shoulder-surfing/screenshots/chat copy risk.
   - Recommended fix: prefer reset links/invites over showing passwords, or show the password once with a copy button and a warning. Ensure no analytics/logging captures function responses.

## Low priority/cleanup

- `create-athlete-user` returns application errors with HTTP 200 via `appError()`. This works with the frontend but makes monitoring/debugging harder. Prefer proper 4xx/5xx statuses.
- `findAuthUserByEmail()` scans only 20 pages of users. That is fine for now, but it will silently fail above 2,000 Auth users.
- `current_athlete_ids()` uses both `auth_user_id` and email fallback. Useful during migration, but long-term it is safer to require `auth_user_id` linking only, once all athletes are linked.
- Several SQL files duplicate functions/policies (`schema-draft.sql`, `harden-rls.sql`, incremental files). Add a clear migration order or a single canonical production migration to prevent applying stale policy definitions.
- `supabase-config.js` exposes the Supabase anon key. That is normal for Supabase browser apps, but keep reminding future reviewers that the anon key must rely on RLS, not secrecy.
- No automated responsive/mobile visual checks are present. CSS has extensive mobile rules, but I did not run browser screenshots.

## Security notes

- XSS posture is generally good in the frontend. Dynamic HTML rendering consistently uses `escapeHtml()` for user-controlled text in the reviewed paths. `textContent` is used for messages. I did not find obvious raw user input inserted into HTML without escaping.
- The main security model correctly avoids service-role keys in browser code. The only service-role usage found is inside the `create-athlete-user` Edge Function.
- Coach page UI correctly passes `requiredRole: "coach"`, and `auth.js` hides coach dashboards when `coach_profiles` does not contain the signed-in user. This is a useful UX layer, but RLS/RPC checks remain the real boundary.
- Public authenticated reads for benchmark/movement/warmup libraries appear intentional. They should stay read-only for athletes.
- `Access-Control-Allow-Origin: *` is acceptable only if all sensitive functions require and verify user auth. For `parse-body-scan`, add explicit auth verification.

## Upgrade suggestions

1. Create server-side RPCs for athlete logging instead of direct table writes to `athlete_workout_results`. This lets you enforce visible workout/exercise, PR rules, field validation, and audit behavior in one place.
2. Add a small SQL test checklist for RLS:
   - athlete cannot select another athlete’s profile/results/body scans
   - athlete cannot insert result for unassigned individual workout exercise
   - athlete can insert/update own assigned/everyone workout result
   - athlete cannot mark status on unassigned workout
   - coach can manage athletes/workouts/results
3. Add `updated_at`, `deleted_at`, and `deleted_by` to result-like tables if auditability matters.
4. Add Edge Function auth middleware/shared helper for all functions using secrets or admin/service role.
5. Add lightweight browser smoke tests for the main pages: sign-in gate, athlete workout logging, coach client list, history page, and body scan parse/save flow.

## Commands/checks run

```bash
pwd && ls -la && find . -maxdepth 2 -type f | sed 's#^./##' | sort | head -200
find assets supabase docs -type f -maxdepth 3 -print | sort && git status --short && git log --oneline -5
wc -l *.html assets/*.js assets/*.css supabase/*.sql supabase/functions/*/index.ts
grep -RInE "innerHTML|insertAdjacentHTML|outerHTML|eval\(|localStorage|sessionStorage|delete\(|rpc\(|from\(|auth|role|coach|athlete|admin|service_role|anon|apikey|secret|password|textContent|escape|sanitize|onerror|onclick|autosave|setTimeout|setInterval" . --exclude-dir=.git --exclude='*.png' --exclude='*.svg'
node --check assets/app.js
node --check assets/auth.js
grep -RIn "security definer\|grant execute\|using (true)\|with check (true)\|service_role\|SUPABASE_SERVICE_ROLE_KEY\|OPENAI_API_KEY\|Access-Control-Allow-Origin" supabase assets docs README.md --exclude-dir=.temp
```

Notes:
- `rg` was not installed, so I used `grep`.
- No `package.json` or test runner was present, so I could not run lint/unit tests.
- I did not run destructive commands, migrations, deploys, or production writes.

## Files reviewed

- `assets/app.js`
- `assets/auth.js`
- `assets/supabase-config.js`
- `assets/styles.css` partially, for responsive/mobile context
- `admin.html`
- `athlete.html`
- `athlete-history.html`
- `athlete-leaderboard.html`
- `athlete-metrics.html`
- `coach-benchmarks.html`
- `coach-clients.html`
- `coach-history.html`
- `coach-movements.html`
- `reset-password.html`
- `supabase/harden-rls.sql`
- `supabase/schema-draft.sql`
- `supabase/workout-status.sql`
- `supabase/athlete-self-workout-rpc.sql`
- `supabase/historical-benchmark-rpc.sql`
- `supabase/leaderboard-checkbox-only.sql`
- `supabase/decouple-benchmarks-from-leaderboard.sql`
- `supabase/standard-movements.sql`
- `supabase/functions/create-athlete-user/index.ts`
- `supabase/functions/parse-body-scan/index.ts`
- `docs/notes/project-summary.md`
- `docs/notes/decisions.md`
- `docs/notes/todo.md`
- `README.md`
