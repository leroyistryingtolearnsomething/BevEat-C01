# KiddyEats

**Safe lunch money for kids, peace of mind for parents.**

KiddyEats helps parents keep their primary-school children safe and healthy when they buy lunch alone at the hawker centre. Parents top up a child's wallet with NETS QR, set a daily spending limit, and block allergens or foods they don't want. Kids order from a menu showing only what's safe for them, and parents can see what was bought with its nutrition.

Team C01, Ngee Ann Polytechnic. Live app: **https://kiddyeats.vercel.app**

## Try it

Open the live app and pick "I'm a parent" or "I'm a kid".

| Who | Log in with |
|---|---|
| Kid | nickname `ethan`, or `ethan_eats`, code `1234` |
| Parent | `l3r0y8@gmail.com` / `testing123`  |

You can also sign up as a new parent and add your own child.

## What it does

**Parents**
- Sign up, log in and add children, each with their own wallet, nickname and 4-digit code.
- Top up a child's wallet with a NETS QR code. The wallet is credited only after NETS confirms the payment.
- Set a daily spending limit ($2 to $20), with a different limit on some days of the week.
- Block allergens (including custom ones) and foods with Mum's rules, such as no fried food or no sugary drinks, and lock single dishes from the Menu tab.
- Approve or decline Ask Mum requests when a kid asks for a locked dish.
- See spending, orders and the macros (protein, carbs, fats, fibre, sodium) of what the child ate, plus alerts for low wallet balance.

**Kids**
- Browse stalls and a menu that hides everything unsafe for them, with community-voted dish photos.
- Build a tray, see how much food money is left today, and slide to pay.
- Follow the order in the live queue and collect it with a pickup code.
- Take and upload a photo of a dish, checked by AI before it is shared.

The rules (limit, allergies, locked foods) are enforced by the server before any payment goes through.

## Tech

React 18 and Vite (front end), Node.js and Express in MVC folders (back end), Supabase Postgres and Storage, NETS QR Web for payments, Gemini for the photo check, hosted on Vercel.

## Run it locally

You need Node.js 18 or newer and a Supabase Postgres database.

```bash
npm install                      # installs the root, backend and frontend packages
cp backend/.env.example backend/.env
npm run dev                      # API on :4000 and site on :5173 together
```

Open http://localhost:5173. Ctrl+C stops both. The front end sends every `/api` call to the back end on port 4000.

Fill in `backend/.env`:

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | **Required.** Postgres connection string for the Supabase database |
| `JWT_SECRET` | **Required.** Any long random string, used to sign logins |
| `NETS_API_KEY`, `NETS_PROJECT_ID`, `NETS_TXN_ID` | NETS QR top-ups (NETS sandbox keys) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Dish photo upload. Without them photo upload is off |
| `GEMINI_API_KEY` | The AI photo check. Without it the check runs in demo mode and always passes |

`.env` is ignored by git. Never commit it.

The database tables are described in [docs/schema-requests.md](docs/schema-requests.md). The demo kids above come from the seed data in that database.

## Tests

```bash
cd backend && npm test      # API checks against a fake database, no Supabase needed
cd frontend && npm test     # form checks
```

## More detail

| Folder | What |
|---|---|
| [`frontend/`](frontend) | The React app and its pages ([frontend/README.md](frontend/README.md)) |
| [`backend/`](backend) | The Express API and its routes ([backend/README.md](backend/README.md)) |
| [`docs/`](docs) | API contracts, schema notes and the dish photo flow |
