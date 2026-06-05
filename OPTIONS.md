# BodyBoard — Architecture & Deployment Options

A reference for every architectural decision made or considered during this project.
Use this to evaluate tradeoffs before committing to a direction.

---

## 1. Hosting Options

### 1A. Local File (Current Starting Point)
Open `index.html` directly in Safari from the Files app.

| | |
|---|---|
| **Cost** | Free |
| **Effort** | Zero |
| **Offline** | Yes |
| **Add to Home Screen** | ❌ Not supported for `file://` URLs on modern iOS |
| **Shareable** | ❌ No |
| **Verdict** | Development only. Not viable for real use. |

---

### 1B. Netlify Drop (Fastest Public Hosting)
Drag-and-drop your files at netlify.com/drop and get a live HTTPS URL instantly.

| | |
|---|---|
| **Cost** | Free tier generous; paid from $19/mo |
| **Effort** | Minutes |
| **Offline** | Yes, after first load (with Service Worker) |
| **Add to Home Screen** | ✅ |
| **Shareable** | ✅ Send the URL |
| **Custom Domain** | ✅ Point your domain to Netlify |
| **Data** | LocalStorage only (per device) unless you add a backend |
| **Verdict** | Great for rapid sharing with no backend. Add backend separately. |

---

### 1C. GitHub Pages
Push files to a GitHub repo, enable Pages in repo Settings.

| | |
|---|---|
| **Cost** | Free |
| **Effort** | 15–30 min setup |
| **Offline** | Yes (with Service Worker) |
| **Add to Home Screen** | ✅ |
| **Shareable** | ✅ `https://username.github.io/bodyboard` |
| **Custom Domain** | ✅ |
| **Updates** | Push to `main` → auto-deploys |
| **Config** | Source: "Deploy from branch" → `main` → `/ (root)`. Add `.nojekyll` file. |
| **Verdict** | Best free option if you already use GitHub. Easy CI/CD. |

**GitHub Pages Setup (exact steps):**
1. Create repo (e.g. `bodyboard`)
2. Push all files to `main` branch
3. Repo → Settings → Pages → Source: **Deploy from a branch**
4. Branch: `main` | Folder: `/ (root)` → Save
5. URL: `https://yourusername.github.io/bodyboard/`

> Note: If using a subdirectory URL (`/bodyboard/`), update `sw.js` cache paths
> and `manifest.json` `start_url` to match the path prefix.

---

### 1D. Synology NAS + Cloudflare Tunnel ✅ (Current Plan)
Self-hosted on your home NAS, exposed via Cloudflare Tunnel with no port forwarding.

| | |
|---|---|
| **Cost** | Cloudflare free tier + your NAS (already owned) |
| **Effort** | 2–4 hours initial setup |
| **Offline** | Yes (Service Worker caches app shell) |
| **Add to Home Screen** | ✅ |
| **Shareable** | ✅ `https://bodyboard.yourdomain.com` |
| **Custom Domain** | ✅ Your domain, your rules |
| **Data** | SQLite on your NAS via Node.js backend |
| **Privacy** | Your home, your server, your data |
| **Uptime** | Depends on NAS availability. UPS recommended. |
| **Verdict** | Best long-term option for self-hosted, private, multi-user. See `NAS-BACKEND.md`. |

**Architecture:**
```
iPhone → Cloudflare (HTTPS/DNS) → Cloudflare Tunnel → Synology NAS
                                                        ├── Web Station (serves index.html)
                                                        └── Docker: Node.js API + SQLite
```

