# BevEat backend (Express + Supabase Postgres)

## Run it

```bash
cd backend
npm install
cp .env.example .env     # then paste the real DATABASE_URL from Leslie, and set JWT_SECRET
npm run dev              # http://localhost:4000/api/health
npm test                 # runs the child login checks against a fake DB (no Supabase needed)
```

`.env` is ignored by git (see the root `.gitignore`). Never commit it.

## Routes so far

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/api/health` | anyone | | `{ ok: true }` |
| POST | `/api/auth/child-login` | anyone | `{ username, pin }` | `{ token, child: { id, username, displayName, avatarEmoji } }` |
| POST | `/api/auth/parent-signup` | anyone | `{ name, mobile: "+6581234567", email, password }` (8+ chars with a number) | `201 { token, parent: { id, name, email } }`, `409` if the email is taken |
| POST | `/api/auth/parent-login` | anyone | `{ email, password }` | `{ token, parent: { id, name, email } }` |
| PUT | `/api/children/:childId/pin` | parent of that child | `{ pin }` (4 to 6 digits) | `{ message }` |
| POST | `/api/children` | parent | `{ displayName, username, pin (4 digits), dailyLimitCents (100 to 5000), allergens: ["peanut", "tree nuts", "milk", "egg", "shellfish", "fish", "soy", "wheat", "sesame"] }` | `201 { child: { id, name, username } }`, `409` if the login name is taken |
| GET | `/api/children` | parent | | `{ children: [{ id, name, avatarEmoji, walletBalance, dailyLimit, spentToday, allergens: ["peanut", ...] }] }` (spent today = Singapore day, not cancelled orders) |
| PUT | `/api/children/:childId/allergies` | parent of that child | `{ allergens: ["peanut", ...] }` (same keys as above, `[]` for none) | `{ allergens }` |
| PUT | `/api/children/:childId/daily-limit` | parent of that child | `{ dailyLimitCents }` (100 to 5000) | `{ dailyLimit }` |
| POST | `/api/children/:childId/top-ups` | parent of that child | `{ amount }` ($1 to $200, max 2 decimals) | `{ topUpId, amount, status: "pending", qrCode, expiresInSeconds: 300 }` |
| GET | `/api/top-ups/:topUpId` | parent who made it | | `{ topUpId, amount, status }`, status is `pending`, `success` or `failed` |
| GET | `/api/orders/:orderId/queue` | kid who ordered, their parent, or the stall owner | | `{ orderId, queueNumber, stallName, status, ready, ahead, waitMinutes, readyAt }` (wait = (ahead + 1) x stall `avg_prep_minutes`, 5 if not set) |
| GET | `/api/stalls/:stallId/wait` | logged in | | `{ stallId, inQueue, waitMinutes }` |
| GET | `/api/me/ready-orders` | kid | | `{ orders: [{ orderId, queueNumber, stallName, readyAt }] }` ready but not collected, the app checks this every 10s for the ping |
| GET | `/api/stall/orders` | stall owner | | `{ orders: [{ orderId, queueNumber, stallId, stallName, status, placedAt, ready }] }` waiting first |
| PUT | `/api/orders/:orderId/ready` | owner of that stall | | `{ orderId, readyAt }`, `409` if already ready or cancelled |
| PUT | `/api/orders/:orderId/collected` | owner of that stall | | `{ orderId, collectedAt }`, `409` if not ready yet |
| GET | `/api/stalls?cuisine=Malay&halal=true` | any logged-in user | (both filters optional; cuisine is `Chinese`, `Malay`, `Indian`, `Western` or `Drinks`, any case; halal only accepts `true`) | `{ stalls: [{ id, name, unitNo, cuisine, isHalal, description, yearStarted, isOpen, prepMinutes, coverImageUrl }] }` (open first, then A-Z; no match = `[]`), `400` for an unknown cuisine or halal value |
| GET | `/api/stalls/:id` | any logged-in user | | `{ stall: { ...same fields } }`, `400` for a bad id, `404` if not found |

## NETS QR top-up (Leroy)

1. The parent picks an amount and the app calls `POST /api/children/:childId/top-ups`.
   The server asks NETS for a QR code and saves a `pending` row in `top_ups`.
2. Show `qrCode` as an image (`<img src={qrCode}>`) with a 5 minute countdown.
3. Every 3 seconds, call `GET /api/top-ups/:topUpId`. The server asks NETS if it's paid.
   On `success` the kid's `wallet_balance` goes up once. After 5 minutes unpaid it becomes `failed`.

The NETS API key stays in `backend/.env` (`NETS_API_KEY`, `NETS_PROJECT_ID`, `NETS_TXN_ID`, see `.env.example`), never in the front end.

Kid logins from the seed data: `ethan`, `chloe`, `aisyah`, PIN `1234`.

Test parent (made for testing top-ups, user 10): `leroy.test@example.com`, password `kiddyeats-test-6294`.
Its kid is `leroy_kid` (child 11), PIN `1234`, wallet starts at $0.

## Login token

Every login returns a JWT. Send it on later requests as `Authorization: Bearer <token>`.
The payload is `{ id, role }`, where `id` is `users.user_id` and `role` is `parent`, `child` or `stall_owner`.

## Folders (MVC, one folder per person)

```
backend/
  server.js        app setup: middleware, routes, error handler
  config/db.js     Postgres connection (Supabase), shared
  middleware/      auth.js: requireAuth, requireRole, requireOwnChild, shared
  test/            API tests with a fake DB
  xinsheng/        child login, live queue + order ready ping
    models/        SQL only: one file per table, returns plain rows
    controllers/   request logic: check input, call models, send JSON
    routes/        URL -> middleware -> controller, nothing else
  leroy/           NETS QR wallet top-up (models, controllers, routes,
                   services/ = calls to outside APIs like NETS)
  leslie/          same folders inside each person's folder
  raghav/
  gabriel/
```

The "view" is the React app in `../frontend`; the API only sends JSON.

## Adding your feature (in your own folder)

1. **Model** `<you>/models/<table>Model.js`: the SQL, using `require("../../config/db")`.
2. **Controller** `<you>/controllers/<feature>Controller.js`: validate `req.body`, call the model, `res.json(...)`, pass errors to `next(err)`.
3. **Routes** `<you>/routes/<feature>Routes.js`: map each URL to its middleware (`require("../../middleware/auth")`) and controller function.
4. Add one line to `server.js`: `app.use("/api", require("./<you>/routes/<feature>Routes"));`

`xinsheng/` is the example to copy. If you need a table someone already has a model for (like `users`), require their model file instead of writing a second one.
You can delete the `.gitkeep` in your folder once you add a real file; it is only there so git keeps the empty folder.
