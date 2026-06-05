# BodyBoard — NAS Backend Implementation Guide

> **Goal:** A Node.js + SQLite API running in Docker on your Synology NAS.
> Per-user authentication, private data isolation, configurable per-user settings
> (custom exercises, module toggles, personal targets).

---

## Architecture

```
bodyboard/
├── index.html          ← Frontend (served as static file)
├── sw.js
├── manifest.json
└── server/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── package.json
    ├── server.js           ← Express app entry point
    ├── db.js               ← SQLite init + schema
    ├── middleware/
    │   └── auth.js         ← JWT verification middleware
    └── routes/
        ├── auth.js         ← /auth/register, /auth/login
        ├── data.js         ← /api/logs, /api/workouts, /api/checks
        └── profile.js      ← /api/profile (targets, modules, exercises)
```

---

## Prerequisites on Synology

1. **Container Manager** installed (Package Center → Container Manager)
   - On older DSM: install "Docker" package instead
2. **A shared folder** for the project, e.g. `/volume1/docker/bodyboard/`
3. Your domain pointed to Cloudflare (see OPTIONS.md §1D)

---

## Step 1: Create the Server Files

SSH into your NAS or use File Station to create the `server/` folder inside your project.
Then create each file below.

---

### `server/package.json`

```json
{
  "name": "bodyboard-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.2.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

---

### `server/db.js`

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'bodyboard.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');  // better concurrent read performance
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- Per-user profile: targets + which modules are enabled + custom exercises
    CREATE TABLE IF NOT EXISTS user_profiles (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER UNIQUE NOT NULL,
      age              INTEGER,
      height_in        INTEGER,
      protein_target   INTEGER DEFAULT 150,
      calorie_target   INTEGER DEFAULT 1900,
      step_target      INTEGER DEFAULT 8000,
      -- JSON object: { "glp1": true, "trt": false, "supplements": true, "creatine": true }
      modules_json     TEXT DEFAULT '{"glp1":true,"trt":false,"supplements":true,"creatine":true}',
      -- JSON array of custom exercise objects { id, name, tip, day[] }
      exercises_json   TEXT DEFAULT '[]',
      updated_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Daily weight/nutrition log (one row per user per date)
    CREATE TABLE IF NOT EXISTS daily_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      date       TEXT NOT NULL,
      weight     REAL,
      bf         REAL,
      lean       REAL,
      protein    INTEGER,
      calories   INTEGER,
      steps      INTEGER,
      notes      TEXT,
      checks_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Workout session logs
    CREATE TABLE IF NOT EXISTS workout_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      date            TEXT NOT NULL,
      day_label       TEXT,
      exercises_json  TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Flexible key/value settings per user (dose, toggle states, etc.)
    CREATE TABLE IF NOT EXISTS settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, key),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Medication injection log
    CREATE TABLE IF NOT EXISTS injection_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      date       TEXT NOT NULL,
      medication TEXT DEFAULT 'Tirzepatide',
      dose       TEXT,
      unit       TEXT DEFAULT 'mg',
      notes      TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('Database initialized at', DB_PATH);
}

module.exports = { getDB, initDB };
```

---

### `server/middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

module.exports = function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

---

### `server/routes/auth.js`

```javascript
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDB } = require('../db');

const router = express.Router();
const JWT_SECRET   = process.env.JWT_SECRET   || 'change-this-secret-in-production';
const INVITE_CODE  = process.env.INVITE_CODE  || '';   // empty = open registration

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, inviteCode } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required' });

  // Enforce invite code if configured
  if (INVITE_CODE && inviteCode !== INVITE_CODE)
    return res.status(403).json({ error: 'Invalid invite code' });

  const db = getDB();

  try {
    const hash = await bcrypt.hash(password, 12);

    // First user ever becomes admin
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
    const role  = count.c === 0 ? 'admin' : 'user';

    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email.toLowerCase(), hash, role);

    // Create default profile for new user
    db.prepare(
      'INSERT INTO user_profiles (user_id) VALUES (?)'
    ).run(result.lastInsertRowid);

    const token = jwt.sign(
      { id: result.lastInsertRowid, email: email.toLowerCase(), role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: result.lastInsertRowid, name, email, role } });

  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const db   = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)  return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// GET /auth/me  — verify token and return current user
router.get('/me', require('../middleware/auth'), (req, res) => {
  const db   = getDB();
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;
```

