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
| `/parent/login`, `/parent/signup` | Parent log in and sign up | logged out |
| `/kid/login` | Kid log in (nickname + code keypad) | logged out |
| `/parent/home` | Home: food money left, wallet, alerts, Ask Mum requests | parent |
| `/parent/add-child` | Add a child (name, login name, 4-digit code, daily limit, allergies) | parent |
| `/parent/allergies` | Allergies, custom allergies and Mum's rules | parent |
| `/parent/limit` | Daily spending limit and different limits on some days | parent |
| `/parent/menu` | What the child sees, with Lock buttons on dishes | parent |
| `/parent/top-up` | NETS QR top-up with a 5 minute countdown | parent |
| `/parent/spending`, `/parent/orders`, `/parent/macros` | Spending, order history and nutrition | parent |
| `/parent/ask-mum/:requestId`, `/parent/pin` | Answer an Ask Mum request, reset a kid's code | parent |
| `/kid/home`, `/kid/stalls/:stallId` | Home and stall menu (only safe dishes) | kid |
| `/kid/dishes/:itemId`, `/kid/dishes/:itemId/pics` | Dish page and its photos | kid |
| `/kid/tray`, `/kid/order-done`, `/kid/pickup/:orderId` | Tray, slide to pay, order sent, pickup code | kid |
| `/kid/wallet`, `/kid/pics`, `/kid/snap` | Wallet, photo feed, take a dish photo | kid |

The page guards only hide pages; the API checks the role on every request. The token is kept in `localStorage` under `kiddyeats.session`.

## API

Every call the pages make is listed in [../backend/README.md](../backend/README.md).
