# BodyBoard — Project Plan

A personal body recomposition and health tracking app built for real, daily use.
Designed around a specific 53-year-old user's medical context (ACDF neck surgery,
knee arthritis, Tirzepatide taper, post-103lb weight loss), then generalized for
family and friends — with per-user configurability at the core.

---

## Project Philosophy

> **Track what matters, skip what doesn't. Every user's dashboard should reflect
> their actual protocol — not a generic template.**

- No mandatory fields. No judgment. No noise.
- Medical constraints are first-class (exercise form reminders, safe movement only)
- Data lives where you control it (your NAS, your domain, your rules)
- Rapid iteration over perfection — ship, use, improve

---

## Current State (v0.1 — MVP)

- [x] Single HTML5 file, fully self-contained
- [x] Apple Health-inspired dark mode UI (iPhone-optimized)
- [x] 4-tab navigation: Dashboard, Workout, Nutrition/Meds, Logs
- [x] Dashboard: 3 animated progress rings (Protein, Calories, Steps), live lean mass calculation, protein breakdown bars
- [x] Workout tracker: 3-day split (A/B/C), 3 sets per exercise with weight/reps logging, exercise-specific safety form reminders
- [x] Nutrition checklist: meal timing (11AM/3PM/6:30PM), supplement tracking, Tirzepatide dose selector + injection logger, TRT/Labs toggles
- [x] Logs tab: daily weight/BF% check-in, history list, JSON + CSV export
- [x] LocalStorage persistence (per device)
- [x] PWA: Service Worker (offline-capable), Web App Manifest, dynamic iOS home screen icon
- [x] GitHub-ready: `.nojekyll` for Pages deployment

---

## Phase 1: NAS Backend + Multi-User Auth (Now)

**Goal:** Replace LocalStorage with a real backend. Per-user login, private data, any device.

- [ ] Node.js + Express + SQLite API (`server/` directory)
- [ ] JWT authentication (register/login/me)
- [ ] Invite code registration control
- [ ] Per-user profile: custom targets, module toggles, custom exercises
- [ ] API routes: logs, workouts, settings, injections, profile
- [ ] Docker + docker-compose deployment on Synology
- [ ] Cloudflare Tunnel pointing domain to NAS
- [ ] Optional: Cloudflare Access for Google auth gate
- [ ] Update `index.html` to call API instead of LocalStorage
- [ ] LocalStorage remains as offline cache / session buffer

**Reference:** See `NAS-BACKEND.md` for full implementation guide.

---

## Phase 2: Per-User Configurability (Next)

**Goal:** Each user's app reflects their actual protocol. Nothing is hardcoded.

- [ ] Login/register screen in the app UI
- [ ] Profile setup wizard on first login (age, height, targets, which modules to enable)
- [ ] Module toggles surfaced in Settings tab:
  - GLP-1 / Tirzepatide tracker (on/off)
  - TRT / Hormone section (on/off)
  - Creatine / supplements (on/off)
  - Custom medications (add any med + dose + frequency)
- [ ] Custom exercises: add/remove/reorder exercises per user, assign to workout days
- [ ] Adjustable targets per user (protein, calories, steps)
- [ ] Workout days configurable (rename, add Day D, etc.)

---

## Phase 3: Visualization + Progress (Soon)

**Goal:** Make progress visible. Numbers in a list don't motivate — trend lines do.

- [ ] Weight trend chart (SVG line graph, last 30/60/90 days)
- [ ] Body fat % trend overlay
- [ ] Lean mass trend (the number that matters most for recomposition)
- [ ] Workout volume chart (total lbs lifted per session over time)
- [ ] Personal records (PR) tracking per exercise — highlight when a new best is hit
- [ ] Protein goal streak counter (days in a row hitting target)
- [ ] Weekly summary card: avg weight, avg protein, workouts completed

---

## Phase 4: Smarter Daily Experience

**Goal:** Reduce friction on the things you do every single day.

