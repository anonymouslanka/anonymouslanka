# DetectiveLanka

An installable, account-free **case-file app** for reporting crime in Sri Lanka. People *open a case* anonymously; it waits in **review** until a moderator clears it, and only cleared (**Open**) cases are public. Anyone can add **statements** (comments) - with optional photo **exhibits** - which are moderated the same way.

```
/public   React + TS + Vite + Tailwind   → Vercel   (the DetectiveLanka app / PWA)
/admin    React + TS + Vite + Tailwind   → Vercel   (private moderation desk, also installable)
/backend  NestJS + Prisma + PostgreSQL   → Render   (single API used by both)
              ├── Supabase PostgreSQL  (source of truth, backend-only)
              ├── Redis Cloud          (read cache only, optional)
              └── Cloudinary           (images, uploaded through the backend)
```

Neither frontend ever talks to PostgreSQL, Redis or Cloudinary. They only call `https://<api>/api/v1/...`.

---

## The app (PWA)

* **Installable everywhere:** iPhone/iPad (Safari → Share → Add to Home Screen), Android (Chrome → Install app), Windows/macOS (Chrome or Edge → install icon). Full-screen standalone window, safe-area aware, bottom tab bar on phones, left rail on desktop, pull-to-refresh, haptics where supported.
* **Offline:** a build-time service worker (`/sw.js`, versioned per build) precaches the app shell and static files; navigation falls back to the cached shell, then `/offline.html`. Recently viewed **public** case data is mirrored in localStorage by the app (`lib/api.ts`) so it can be read offline. API and image requests are never intercepted by the worker. Edit-key (owner) endpoints and admin data are never cached.
* **Updates:** when a new build is deployed the app offers an "Update" prompt.
* **Brand assets:** manifest + icons (any/maskable), Apple touch icon and iOS splash screens live in `public/public` (source: `icons/source.svg`). Re-generate with a small sharp script if the logo changes.
* **Vocabulary:** post → **case**, comment → **statement**, image → **exhibit**, edit key → **case key**, approved → **Open**, pending → **Under review**, rejected → **Dismissed**. Case numbers (`DL-XXXX-XXXX`) are derived from the public id.

## How anonymity works

| Topic | Design |
|---|---|
| Accounts | None. No email, phone, username, social login. |
| Edit keys | Each **post** and each **comment** gets its own 256-bit random key (`crypto.randomBytes`). Shown **once**. The server stores only `HMAC-SHA256(key, SESSION_SECRET)`. No recovery. |
| Where the key lives | The user's own browser `localStorage` (`app:post-edit:<postId>`, `app:comment-edit:<commentId>`). Sent only in the `X-Edit-Key` **header** - never URLs, query strings, route params, titles, logs, Redis or Cloudinary. |
| Isolation | A post key never works on a comment (or another post) and vice-versa. |
| Edits | Editing a post/comment sends it back to `PENDING` (re-moderated). Edit window: `EDIT_WINDOW_DAYS` (default 180) → then `EDIT_KEY_EXPIRED`. |
| Images (cases and statements) | Decoded & validated server-side (magic bytes, not MIME), dimension/pixel limits, auto-oriented, **re-encoded to WebP (drops EXIF/GPS/XMP)**, uploaded under a random public id (original filename never used). |
| Data collected | No IPs, user agents or fingerprints are stored or logged. Request logs contain only `METHOD /path STATUS ms` (no query strings, headers or bodies). No analytics/ads/trackers; system font stack (no Google Fonts requests). |
| Honest limits | Hosting/CDN/ISP/Supabase/Redis/Cloudinary keep their own infrastructure logs. This app cannot make a user invisible to them. The in-app Privacy page says so and recommends Tor for high-risk users. |

## Admin authentication

* `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (bcrypt) come from **backend env only**. Nothing is hard-coded; the admin SPA never sees a password hash.
* `POST /api/v1/admin/auth/login` → signed JWT (`HS256`, `jti`) with a matching **server-side session row**. Logout revokes it; every request re-checks the session. Lifetime `ADMIN_SESSION_HOURS` (default 8).
* The token is sent as `Authorization: Bearer` and kept in `sessionStorage` (cleared when the tab closes). No cookies ⇒ no CSRF surface; CORS is an explicit allowlist.
* Login is limited to 5 attempts / 15 min / IP and costs the same time for unknown users and wrong passwords.
* Admins can **not** see edit keys or hashes (never selected by admin queries).

## Local development

Requirements: Node ≥ 20, a PostgreSQL database (Supabase or local), optional Redis, Cloudinary account.

```bash
# 1. Backend
cd backend
cp .env.example .env            # fill in values (see tables below)
npm install
npm run hash-password -- "a-long-admin-password"   # paste output into ADMIN_PASSWORD_HASH (keep the single quotes)
npx prisma migrate deploy       # apply migrations
npm run prisma:seed             # seed categories
npm run start:dev               # http://localhost:4000/api/v1/health

