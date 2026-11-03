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
| PUT | `/api/children/:childId/pin` | parent of that child | `{ pin }` (4 to 6 digits) | `{ message }` |

Kid logins from the seed data: `ethan`, `chloe`, `aisyah`, PIN `1234`.

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
  xinsheng/        child login (done)
    models/        SQL only: one file per table, returns plain rows
    controllers/   request logic: check input, call models, send JSON
    routes/        URL -> middleware -> controller, nothing else
  leroy/           same three folders inside each person's folder
  leslie/
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
