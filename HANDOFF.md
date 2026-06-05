# BodyBoard — Session Handoff

**Date:** June 5, 2026  
**Project location:** `$HOME/Dev/Bodyboard/`  
**Status:** PWA complete and working. NAS backend written, not yet deployed.  
**Next session goal:** Wire the frontend to the NAS API, verify end-to-end data flow.

---

## Change Log

### June 5, 2026 — Session 1
- Built complete PWA (index.html, sw.js, manifest.json)
- Wrote full NAS backend (server/ directory) — not yet deployed
- **Service Worker registration commented out** in `index.html` (`registerSW()` function body is commented out)
  - Reason: with a live backend, SW only caches the app shell — data still requires network. Offline = app loads but all data is empty, which is misleading. Also causes stale cache headaches during active development.
  - The `manifest.json` is kept — it handles Add to Home Screen, splash screen, and standalone display independently of the SW.
  - The `sw.js` file is kept but not registered — re-enable when backend is stable with a proper network-first API strategy. See note in Next Session below.
  - To re-enable: uncomment the `registerSW()` body in `index.html`. Also clear any previously cached SW from test devices (Safari → Settings → Advanced → Website Data).

---

## What This App Is

A personal **body recomposition and health dashboard** — iPhone-first PWA (Progressive Web App). Built for a specific user with real medical constraints, then designed to be shared with family and friends via a self-hosted NAS backend with per-user private data.

---

## User Context (Drives Design Decisions)

These constraints are **hardcoded assumptions** throughout the app. Do not generalize away from them without checking.

| Attribute | Value |
|---|---|
| Age | 53 |
| Height | 6'0" |
| Current weight | ~173 lbs |
| Current body fat | ~18.8% |
| Lean mass | ~140.5 lbs |
| Goal body fat | 12–14% |
| Daily protein target | 150g |
| Daily calorie target | 1,900 |
| Daily steps target | 8,000 |
| Weight loss context | Lost 103.5 lbs using Tirzepatide |
| Current Tirzepatide dose | 12.5mg, tapering down |

**Medical constraints that affect every workout decision:**
- ACDF (Anterior Cervical Discectomy and Fusion) — NO neck strain, NO free weights overhead, NO behind-the-neck movements
- Mild knee arthritis — NO high-impact, light-to-moderate weight only, controlled tempo
- All exercises are machine-based and seated for this reason

**Meal timing (hardcoded in the app):**
- 11:00 AM — Protein shake (50g target)
- 3:00 PM — Mid-day whole food meal (25g target)
- 6:30 PM — Lean protein dinner (55g target)

---

## What Was Built Today

### File Inventory (`$HOME/Dev/Bodyboard/`)

| File | Description | Status |
|---|---|---|
| `index.html` | Complete single-file PWA — all CSS, HTML, JS inline | ✅ Working |
| `sw.js` | Service Worker — caches app shell for offline use | ✅ Working |
| `manifest.json` | Web App Manifest — PWA metadata, icon (SVG data URI) | ✅ Working |
| `.nojekyll` | Empty file — tells GitHub Pages to skip Jekyll | ✅ Done |
| `server/server.js` | Express app entry point — serves static files + API routes | ✅ Written, not deployed |
| `server/db.js` | SQLite init + all table schemas | ✅ Written, not deployed |
| `server/middleware/auth.js` | JWT verification middleware | ✅ Written, not deployed |
| `server/routes/auth.js` | `/auth/register`, `/auth/login`, `/auth/me` | ✅ Written, not deployed |
| `server/routes/data.js` | All data CRUD — logs, workouts, settings, injections | ✅ Written, not deployed |
| `server/routes/profile.js` | Per-user config — targets, module toggles, custom exercises | ✅ Written, not deployed |
| `server/package.json` | Node.js dependencies | ✅ Written, not deployed |
| `server/Dockerfile` | Docker image build | ✅ Written, not deployed |
| `docker-compose.yml` | Synology deployment config with env vars | ✅ Written, not deployed |
| `OPTIONS.md` | Every architecture option with tradeoffs documented | ✅ Reference doc |
| `NAS-BACKEND.md` | Step-by-step NAS deployment guide with all code | ✅ Reference doc |
| `PROJECT-PLAN.md` | Roadmap + 10 future feature ideas | ✅ Reference doc |
| `HANDOFF.md` | This file | ✅ |

