# BevEat backend (Express + Supabase Postgres)

## Run it

```bash
cd backend
npm install
cp .env.example .env     # then paste the real DATABASE_URL from Leslie, and set JWT_SECRET
npm run dev              # http://localhost:3000/api/health
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

## Adding your feature

1. Put your router in `routes/<feature>.js`.
2. Use `require("../db")` for the database and `middleware/auth.js` for `requireAuth`, `requireRole("parent")` and `requireOwnChild`.
3. Add one line to `server.js`: `app.use("/api", require("./routes/<feature>"));`
