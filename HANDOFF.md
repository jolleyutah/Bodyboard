# BodyBoard — Session Handoff

**Date:** June 5, 2026
**Project location:** `$HOME/Dev/Bodyboard/`
**Status:** Supabase backend wired up, auth working, all data syncing. Ready for feature work.

---

## What Was Accomplished This Session

### Architecture pivot (NAS → managed cloud)
- **Dropped** the NAS Node.js/SQLite backend plan entirely
- **New stack:**
  - Frontend: `index.html` (single file PWA) — no change to file structure
  - Backend: **Supabase** (auth + PostgreSQL + RLS)
  - Hosting: **Cloudflare Pages** (not yet deployed — still on NAS nginx for now)
  - Native (future): **Capacitor** wrapper → App Store, then **Swift** rewrite for full Apple ecosystem

### Why this stack
- No server to manage
- Supabase handles auth, data, sync across devices, and Row Level Security
- Capacitor wraps the existing HTML/JS for App Store with zero rewrite
- Swift rewrite planned as a future phase when full Apple ecosystem (HealthKit, widgets, Siri, HomeKit) is the priority
- Supabase is the bridge — same DB, same data, Swift just uses the Swift SDK instead of JS SDK

### Supabase project
- **URL:** `https://gfmtullwlrcaehjokjju.supabase.co`
- **Publishable key:** `sb_publishable__JDb9xPSxomIYI44FqK0rg_VoI0ZlbV`
- **Auth Site URL:** set to `https://bodyboard.jolleyutah.com`

### Schema created (all tables have RLS enabled)
| Table | Purpose |
|---|---|
| `user_profiles` | Per-user targets, module toggles, preferences |
| `exercises` | Shared library (user_id IS NULL) + user custom exercises |
| `daily_logs` | Weight, BF%, protein, calories, steps, meal checks, notes — one row per user per date |
| `workout_logs` | Completed workout sessions with exercises JSON |
| `settings` | Key/value store per user (tzdose, trt toggle, labs toggle, etc.) |
| `injection_logs` | Medication injection history |

Default exercises seeded into `exercises` table (user_id = NULL, is_default = true).

Auto-trigger: when a user signs up, a `user_profiles` row is created automatically via `handle_new_user()` trigger.

### Frontend changes (index.html)
- Added Supabase JS client via CDN
- Added full-screen auth overlay (sign in / sign up, dark aesthetic, matches app style)
- App checks session on load — shows auth screen if not logged in
- On login: fetches all data from Supabase → populates localStorage → renders
- Every save fires a background sync to Supabase (fire-and-forget, localStorage-first for speed)
- Sign Out button added to Backup & Export section
- Functions wired to sync: `saveActivity`, `saveLog`, `saveWorkout`, `chk`, `logInj`, `setDose`, `saveTog`, `saveNotes`

### Auth confirmed working
- Sign up → confirmation email → click link → lands on `bodyboard.jolleyutah.com`
- First user (David Jolley / jolleyutah@gmail.com) confirmed and signed in

---

## Cloudflare Pages — Not Yet Done

The app is still hosted on NAS nginx (`bodyboard-static` Docker container). Cloudflare Pages deployment is the next infrastructure step. Steps when ready:

1. Push `index.html`, `sw.js`, `manifest.json` to a GitHub repo (already in git)
2. Cloudflare dashboard → Pages → Create project → Connect GitHub repo
3. No build step needed (static HTML) — output directory is `/` (root)
4. After deploy, the Cloudflare Pages URL becomes the canonical URL
5. Update Supabase Auth → URL Configuration → Site URL to the Pages URL
6. Optionally add a custom domain in Pages settings (`bodyboard.jolleyutah.com`)
7. Retire the `bodyboard-static` Docker container on NAS

---

## Features Planned for Next Sessions

These are the user's stated priorities, in rough order:

### 1. First-Launch Onboarding
**Problem:** App currently hardcodes David's stats (173 lbs, 18.8% BF, 150g protein, 1900 cal, 8000 steps). A new user sees David's numbers.
**Goal:** First launch detects empty profile → shows onboarding flow → user enters stats → app calculates targets.

Onboarding screens needed:
- Basic stats: age, height, current weight, current body fat %
- Goal selection: lose fat / build muscle / body recomposition / maintain
- Activity level: sedentary / lightly active / moderately active / very active
- Calculate and display suggested targets (protein, calories, steps) with ability to adjust
- Save to `user_profiles` table

Protein formula: ~0.8–1g per lb of lean mass (or bodyweight for simplicity)
Calorie formula: BMR (Mifflin-St Jeor) × activity multiplier, then deficit/surplus based on goal