---

## Architecture Decisions Made (and Why)

### Hosting: Synology NAS + Cloudflare Tunnel
- No port forwarding on Google Fiber router (Cloudflare Tunnel uses outbound connection only)
- Home IP never exposed publicly
- Free SSL via Cloudflare
- Data never leaves the house
- Cloudflare Access (free) can add Google login gate in front of the whole domain
- **Target URL:** `https://bodyboard.yourdomain.com`

### Backend: Node.js + Express + SQLite
- SQLite is perfect for this scale (family + friends, not thousands of users)
- `better-sqlite3` is synchronous — simpler code, no async DB calls
- Single `.db` file on the NAS — trivially backed up by Synology's Hyper Backup
- First user to register becomes admin automatically
- Invite code via `INVITE_CODE` env variable controls who can register

### Auth: JWT (30-day expiry)
- Passwords hashed with bcrypt (12 rounds)
- Token stored in `localStorage` on device
- Every API request sends `Authorization: Bearer <token>`
- All DB queries scoped to `WHERE user_id = ?` — users cannot see each other's data

### Per-User Configurability (key design decision)
This was a deliberate choice made today: **the app must not force every user to see GLP-1 tracking, or use the same exercises.** The `user_profiles` table stores:
- `modules_json` — which sections are enabled per user `{"glp1": true, "trt": false, ...}`
- `exercises_json` — each user's custom exercise list (overrides hardcoded defaults)
- Individual targets — protein, calories, steps per user

**This is unimplemented in the frontend yet.** The backend schema supports it; the UI does not yet read from it.

### PWA (not native app yet)
Decision: stay PWA for now, pursue Capacitor later if HealthKit auto-sync becomes a priority. The main things a native app adds are: HealthKit, widgets, push notifications. The PWA already handles everything else.

---

## NAS Backend — What the User Did Between Sessions

Before the next session, the user will:
1. Move project files to `$HOME/Dev/Bodyboard/` and set up git repo
2. Install Container Manager on Synology (if not already there)
3. Set Cloudflare as domain nameserver (if not already done)
4. Create Cloudflare Tunnel and point `bodyboard.yourdomain.com` → `http://localhost:3000`
5. Deploy Docker container via `docker-compose up -d --build` on the NAS
6. Run the curl test commands from `NAS-BACKEND.md §Step 6` to verify API works
7. Optional: configure Cloudflare Access for Google auth gate

**If the NAS deployment went smoothly:** Start directly at "Next Session Work" below.  
**If there were issues:** Check `docker logs bodyboard -f` first. Common problems: JWT_SECRET not set (default is insecure but functional), DB path permissions (check volume mount), port 3000 already in use (change in docker-compose.yml).

---

## Next Session: Connecting the Frontend to the API

This is the primary work remaining. The backend is built; the frontend still uses LocalStorage.

### Step 1: Add Auth UI to index.html

Add a login/register screen that shows when no valid token exists in localStorage. The app currently jumps straight to the dashboard. It needs a gate:

```
On load:
  → Check localStorage for 'auth_token'
  → If none: show login/register screen (full-screen, same dark aesthetic)
  → On successful login: store token, show main app
  → Add a small "Log out" button in the dashboard header or settings
```

The login screen needs:
- Email + password fields
- Toggle between Login / Register
- Register requires: name, email, password, invite code
- Error messages for wrong password, duplicate email, bad invite code

### Step 2: Create an API client module inside index.html

Replace the LocalStorage helper functions (`get`, `set`) with an API client:

```javascript
const API = {
  token: () => localStorage.getItem('auth_token'),
  
  async get(path) {
    const r = await fetch(path, {
      headers: { 'Authorization': `Bearer ${API.token()}` }
    });
    if (r.status === 401) { logout(); return null; }
    return r.json();
  },
  
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API.token()}`
      },
      body: JSON.stringify(body)
    });
    if (r.status === 401) { logout(); return null; }
    return r.json();
  }
};
```

### Step 3: Replace LocalStorage calls — priority order

Do these in this order (each is independently testable):

1. **Daily activity log** — `saveActivity()` → `POST /api/logs/:date`
2. **Dashboard load** — `refreshDash()` → `GET /api/logs/:date` + `GET /api/settings`
3. **Nutrition checks** → stored in `checks_json` column of daily_logs
4. **Workout save** — `saveWorkout()` → `POST /api/workouts`
5. **Daily check-in (Logs tab)** — `saveLog()` → `POST /api/logs/:date`
6. **Settings** (Tirzepatide dose, toggles) → `POST /api/settings` + `GET /api/settings`
7. **Injection log** → `POST /api/injections`
8. **History display** → `GET /api/logs` + `GET /api/workouts`
9. **Profile/configurability** → `GET /api/profile` to read user's module toggles and targets
10. **Export** → pull from API instead of localStorage for JSON/CSV

### Step 4: Apply per-user configurability to the UI

Once profile loads, conditionally show/hide sections:
- If `modules.glp1 === false` → hide entire Tirzepatide card in Nutrition tab
- If `modules.trt === false` → hide Hormone & Labs card
- If `profile.exercises_json.length > 0` → use user's custom exercises instead of hardcoded EXDB
- Use `profile.protein_target`, `profile.calorie_target`, `profile.step_target` instead of hardcoded `T` constants

### Step 5: Offline fallback strategy

Keep LocalStorage as a read cache for the current session:
- On API success: write result to localStorage as backup
- If API call fails (offline): fall back to localStorage silently
- Show a small "Offline — data may not be synced" indicator when API unreachable

---

## Key Implementation Notes (Easy to Forget)

1. **The Service Worker path matters.** `sw.js` must be served from the root (`/sw.js`), not a subdirectory. The current docker-compose setup serves everything from the project root — this is correct.

2. **GitHub Pages subdirectory gotcha.** If the repo is `github.com/user/bodyboard` (not a root `user.github.io` repo), the URL is `https://user.github.io/bodyboard/`. In that case, `manifest.json`'s `start_url` and `sw.js`'s asset paths need a `/bodyboard/` prefix. The NAS deployment does NOT have this issue (served from domain root).

3. **SQLite UNIQUE constraint on daily_logs.** The table has `UNIQUE(user_id, date)` — use the `ON CONFLICT DO UPDATE` (upsert) pattern already in the route, not a separate check-then-insert.

4. **The `checks_json` column stores meal/supplement check state.** It's a JSON object stored in the daily_logs row for that date: `{"m0": true, "m1": false, "m2": true, "creatine": true}`. It gets merged with weight/nutrition data in the same upsert call.

5. **First registered user becomes admin.** This is checked by counting rows in the users table at registration time. If you clear the DB and re-register, the new first user becomes admin.

6. **JWT_SECRET must be set in production.** The default fallback in the code is `'change-this-secret-in-production'`. Fine for local testing, not for live use. Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

7. **Service Worker is written but intentionally not registered.** `registerSW()` in `index.html` has its body commented out. The `sw.js` file exists and is correct. Do not re-enable it until the backend is stable — when you do, upgrade it to network-first for API calls, cache-first for the shell only, with a deploy-time version bump in the cache name. The `manifest.json` (PWA install, home screen icon, standalone mode) is unaffected and active.

8. **The canvas-generated apple-touch-icon is set dynamically.** `setAppIcon()` in index.html runs on `DOMContentLoaded` and injects a `<link rel="apple-touch-icon">` with a base64 PNG generated via canvas. This is what appears on the iPhone home screen. iOS ignores SVG icons in manifest.json.

8. **Workout exercises are hardcoded in `EXDB` in index.html.** Day A = upper push/pull, Day B = lower + core, Day C = full body combo. These will be replaced by per-user `exercises_json` from the profile API in Phase 2.

---

## Open Questions for Next Session

- [ ] Does the user want to keep LocalStorage as a true offline cache with a sync queue, or just use it as a session-level cache that's thrown away on refresh?
- [ ] Should the registration flow be in-app (login screen), or should admin create accounts via the DB directly and share credentials? (Simpler initially)
- [ ] What's the domain that will be used? (Needed to lock down CORS in docker-compose `ALLOWED_ORIGIN`)
- [ ] Does the user want Cloudflare Access (Google login gate) in addition to in-app auth, or just one or the other?

---

## Reference Links

- `NAS-BACKEND.md` — Complete backend code + deployment steps
- `OPTIONS.md` — All architectural options with tradeoffs
- `PROJECT-PLAN.md` — Full roadmap + 10 future feature ideas