---

### `server/routes/profile.js`

Handles per-user configuration: targets, module toggles, custom exercises.

```javascript
const express    = require('express');
const requireAuth = require('../middleware/auth');
const { getDB }  = require('../db');

const router = express.Router();
router.use(requireAuth);

// GET /api/profile
router.get('/', (req, res) => {
  const db = getDB();
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  res.json({
    ...profile,
    modules: JSON.parse(profile.modules_json || '{}'),
    exercises: JSON.parse(profile.exercises_json || '[]'),
  });
});

// PUT /api/profile  — update any profile fields
router.put('/', (req, res) => {
  const db = getDB();
  const { age, height_in, protein_target, calorie_target, step_target, modules, exercises } = req.body;

  const current = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
  if (!current) return res.status(404).json({ error: 'Profile not found' });

  const updated = {
    age:            age            ?? current.age,
    height_in:      height_in      ?? current.height_in,
    protein_target: protein_target ?? current.protein_target,
    calorie_target: calorie_target ?? current.calorie_target,
    step_target:    step_target    ?? current.step_target,
    modules_json:   modules    ? JSON.stringify(modules)    : current.modules_json,
    exercises_json: exercises  ? JSON.stringify(exercises)  : current.exercises_json,
  };

  db.prepare(`
    UPDATE user_profiles SET
      age = ?, height_in = ?, protein_target = ?, calorie_target = ?,
      step_target = ?, modules_json = ?, exercises_json = ?,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    updated.age, updated.height_in, updated.protein_target, updated.calorie_target,
    updated.step_target, updated.modules_json, updated.exercises_json,
    req.user.id
  );

  res.json({ ok: true });
});

module.exports = router;
```

---

### `server/routes/data.js`

All data CRUD routes — every query is scoped to `req.user.id`.

```javascript
const express     = require('express');
const requireAuth = require('../middleware/auth');
const { getDB }   = require('../db');

const router = express.Router();
router.use(requireAuth);

// ── DAILY LOGS ────────────────────────────────────────────────

// GET /api/logs  — full history
router.get('/logs', (req, res) => {
  const db   = getDB();
  const logs = db.prepare(
    'SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 365'
  ).all(req.user.id);
  res.json(logs);
});

// GET /api/logs/:date  — single day
router.get('/logs/:date', (req, res) => {
  const db  = getDB();
  const row = db.prepare(
    'SELECT * FROM daily_logs WHERE user_id = ? AND date = ?'
  ).get(req.user.id, req.params.date);
  res.json(row || {});
});

// POST /api/logs/:date  — upsert a day's log
router.post('/logs/:date', (req, res) => {
  const db = getDB();
  const { weight, bf, protein, calories, steps, notes, checks } = req.body;
  const lean = weight && bf != null ? weight * (1 - bf / 100) : null;

  db.prepare(`
    INSERT INTO daily_logs (user_id, date, weight, bf, lean, protein, calories, steps, notes, checks_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      weight      = COALESCE(excluded.weight,      weight),
      bf          = COALESCE(excluded.bf,          bf),
      lean        = COALESCE(excluded.lean,        lean),
      protein     = COALESCE(excluded.protein,     protein),
      calories    = COALESCE(excluded.calories,    calories),
      steps       = COALESCE(excluded.steps,       steps),
      notes       = COALESCE(excluded.notes,       notes),
      checks_json = COALESCE(excluded.checks_json, checks_json)
  `).run(
    req.user.id, req.params.date,
    weight ?? null, bf ?? null, lean,
    protein ?? null, calories ?? null, steps ?? null,
    notes ?? null,
    checks ? JSON.stringify(checks) : null
  );

  res.json({ ok: true });
});

// ── WORKOUT LOGS ──────────────────────────────────────────────

// GET /api/workouts
router.get('/workouts', (req, res) => {
  const db   = getDB();
  const logs = db.prepare(
    'SELECT * FROM workout_logs WHERE user_id = ? ORDER BY date DESC LIMIT 100'
  ).all(req.user.id);
  res.json(logs.map(w => ({ ...w, exercises: JSON.parse(w.exercises_json || '[]') })));
});