# 2. Public site
cd public && cp .env.example .env && npm install && npm run dev      # http://localhost:5173

# 3. Admin
cd admin && cp .env.example .env && npm install && npm run dev       # http://localhost:5174
```

Production builds: `npm run build` in each folder (backend also runs `prisma generate`). Typecheck only: `npm run typecheck`.

### Smoke test (62 end-to-end assertions)

Run against a **disposable** database with the API running:

```bash
cd backend
API_URL=http://localhost:4000/api/v1 ADMIN_USERNAME=... ADMIN_PASSWORD=... node scripts/smoke-test.mjs
```

It exercises: pending-invisible/approved-visible, edit-key auth (header only, query ignored), post/comment key isolation, re-moderation on edit, rejection, deletion + Cloudinary cleanup, EXIF stripping, fake/SVG/oversize upload rejection, admin auth, logout revocation, login rate limit. It also passes with Redis unreachable (API reports `degraded`).

## Environment variables

### `/backend/.env` (never commit; see `.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **pooled** connection (transaction pooler, port 6543, `?pgbouncer=true`) used at runtime |
| `DIRECT_URL` | Supabase direct/session connection (port 5432) used by `prisma migrate` |
| `REDIS_HOST` `REDIS_PORT` `REDIS_USERNAME` `REDIS_PASSWORD` `REDIS_TLS` | Redis Cloud (optional; omit host to disable caching) |
| `CLOUDINARY_CLOUD_NAME` `CLOUDINARY_API_KEY` `CLOUDINARY_API_SECRET` | Image storage (backend only) |
| `ADMIN_USERNAME` `ADMIN_PASSWORD_HASH` `ADMIN_SESSION_HOURS` | Admin login (bcrypt hash via `npm run hash-password`) |
| `CORS_ORIGINS` | Comma-separated allowed origins, e.g. `https://anonymouslanka.vercel.app,https://admin-anonymouslanka.vercel.app` |
| `PUBLIC_APP_URL` `ADMIN_APP_URL` | Frontend URLs |
| `JWT_SECRET` | ≥ 32 chars. Signs admin tokens |
| `SESSION_SECRET` | ≥ 32 chars. HMAC pepper for edit-key verifiers. **Rotating it invalidates every existing edit key.** |
| `MAX_IMAGES_PER_POST` `MAX_COMMENT_IMAGES` `MAX_IMAGE_MB` `EDIT_WINDOW_DAYS` | Limits (defaults 4 / 2 / 5 / 180) |

Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### `/public/.env` and `/admin/.env`

Only `VITE_API_URL` (e.g. `https://anonymous-lanka-api.onrender.com/api/v1`). It is public by nature - **never** put secrets in `VITE_*` variables.

## Database (Supabase + Prisma)

Models: `Post`, `PostImage`, `Comment`, `CommentImage`, `Category`, `AdminUser`, `AdminSession`, `ModerationLog` (+ `ModerationStatus`: PENDING/APPROVED/REJECTED). Indexed for the feed (`status, publishedAt desc, publicId desc`), category/tag filters (GIN on `tags`), comments per post, and moderation queues. Foreign keys cascade (post → images/comments).

1. Create a Supabase project. *Project Settings → Database → Connection string*: copy the **Transaction pooler** (→ `DATABASE_URL`, add `?pgbouncer=true&connection_limit=5`) and the **Session/Direct** string (→ `DIRECT_URL`).
2. `cd backend && npx prisma migrate deploy && npm run prisma:seed`
3. After editing `prisma/schema.prisma`: `npx prisma migrate dev --name <change>` (dev DB), commit the new folder in `prisma/migrations`, then `migrate deploy` in production.

Useful: `npx prisma studio`, `npx prisma validate`, `npx prisma generate`.

> Supabase RLS: the app connects as the `postgres` role through Prisma, so RLS is bypassed by design (only the backend can reach the DB). In Supabase, you may additionally enable RLS on all tables with no policies so the public PostgREST API exposes nothing.

## Redis Cloud

Redis is a **read-through cache only**. PostgreSQL is always the source of truth.

* Cached: public feed/search pages (120 s / 45 s), post details (300 s), comments pages (120 s), categories (600 s).
* Invalidation: approve / reject / edit / delete of posts and comments bump a per-namespace version counter (`INCR`), so all affected entries become unreachable immediately.
* Fail-open: commands time out fast, offline queue disabled, errors logged at most once a minute. If Redis is down the API reads from PostgreSQL and `/health` reports `degraded`.
* Never stored in Redis: secrets, edit keys, hashes, tokens.

Create a Redis Cloud database, copy host/port/password into the backend env. Use `REDIS_TLS=true` if your database has TLS enabled.