### 2. Module Selection at First Launch
**Problem:** GLP-1 (Tirzepatide), TRT, HGH sections are currently always visible.
**Goal:** During onboarding, ask which apply:
- "Are you currently on a GLP-1 medication? (Ozempic, Wegovy, Tirzepatide, etc.)"
- "Are you on TRT (Testosterone Replacement Therapy)?"
- "Are you on HGH?"
- Answers stored in `user_profiles.modules` JSON
- Sections hidden/shown based on user's answers
- Toggleable in settings later

### 3. Exercise Library + Goal-Based Routine Builder
**Problem:** Exercises are hardcoded in `EXDB` (Day A/B/C). No way to add/remove or build a custom routine.
**Goal:**
- UI to browse the exercise library (already seeded in `exercises` table with muscle_group, equipment, tip, days)
- Ask user for fitness goals (strength, endurance, weight loss, etc.) and equipment available
- Suggest a starting routine based on goals + user's medical constraints (ACDF, knee arthritis — stored in profile)
- User can accept suggestions and add/remove exercises
- Custom exercises saved to `exercises` table with user's `user_id`
- Routine (which exercises in Day A/B/C) stored in `user_profiles` or a new `routines` table

Note: medical constraints (ACDF, knee arthritis) should be collected during onboarding and stored in `user_profiles`. These constraints filter out dangerous exercises automatically.

### 4. Food Search / Nutrition Lookup
**Problem:** User has to manually enter protein and calorie numbers.
**Goal:** Search bar in Nutrition tab — "I ate a Subway Coldcut 6" sandwich" → returns nutrition info → tap to log it.

Options (in order of preference):
- **Open Food Facts API** (free, no key, huge database): `https://world.openfoodfacts.org/cgi/search.pl?search_terms=subway+coldcut&json=1`
- **USDA FoodData Central** (free, requires API key): `https://api.nal.usda.gov/fdc/v1/foods/search`
- **Nutritionix** (best natural language, e.g. "6 inch subway coldcut", but paid)

Suggested flow:
1. Search input in Nutrition tab
2. Results list with food name + quick macros (cal / protein / carbs / fat)
3. Tap result → pre-fills calorie and protein fields for the day
4. Multiple items accumulate (breakfast + lunch + dinner)
5. Daily log tracks total, not individual items (for simplicity)

---

## Current Hardcoded Values to Replace During Onboarding

These are scattered in `index.html` and should be pulled from `user_profiles` after onboarding:

```javascript
const T = { protein:150, cals:1900, steps:8000, meals:[50,25,55] };
```

Also:
- Dashboard fallback values: `173` lbs, `18.8%` BF, `(173*.812).toFixed(1)` lean mass
- Meal timing labels: 11:00 AM, 3:00 PM, 6:30 PM (could become user-configurable)

---

## Key Implementation Notes

1. **localStorage is a cache, not source of truth.** On load, data comes from Supabase. Saves go to localStorage immediately (for speed) and sync to Supabase in the background. If offline, localStorage has the last known state.

2. **Service Worker is intentionally disabled.** `registerSW()` body is commented out. Re-enable when backend is stable — use network-first for API calls, cache-first for app shell only.

3. **`exercises` table: global vs. user rows.** `user_id IS NULL` = global default visible to everyone. `user_id = <uuid>` = user's custom exercise. RLS policy allows reading both, but only writing/updating own rows.

4. **`user_profiles` is auto-created on signup** via the `handle_new_user()` trigger with default values. Onboarding flow should UPDATE this row, not insert.

5. **`daily_logs` upsert uses `onConflict: 'user_id,date'`** — safe to call multiple times per day, always merges into the same row.

6. **`workout_logs` uses INSERT** (not upsert) — multiple workouts per day are valid. If deduplication is needed later, add a `unique(user_id, date, day_label)` constraint.

7. **Supabase email confirmation redirect** was fixed by setting Site URL to `https://bodyboard.jolleyutah.com` in Auth → URL Configuration.

8. **The canvas-generated apple-touch-icon** (`setAppIcon()`) is what appears on iPhone home screen. iOS ignores SVG manifest icons.

---

## Files

| File | Status |
|---|---|
| `index.html` | ✅ Working — Supabase auth + sync wired |
| `sw.js` | ✅ Exists, intentionally not registered |
| `manifest.json` | ✅ Working (PWA install, home screen) |
| `NAS-BACKEND.md` | 📦 Archive — NAS backend is abandoned, kept for schema reference |
| `OPTIONS.md` | 📦 Reference |
| `PROJECT-PLAN.md` | 📦 Reference — partially superseded by this file |

---

## Open Questions

- [ ] Cloudflare Pages deployment — when is user ready to do this?
- [ ] Invite code / registration control — open signup or invite-only for family?
- [ ] Onboarding: collect medical constraints (ACDF, knee arthritis) explicitly or pre-populate from known profile?
- [ ] Food search: Open Food Facts (free/no key) or Nutritionix (natural language, paid)?
- [ ] Meal timing: hardcoded (11am/3pm/6:30pm) or user-configurable in onboarding?