- [ ] Time-aware UI — highlight which meal is coming up next based on current time
- [ ] Injection due reminder — red badge on Nutrition tab when weekly injection is overdue
- [ ] Workout suggestion — "You last did Day B on Monday — Day C is next"
- [ ] Push notifications (iOS 16.4+ PWA or Capacitor):
  - 11AM reminder: log your shake
  - 6PM reminder: log dinner
  - Weekly: injection due
- [ ] Quick-log widget: tap the home screen icon → bottom sheet to log a meal check without opening the full app

---

## 5–10 Future Improvement Ideas (Killer App Features)

---

### 1. HealthKit Auto-Sync (via Capacitor)
**Impact: High** — eliminates the biggest friction point in daily use.

Connect to Apple Health to automatically pull:
- Daily step count (no manual entry)
- Weight from smart scales (Withings, Renpho, Eufy)
- Body fat % from connected scales
- Active energy from Apple Watch workouts
- Write logged workouts back to Apple Health

**Why it's a killer feature:** You open the app and your rings are already partially filled before you touch anything. The app meets you where your data already lives.

**Path:** Wrap in Capacitor + `@capacitor-community/health-kit` plugin. See `OPTIONS.md §3B`.

---

### 2. AI Weekly Coach Summary
**Impact: High** — turns raw numbers into actionable insight.

Every Sunday, generate a personalized weekly summary using the Claude API:

> "This week you averaged 147g protein (98% of goal), lost 0.8 lbs, and completed
> 2 of 3 workouts. Your step count dropped Thursday–Saturday — watch for the
> weekend pattern. Lean mass held steady at 140.2 lbs. On track for 14% BF by August."

The summary is generated from the user's actual logged data — not generic advice.
Could also flag: missed injections, dramatic weight swings, protein deficit days.

**Path:** Small Node.js job on the NAS calls Claude API weekly, stores summary,
surfaces it on Dashboard as a collapsible card.

---

### 3. Body Composition Progress Photos
**Impact: High** — the most motivating data point for recomposition.

A dedicated photo log tied to weekly check-ins:
- Take a front/side/back photo in-app
- Photos stored privately on your NAS (not a third-party service)
- Side-by-side comparison view: today vs. 4 weeks ago, today vs. start
- Optional: overlay weight/BF% stats on the photo for visual anchoring

**Why it's important:** The scale can be misleading during recomposition (weight stays
flat while body visibly changes). Photo evidence of the loose skin tightening over
time is what sustains motivation.

**Path:** Standard file upload to NAS backend. Photos stored in `/data/photos/{user_id}/`.

---

### 4. Workout Template Library (Shareable)
**Impact: Medium-High** — makes the app genuinely useful for family/friends with different goals.

- Admin can create workout templates (e.g., "Beginner Lower Body", "Home Resistance Bands")
- Users browse and adopt a template into their workout tab
- Templates carry exercise-specific form tips and contraindications
  (e.g., "Not recommended if: knee replacement, neck fusion")
- Users can modify adopted templates without affecting the original

**Why it matters:** Right now exercises are hardcoded. To share with a 35-year-old friend
who has no physical limitations, they need completely different exercises. Templates solve this
without requiring each user to build from scratch.

---

### 5. Medication & Supplement Taper Planner
**Impact: Medium-High** — directly relevant to the current Tirzepatide taper.

A visual taper schedule:
- Input: current dose, target dose, taper interval (weekly/biweekly)
- Output: a calendar-style schedule showing each dose reduction date
- Injection log auto-checks off against the schedule
- Alert if an injection is missed beyond the window
- Generalizable to any tapering medication (steroids, etc.)

**Why it matters:** GLP-1 drugs are being used by millions. A smart taper tracker
that integrates with injection history logging doesn't exist in most apps.
This is a genuinely differentiated feature.

---

### 6. Protein & Meal Builder
**Impact: Medium** — closes the gap between "did I hit my goal" and "what should I eat."