// POST /api/workouts
router.post('/workouts', (req, res) => {
  const db = getDB();
  const { date, day_label, exercises } = req.body;
  if (!date || !exercises) return res.status(400).json({ error: 'date and exercises required' });

  db.prepare(
    'INSERT INTO workout_logs (user_id, date, day_label, exercises_json) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, date, day_label || '', JSON.stringify(exercises));

  res.json({ ok: true });
});

// ── SETTINGS ──────────────────────────────────────────────────

// GET /api/settings  — returns all settings as a flat object
router.get('/settings', (req, res) => {
  const db   = getDB();
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(req.user.id);
  const obj  = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

// POST /api/settings  — upsert any number of key/value pairs
router.post('/settings', (req, res) => {
  const db   = getDB();
  const stmt = db.prepare(`
    INSERT INTO settings (user_id, key, value, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const upsertMany = db.transaction(pairs => pairs.forEach(([k, v]) => stmt.run(req.user.id, k, v)));
  upsertMany(Object.entries(req.body));
  res.json({ ok: true });
});

// ── INJECTION LOGS ────────────────────────────────────────────

// GET /api/injections
router.get('/injections', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    'SELECT * FROM injection_logs WHERE user_id = ? ORDER BY date DESC LIMIT 52'
  ).all(req.user.id));
});

// POST /api/injections
router.post('/injections', (req, res) => {
  const db = getDB();
  const { date, medication, dose, unit, notes } = req.body;
  db.prepare(
    'INSERT INTO injection_logs (user_id, date, medication, dose, unit, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, date, medication || 'Tirzepatide', dose, unit || 'mg', notes || '');
  res.json({ ok: true });
});

// ── ADMIN: user list ──────────────────────────────────────────

// GET /api/admin/users  — admin only
router.get('/admin/users', (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });
  const db = getDB();
  res.json(db.prepare('SELECT id, name, email, role, created_at FROM users').all());
});

module.exports = router;
```

---

### `server/server.js`

```javascript
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// Rate limiting — prevents brute force on login
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/auth', limiter);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// Serve the frontend static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/auth', require('./routes/auth'));
app.use('/api',  require('./routes/data'));
app.use('/api',  require('./routes/profile'));

// Catch-all: serve index.html for any non-API route (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  }
});

initDB();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BodyBoard API running on port ${PORT}`);
  console.log(`Registration: ${process.env.INVITE_CODE ? 'invite code required' : 'open'}`);
});
```

---

## Step 2: Docker Setup

### `server/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app/server

# Copy package files first (better layer caching)
COPY server/package.json ./
RUN npm install --production

# Copy all project files
COPY . /app/

# Create data directory for SQLite
RUN mkdir -p /app/server/data

EXPOSE 3000

CMD ["node", "server.js"]
```

---

### `docker-compose.yml`  ← goes in the project root

```yaml
version: '3.8'

services:
  bodyboard:
    build: .
    container_name: bodyboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Persist the SQLite database outside the container
      - /volume1/docker/bodyboard/data:/app/server/data
    environment:
      - PORT=3000
      - NODE_ENV=production
      # CHANGE THESE before deploying:
      - JWT_SECRET=replace-with-a-long-random-string-64-chars-minimum
      - INVITE_CODE=choose-a-code-to-share-with-family
      # Optional: lock CORS to your domain
      # - ALLOWED_ORIGIN=https://bodyboard.yourdomain.com
```

> **Generate a secure JWT_SECRET:**
> Run this in your terminal: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## Step 3: Deploy to Synology

### Option A: Via SSH (recommended)

```bash
# SSH into your NAS
ssh admin@your-nas-ip

# Create project directory
mkdir -p /volume1/docker/bodyboard

# Copy your files to the NAS (run from your Mac)
scp -r /Users/jolleyutah/Documents/Bodyboard/* admin@your-nas-ip:/volume1/docker/bodyboard/

# Back on the NAS — build and start
cd /volume1/docker/bodyboard
docker-compose up -d --build

# Check it's running
docker logs bodyboard -f
```

### Option B: Via Synology Container Manager UI

1. Open Container Manager → Project → Create
2. Set project path to `/volume1/docker/bodyboard`
3. Paste your `docker-compose.yml` content
4. Click Deploy
5. View logs in the Container Manager UI

---

## Step 4: Cloudflare Tunnel Configuration

In your Cloudflare Zero Trust dashboard:

1. Networks → Tunnels → Your tunnel → Edit
2. Add a **Public Hostname**:
   - Subdomain: `bodyboard`
   - Domain: `yourdomain.com`
   - Service: `http://localhost:3000`
3. Save — your app is now live at `https://bodyboard.yourdomain.com`

**Optional — Add Cloudflare Access (Google login gate):**
1. Access → Applications → Add
2. Application URL: `https://bodyboard.yourdomain.com`
3. Policy: Allow | Email | is | `yourname@gmail.com`
4. Add additional emails for family members
5. This wraps the entire app with Google login before the app even loads

---

## Step 5: API Reference

All `/api/*` routes require: `Authorization: Bearer <token>`

| Method | Route | Body / Params | Description |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password, inviteCode}` | Create account |
| POST | `/auth/login` | `{email, password}` | Login → JWT token |
| GET  | `/auth/me` | — | Current user info |
| GET  | `/api/logs` | — | All weight/nutrition history |
| GET  | `/api/logs/:date` | date = `YYYY-MM-DD` | Single day's log |
| POST | `/api/logs/:date` | `{weight, bf, protein, calories, steps, notes, checks}` | Save day |
| GET  | `/api/workouts` | — | Workout history |
| POST | `/api/workouts` | `{date, day_label, exercises}` | Save workout |
| GET  | `/api/settings` | — | All key/value settings |
| POST | `/api/settings` | `{key: value, ...}` | Upsert settings |
| GET  | `/api/injections` | — | Injection history |
| POST | `/api/injections` | `{date, medication, dose, unit}` | Log injection |
| GET  | `/api/profile` | — | Targets, modules, custom exercises |
| PUT  | `/api/profile` | `{protein_target, modules, exercises, ...}` | Update profile |
| GET  | `/api/admin/users` | — | Admin only: list all users |

---

## Step 6: Test the API

Run these from your Mac to verify everything works before updating the frontend:

```bash
BASE=https://bodyboard.yourdomain.com

# Register first account (becomes admin)
curl -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"you@email.com","password":"yourpassword","inviteCode":"your-invite-code"}'

# Login
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@email.com","password":"yourpassword"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Save a daily log
curl -X POST $BASE/api/logs/$(date +%Y-%m-%d) \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"weight":173,"bf":18.8,"protein":140,"calories":1850,"steps":7200}'

# Read it back
curl $BASE/api/logs/$(date +%Y-%m-%d) \
  -H "Authorization: Bearer $TOKEN"

# Update your profile (turn off GLP-1 module)
curl -X PUT $BASE/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modules":{"glp1":false,"trt":true,"supplements":true,"creatine":true}}'
```

---

## Step 7: Update index.html to Use the API

Once the backend is verified, update `index.html` to replace LocalStorage with API calls.
The pattern for each function is:

```javascript
// OLD (LocalStorage)
function saveLog() {
  const logs = getData('wt_logs') || [];
  logs.unshift(entry);
  setData('wt_logs', logs);
}

// NEW (API)
async function saveLog() {
  const token = localStorage.getItem('auth_token');
  await fetch(`/api/logs/${today()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(entry)
  });
}
```

LocalStorage remains as a local cache for the current session and for offline reads.
The full frontend update is tracked in `PROJECT-PLAN.md`.

---

## Maintenance

**Backup the database:**
Your Synology's built-in Hyper Backup should include `/volume1/docker/bodyboard/data/`.
The SQLite file is `bodyboard.db` — a single file you can copy anywhere.

**Update the app:**
```bash
# On your NAS via SSH
cd /volume1/docker/bodyboard
git pull   # if using git, otherwise scp new files
docker-compose up -d --build
```

**View logs:**
```bash
docker logs bodyboard -f
```

**Access the database directly:**
```bash
docker exec -it bodyboard sh
sqlite3 /app/server/data/bodyboard.db
.tables
SELECT name, email, role, created_at FROM users;
```
