# KiddyEats web app (React + Vite)

One web app for parents and kids. Everyone starts on the same Welcome page and picks "I'm a parent" or "I'm a kid".

## Run it

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, /api calls go to the backend on :4000
npm test        # form check tests
```

Start the backend too (`cd backend && npm run dev`), or every log in will say something went wrong.

## Pages

| Path | Page | Who |
|---|---|---|
| `/` | Welcome: "Who's using KiddyEats?" | logged out |
| `/parent/login` | Parent log in | logged out |
| `/parent/signup` | Create parent account | logged out |
| `/parent/add-child` | Add your child (name, login name, 4-number code, colour, daily money, allergies) | parent |
| `/kid/login` | Kid log in (nickname + code keypad) | logged out |
| `/parent/home`, `/kid/home` | Placeholder home pages with Log out | parent / kid |

## API the pages call

| Call | Status |
|---|---|
| `POST /api/auth/child-login` `{ username, pin }` | in the backend |
| `POST /api/auth/parent-login` `{ email, password }` → `{ token, parent: { id, name, email } }` | **to build** (401 for wrong details) |
| `POST /api/auth/parent-signup` `{ name, mobile, email, password }` → `{ token, parent }` | **to build** (409 if the email is taken; `mobile` is sent as `+6581234567`) |
| `POST /api/children` (parent token) `{ displayName, username, pin, colour, dailyLimitCents, allergens }` → `{ child }` | **to build** (409 if the login name is taken; allergens are lowercase, e.g. `"peanut"`) |

The token is kept in `localStorage` under `kiddyeats.session`. The page guards only hide pages; the API must still check the role on every request.