**Why Cloudflare Tunnel instead of port forwarding:**
- No router port forwarding needed (works with Google Fiber's locked-down router)
- Your home IP is never exposed publicly
- Free SSL/TLS automatically
- DDoS protection included
- Cloudflare Access can add Google auth in front of your URL (free)

---

## 2. Data Persistence Options

### 2A. LocalStorage Only (Current)
Data stored in the browser on the device. Zero infrastructure.

| | |
|---|---|
| **Setup** | None |
| **Cross-device** | ❌ Data is per browser/device |
| **Multi-user** | ❌ All users share one data store per device |
| **Backup** | Manual export via JSON/CSV button |
| **Offline** | ✅ Always |
| **Verdict** | Good for single-user personal use on one device. |

---

### 2B. Node.js + SQLite on NAS ✅ (Current Plan)
A small Express API running in Docker on your Synology. SQLite file lives on the NAS.

| | |
|---|---|
| **Setup** | 2–4 hours |
| **Cross-device** | ✅ Any device, same data |
| **Multi-user** | ✅ Full per-user isolation |
| **Backup** | Synology's built-in backup covers the DB file |
| **Offline** | Partial — app shell works, data syncs when connected |
| **Configurability** | ✅ Per-user settings, custom exercises, module toggles |
| **Verdict** | Right choice for family/friends sharing. See `NAS-BACKEND.md`. |

---

### 2C. Supabase (Managed Backend)
Hosted Postgres + auth + real-time subscriptions. Minimal backend code.

| | |
|---|---|
| **Cost** | Free tier (500MB DB, 50k MAU); $25/mo pro |
| **Setup** | 4–6 hours (replace API calls, set up RLS policies) |
| **Cross-device** | ✅ |
| **Multi-user** | ✅ Row-level security built in |
| **Data location** | ⚠️ Supabase's servers (not your NAS) |
| **Offline** | Partial |
| **Real-time** | ✅ Live updates across devices |
| **Verdict** | Great if you don't want to manage infrastructure. Data leaves your house. |

---

### 2D. Offline-First with Background Sync
App uses LocalStorage as a write-ahead cache and syncs to the NAS backend when online.

| | |
|---|---|
| **Offline** | ✅ Fully functional offline |
| **Complexity** | High — requires conflict resolution logic |
| **Best for** | Users with spotty connectivity |
| **Verdict** | Future enhancement once backend is stable. Not needed for Phase 1. |

---

## 3. Native App Options

### 3A. PWA (Progressive Web App) — Current Path
The app is already a PWA with Service Worker, manifest, and Add to Home Screen.

| | |
|---|---|
| **Cost** | Free |
| **Distribution** | Share a URL |
| **Updates** | Instant, no review |
| **HealthKit** | ❌ |
| **Widgets** | ❌ |
| **Push notifications** | ⚠️ iOS 16.4+ only |
| **Verdict** | Covers 90% of use cases. Lacks HealthKit and widgets. |

---

### 3B. Capacitor (Recommended Native Path)
Wraps your existing HTML/CSS/JS in a native iOS container. Adds plugins for native APIs.

| | |
|---|---|
| **Cost** | $99/yr Apple Developer account |
| **Code reuse** | ~85% — keep all HTML/CSS/JS, replace LocalStorage with plugin |
| **HealthKit** | ✅ via `@capacitor-community/health-kit` |
| **Widgets** | ✅ via native Swift extension |
| **Push notifications** | ✅ via Capacitor plugin |
| **Distribution** | App Store or TestFlight |
| **Build tool** | Xcode required on Mac |
| **Verdict** | Best path to native if HealthKit auto-sync is a priority. |

**Key HealthKit wins:**
- Steps pulled automatically from iPhone/Watch — no manual entry
- Weight synced from smart scales (Withings, etc.)
- Body fat % read from connected devices
- Workouts written back to Apple Health

---

### 3C. SwiftUI (Full Native Rewrite)
Write the entire app from scratch in Swift/SwiftUI.

| | |
|---|---|
| **Cost** | $99/yr Apple Developer account + dev time |
| **Code reuse** | ❌ Complete rewrite |
| **Quality** | Highest possible iOS-native experience |
| **HealthKit** | ✅ First-class |
| **Widgets** | ✅ First-class |
| **Effort** | Months |
| **Verdict** | Best result, most work. Worth it if iOS development is a goal in itself. |

---

### 3D. React Native
Cross-platform iOS + Android in JavaScript. Logic is portable, UI is rewritten.

| | |
|---|---|
| **Cost** | $99/yr Apple Developer (+ Google Play $25 one-time for Android) |
| **Code reuse** | Business logic only — UI is fully rewritten |
| **Android** | ✅ Bonus |
| **HealthKit** | ✅ via plugin |
| **Effort** | Weeks to months |
| **Verdict** | Choose this if Android support matters now or later. |

---

## 4. Authentication Options

### 4A. No Auth (Single User, LocalStorage)
Current state. No login required.

### 4B. Cloudflare Access (Zero-Code Auth Layer)
Add Google/email login in front of your entire Cloudflare Tunnel URL. No changes to app code.

| | |
|---|---|
| **Cost** | Free (up to 50 users on Zero Trust free plan) |
| **Setup** | 15 minutes in Cloudflare dashboard |
| **Method** | Google, GitHub, email OTP |
| **Granularity** | Whole domain only — not per-user data isolation |
| **Verdict** | Great for "lock the door" protection. Not a substitute for user accounts. |

### 4C. JWT in App Backend ✅ (Current Plan)
Users register/login via the Node.js API. Passwords hashed with bcrypt. JWT tokens for sessions.

### 4D. Passkey / Face ID
Future option. Replaces passwords with biometric auth tied to device.

---

## 5. Decision Summary

| Phase | Decision | Rationale |
|---|---|---|
| Now | NAS backend + Cloudflare Tunnel | Self-hosted, private, multi-user, extensible |
| Now | GitHub Pages as fallback/staging | Free, instant deploy for sharing a demo |
| Later | Capacitor native app | When HealthKit auto-sync becomes a priority |
| Later | Offline-first sync | When users report connectivity issues |
| Future | SwiftUI rewrite | If full native quality becomes the goal |
