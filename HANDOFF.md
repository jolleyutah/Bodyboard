# BodyBoard — Session Handoff

**Date:** June 15, 2026
**Project location:** `$HOME/Dev/Bodyboard/`
**Status:** Home tab fully redesigned and working on phone. Two phone bugs fixed this session. Auth bypass active for testing.

---

## What Was Done This Session

### Home Tab Redesign (complete)
- Removed progress rings and Quick Log from home
- 4 full-height action cards: Measurements (blue, → logs tab), Workout (green, → workout tab), Nutrition (orange, → nutrition tab), Progress (purple, → logs tab)
- "This Week" banner just above the nav (workouts count, avg protein, streak)
- Time-based greeting ("Good morning/afternoon/evening, [name]")
- Date line: "Today · Monday, June 15"

### 5-Tab Nav (complete)
- Home · Workout · Nutrition · Logs · Profile
- Custom stroke SVG icons matching the card icons: house, dumbbell, apple, bar chart + trend line, person
- Exercise library moved from home to Profile tab

### Auth Bypass for Testing (active)
- `DEV_BYPASS_AUTH = true` at line ~1079 in `index.html`
- Reads profile from localStorage, skips Supabase auth entirely
- **Set to `false` before production deploy**

### Bugs Fixed This Session
1. **"Loading..." / "BodyBoard" not updating on phone** — `refreshHome()` was calling itself recursively on line 1474 instead of calling `refreshDash()`. Stack overflow silently killed all JS. Fixed.
2. **Large empty space below cards on phone** — Home tab wasn't a flex column; cards had fixed `aspect-ratio:1` (square). Fixed with `#tab-home { display:flex; flex-direction:column }`, `action-grid { flex:1; grid-template-rows:1fr 1fr }`, and `ac { aspect-ratio:unset }` so cards fill the screen height.

---

## Current App Structure

### 5 Tabs
| Tab | ID | Purpose |
|---|---|---|
| Home | `tab-home` | 4 action cards + This Week banner |
| Workout | `tab-workout` | Day A/B/C routine log, exercise library |
| Nutrition | `tab-nutrition` | Meal logging, macro targets, protein bars |
| Logs | `tab-logs` | Today's Progress rings, weight history, workout history |
| Profile | `tab-profile` | User settings, targets, routine builder, exercise library |

### Key JS Functions
- `refreshHome()` — calls `refreshDash()` (date/greeting) + `weeklyStats()` (This Week banner)
- `refreshDash()` — updates `home-date`, `home-greeting`, and progress rings in Logs tab
- `renderNutTab()` — renders meal cards in Nutrition tab
- `refreshNut()` — updates macro totals
- `renderEx()` — renders workout day selector + exercise list
- `renderProfileTab()` — renders all profile sections
- `go(tab)` — switches tabs, calls the appropriate refresh function

### Data Layer
- **localStorage first**: all reads/writes go to `localStorage` immediately (keys: `user_profile`, `day_YYYYMMDD`, `chk_YYYYMMDD`, etc.)
- **Supabase background sync**: every save fires a background upsert to Supabase (fire-and-forget)
- `userProfile` global — loaded via `applyProfile()` at startup, holds targets, meal config, routine, constraints, supplements

### Key localStorage Keys
| Key | Contents |
|---|---|
| `user_profile` | Full profile JSON (targets, meal_config, routine, constraints, supplements, name) |
| `day_YYYYMMDD` | `{protein, cals, steps, workout, notes}` for that date |
| `chk_YYYYMMDD` | `{m0, m1, m2, sup0, ...}` meal/supplement check states |
| `wt_log` | Array of `{date, wt, bf}` objects |
| `wo_log` | Array of `{date, day, exercises}` objects |

---

## Files
| File | Status |
|---|---|
| `index.html` | ✅ All app code — single file PWA |
| `sw.js` | ✅ Exists, service worker registration commented out |
| `manifest.json` | ✅ PWA manifest (icons, theme, display) |
| `HANDOFF.md` | This file |

**Deploy:** copy `index.html`, `sw.js`, `manifest.json` to web server at `bodyboard.jolleyutah.com`

---

## Supabase
- **URL:** `https://gfmtullwlrcaehjokjju.supabase.co`
- **Publishable key:** `sb_publishable__JDb9xPSxomIYI44FqK0rg_VoI0ZlbV`
- **Auth site URL:** `https://bodyboard.jolleyutah.com`
- Tables: `user_profiles`, `exercises`, `daily_logs`, `workout_logs`, `settings`, `injection_logs`
- Profile stored in `settings` table as `key='profile'`, `value=JSON.stringify(profile)`

---

## What's Next

### Priority 1 — Measurements Tab / Logs flow
The "Measurements" card on home goes to the Logs tab, but there's no dedicated UI for logging body measurements (weight, body fat %). The Logs tab currently shows Today's Progress rings (protein, calories, steps) and history. Consider:
- A "Log Today's Measurements" card or sheet in the Logs tab
- Fields: weight (lbs), body fat % → auto-calculates lean mass
- Updates the weight history chart

### Priority 2 — Workout Tab polish
- Workout card on home goes to `tab-workout`; the tab shows Day A/B/C selector and exercise list
- Exercise library overlay is in Profile tab (correct); workout tab should use the routine configured there
- Consider: "Start Workout" → timed session mode vs. just logging sets/reps

### Priority 3 — Nutrition Tab polish
- Nutrition card on home goes to `tab-nutrition`; shows meals and macro progress
- Food search (Open Food Facts API) is planned but not started
- Manual macro entry is working

### Priority 4 — Re-enable Auth
- Set `DEV_BYPASS_AUTH = false`
- Test sign-in flow on phone
- Verify Supabase sync still works after the home tab changes

### Priority 5 — Onboarding
- First-launch flow: age, height, weight, BF%, goal, activity level → calculate targets
- Currently app uses hardcoded defaults if no `user_profile` in localStorage
- Onboarding data should UPDATE `user_profiles` row in Supabase (row auto-created on signup)

---

## Known Issues / Watch Out For
- `refreshDash()` still updates protein bar elements (`pb0-n`, `pb1-n`, etc.) that live in `tab-nutrition`. This works because `getElementById` finds them regardless of which tab is visible, but it's a mild coupling to watch.
- The Supabase CDN script (`cdn.jsdelivr.net`) has no `async`/`defer` — it blocks HTML parsing. If CDN is slow, the page will appear rendered but frozen until the script loads. Consider adding `defer` if this causes issues on slow connections.
- Service worker is intentionally disabled (body of `registerSW()` is commented out). Re-enable only after backend is stable — use network-first for API calls, cache-first for app shell.