## Cloudinary

Create/choose a cloud, copy cloud name, API key and secret into the **backend** env only. Images are uploaded by the backend into `anonymouslanka/posts/<random>`; delivery URLs use `c_limit,w_…,f_auto,q_auto` transformations. Assets are deleted when a post/image is deleted or when a post insert fails (no orphans).

## API overview (`/api/v1`)

Public: `GET /categories` · `GET /posts?cursor&limit&q&category&tag&sort=newest|oldest&exhibits=true` · `GET /posts/:id` · `POST /posts` (multipart) · `GET|PATCH|DELETE` via `X-Edit-Key` (`/posts/:id/owner`, `/posts/:id`) · `GET /posts/:id/comments` · `POST /posts/:id/comments` (multipart: `content`, `images[]` ≤ 2) · `GET /comments/:id/owner` · `PATCH|DELETE /comments/:id` (multipart edits) · `GET /health`

Admin (Bearer): `POST /admin/auth/login|logout` · `GET /admin/auth/me` · `GET /admin/stats` · `GET|PATCH|DELETE /admin/posts[/:id]` · `POST /admin/posts/:id/approve|reject` · `GET /admin/comments` · `POST /admin/comments/:id/approve|reject` · `DELETE /admin/comments/:id` · `POST|DELETE /admin/categories`

All responses are `{ data, meta? }` or `{ error: { statusCode, code, message, details? } }`.

## Deployment

### 1. Supabase
Create project → note pooled + direct connection strings (see above). Run migrations from your machine (or in the Render build command, below).

### 2. Render (backend)
Option A - Blueprint: *New → Blueprint* → select the repo (uses [`render.yaml`](render.yaml)).
Option B - manual *Web Service*: Root Directory `backend`, Build `npm ci --include=dev && npm run build && npx prisma migrate deploy`, Start `node dist/main.js`, Health Check Path `/api/v1/health`, env `NODE_VERSION=22`, `NODE_ENV=production`.
Set every variable from the backend table in the Render dashboard (`sync: false` in the blueprint means you enter them manually). Set `CORS_ORIGINS` to the two Vercel URLs. First deploy, then run `npx prisma db seed` (Render shell) or `npm run prisma:seed` once from your machine against the production `DIRECT_URL`.

### 3. Vercel (public app)
*Add New Project* → import repo → **Root Directory `public`** → Framework: Vite. Env: `VITE_API_URL=https://<render-service>.onrender.com/api/v1`. `public/vercel.json` adds the SPA fallback, security headers, `no-cache` for `/sw.js` and the right content type for the manifest. **Vercel Hobby only builds commits whose author is the account owner** - commit with the owner's GitHub no-reply identity.

### 4. Vercel (admin)
Same, **Root Directory `admin`**, same `VITE_API_URL`. `admin/vercel.json` adds `X-Robots-Tag: noindex` and `no-store`. Consider adding Vercel *Deployment Protection* or an IP allowlist on top.

### 5. Go-live checklist
- [ ] `CORS_ORIGINS` contains both exact Vercel/custom origins (no trailing slash)
- [ ] `JWT_SECRET`, `SESSION_SECRET` are fresh random values (not reused from any other environment)
- [ ] `ADMIN_PASSWORD_HASH` generated from a strong unique password
- [ ] `GET https://<api>/api/v1/health` → `status: ok`, `database: up`
- [ ] Submit a test post → appears only after approval in the admin panel
- [ ] Rotate any credential that was ever pasted into chat/tickets/screenshots (Supabase DB password, Redis password, Cloudinary API secret)

## Security decisions & known limits

* Validation: global `ValidationPipe` (whitelist + forbid unknown), length limits, control/bidi-character stripping; content stored as **plain text** and rendered as text (no `dangerouslySetInnerHTML` anywhere).
* Headers: Helmet (HSTS, nosniff, no-referrer…), CSP-free JSON API, `x-powered-by` removed, gzip, 100 kB JSON body limit, strict multipart limits (count/size/fields), memory storage (nothing on disk).
* Rate limits (per IP, in process memory, never logged/persisted): global 120/min, create post 5/h, comment 10/h, edit-key lookups 30/min, edits 10/h, admin login 5/15 min. With >1 backend instance, move the throttler store to Redis.
* SEO: titles/OG/Twitter tags are set client-side (SPA). Link-preview bots that don't run JS will see the default site tags. For rich per-post previews add a prerender/edge function.
* Moderation is the defence against defamation/doxxing - nothing is public without review; admins can redact text before approving.
* `npm audit` reports a high advisory in `deepmerge-ts` inside the Prisma **CLI** (build tool); it only processes our own schema and does not run in production request paths.
* Image content (faces, signs, uniforms) can still identify people; moderators should review images.
