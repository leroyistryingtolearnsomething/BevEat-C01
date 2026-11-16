// My tray (Kids Figma 06): POST /api/tray/quote prices the kid's tray on the server.
// The app calls it every time the tray changes, and only ever shows the numbers it gets back.
const Teammates = require("../services/teammates");
const { priceTray, TrayError } = require("../services/trayPricing");
const { parseTrayItems } = require("./validation");

const STATUS_FOR_KIND = { invalid: 400, locked: 409, no_child: 404 };

// One priced line -> what the tray row shows (no macros or internal cents)
function toLineJson(line, photo) {
  return {
    lineIndex: line.lineIndex,
    itemId: line.itemId,
    name: line.name,
    // same picture as the menu card: top community photo, then the dish's default image
    imageUrl: (photo && photo.imageUrl) || line.defaultImageUrl,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    addOns: line.addOns,
    lineTotal: line.lineTotal,
    // Mum's Ask Mum changes for this dish (Leslie, CB69-74): tags on the tray, text on the ticket
    mumChanges: line.mumChanges || [],
    ticketNote: line.ticketNote || null,
  };
}

function toQuoteJson(quote, photos) {
  return {
    stalls: quote.stalls.map((s) => ({
      stallId: s.stallId,
      stallName: s.stallName,
      subtotal: s.subtotal,
      lines: s.lines.map((l) => toLineJson(l, photos.get(l.itemId))),
    })),
    total: quote.total,
    money: quote.money,
    canPay: quote.canPay,
  };
}

// POST /api/tray/quote  body { items: [{ itemId, quantity, addOnIds }] }
async function quoteTray(req, res, next) {
  const parsed = parseTrayItems(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const quote = await priceTray(req.user.id, parsed.items);
    const itemIds = [...new Set(quote.lines.map((l) => l.itemId))];
    const photos = await Teammates.getTopPhotos(itemIds, req.user.id);
    res.json(toQuoteJson(quote, photos));
  } catch (err) {
    if (!(err instanceof TrayError)) return next(err); // e.g. allergies can't load -> 500
    const body = { error: err.message };
    if (err.kind === "locked") body.problems = err.problems;
    res.status(STATUS_FOR_KIND[err.kind]).json(body);
  }
}

module.exports = { quoteTray };