Instead of just logging a number, log actual meals:
- Search a basic food database (USDA API is free)
- Save frequently eaten meals as favorites
- Auto-calculates protein + calories per meal
- Shows remaining macros for the rest of the day
- Meal templates: "My usual dinner = chicken breast + rice + broccoli = 55g protein"

**Why it matters:** Hitting 150g protein is hard without knowing which foods to combine.
A lightweight meal builder (not a full MyFitnessPal clone) tied to your actual meal
timing schedule makes the daily target concrete.

---

### 7. Shared Progress (Optional, Opt-In)
**Impact: Medium** — social accountability without social media.

Private leaderboard / accountability view for a small trusted group:
- Users opt in explicitly per metric (steps only, workouts only, etc.)
- Weekly step challenge: see who in your group hit their step goal
- Workout streaks visible to the group
- No weight or body fat data ever shared without explicit per-field consent
- Zero public visibility — only your invited group

**Why it matters:** The accountability effect is real. A weekly steps challenge
with two or three people you know drives consistency more than solo tracking.

---

### 8. Smart Scale Integration (Direct API)
**Impact: Medium** — for users with supported scales, fully automates body composition tracking.

Direct API integration with:
- **Withings** (best API, includes body fat via bioimpedance)
- **Renpho** (most popular budget option)
- **Eufy Smart Scale**

On each daily log view, the app pulls the most recent measurement from the scale API
and pre-fills weight and body fat. User just confirms and saves.

**Path:** OAuth token per user, stored in settings table. Scheduled background job on
NAS polls scale APIs daily and writes to daily_logs.

---

### 9. Loose Skin & Visual Progress Tracker
**Impact: Medium** — specific to significant weight loss journeys.

A dedicated section for tracking the recomposition goal beyond just weight:
- Measurement logging: chest, waist, hips, arms, thighs (in inches)
- Rate of change for each measurement over time
- "Tightening index" — custom metric comparing waist-to-lean-mass ratio over time
- Skin fold estimate tracking (if using calipers)
- Goal visualization: current vs. target measurements with estimated timeline

**Why it's different:** After losing 100+ lbs, standard BMI/weight metrics
don't capture the goal accurately. This tracks the specific transformation
from loose skin to muscle definition that defines body recomposition success.

---

### 10. Capacitor Native App + App Store Distribution
**Impact: Long-term High** — makes sharing as simple as "search BodyBoard on the App Store."

Full native iOS app wrapping the existing HTML/JS via Capacitor:
- One-click App Store install (no URL to remember, no "Add to Home Screen" tutorial)
- Native HealthKit integration (see #1)
- Home screen widgets: protein ring, step ring, today's workout
- Background sync — data syncs to NAS even when app is in background
- Face ID / Touch ID login
- Haptic feedback on check-ins
- Siri Shortcuts: "Log my protein shake"

**Path:** See `OPTIONS.md §3B` for full Capacitor setup details.
This is the natural evolution of the PWA once the backend and feature set are stable.

---

## Roadmap Summary

| Phase | Focus | Status |
|---|---|---|
| v0.1 | MVP — single HTML, LocalStorage, PWA | ✅ Done |
| v0.2 | NAS backend + multi-user auth | 🔨 In Progress |
| v0.3 | Per-user configurability (modules, exercises, targets) | 📋 Planned |
| v0.4 | Progress charts + visualizations | 📋 Planned |
| v0.5 | Smart daily UX (time-aware, reminders, push notifications) | 📋 Planned |
| v1.0 | HealthKit + AI weekly summary + photo log | 🔮 Future |
| v1.x | Capacitor native app + App Store | 🔮 Future |

---

## Technical Debt to Address

- [ ] Frontend: replace all LocalStorage calls with API calls (Phase 2)
- [ ] Add loading states and error handling to all async operations
- [ ] Add input validation on API routes (currently trusts client data)
- [ ] SW cache versioning strategy (currently manual — should auto-invalidate on deploy)
- [ ] Rate limiting on all auth routes (partially done, extend to data routes)
- [ ] Token refresh flow (current tokens expire after 30 days, no silent refresh)
