// POST /api/checkout (kids only): pay for the tray from the wallet. Contract: docs/api-contracts.md 2e.
// The client only sends what it wants; every price is worked out again here by Raghav's priceTray,
// the same code that priced the tray quote, so the kid is charged exactly what the tray showed.
const { parseTrayItems } = require("../../raghav/controllers/validation");
const { priceTray, TrayError } = require("../../raghav/services/trayPricing");
const { placeOrders, NotEnoughMoney } = require("../models/checkoutModel");

const STATUS_FOR_KIND = { invalid: 400, locked: 409, no_child: 404 };

async function checkout(req, res, next) {
  const parsed = parseTrayItems(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const tray = await priceTray(req.user.id, parsed.items);
    if (!tray.canPay) return res.status(409).json({ error: "Not enough food money", shortBy: tray.money.shortBy });
    res.status(201).json(await placeOrders(req.user.id, tray));
  } catch (err) {
    if (err instanceof NotEnoughMoney) return res.status(409).json({ error: err.message, shortBy: err.shortBy });
    if (!(err instanceof TrayError)) return next(err); // e.g. allergies can't load -> 500 (fail closed)
    const body = { error: err.message };
    if (err.kind === "locked") body.problems = err.problems;
    res.status(STATUS_FOR_KIND[err.kind]).json(body);
  }
}

module.exports = { checkout };
