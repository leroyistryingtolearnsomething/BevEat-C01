# KiddyEats (BevEat-C01)

Parents set daily food money, block unhealthy food and allergens, and top up their kid's wallet with NETS QR. Kids order hawker food within those rules.

| Folder | What | Run |
|---|---|---|
| [`frontend/`](frontend) | React + Vite web app (parents and kids) | `cd frontend && npm run dev` → http://localhost:5173 |
| [`backend/`](backend) | Express API in MVC folders, Supabase Postgres | `cd backend && npm run dev` → http://localhost:4000/api/health |

## Run everything from this folder

```bash
npm install     # first time only: installs backend and frontend packages
npm run dev     # starts both; open http://localhost:5173 (npm start does the same)
```

Ctrl+C stops both. The front end sends every `/api` call to the backend on port 4000.
You need `backend/.env` first (copy `backend/.env.example` and fill in `DATABASE_URL`).
