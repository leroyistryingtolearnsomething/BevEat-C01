// Parent tops up a kid's wallet with NETS QR
// 1. POST makes the QR code  2. the app calls GET every few seconds until status is success or failed
const TopUp = require("../models/topUpModel");
const Nets = require("../services/netsQrService");
const ChildProfile = require("../../xinsheng/models/childProfileModel");

const AMOUNT_RE = /^\d{1,3}(\.\d{1,2})?$/; // dollars, at most 2 decimal places
const MIN_DOLLARS = 1;
const MAX_DOLLARS = 200;
const QR_SECONDS = 300; // a NETS QR code is valid for 5 minutes

// GET /api/children  the parent's kids and their wallets, to pick who to top up
async function listWallets(req, res, next) {
  try {
    const rows = await ChildProfile.listForParent(req.user.id);
    res.json({
      children: rows.map((c) => ({
        id: c.child_id,
        name: c.display_name,
        avatarEmoji: c.avatar_emoji,
        walletBalance: Number(c.wallet_balance),
        dailyLimit: Number(c.daily_limit),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/children/:childId/top-ups  body { amount }  (req.childId comes from requireOwnChild)
async function createTopUp(req, res, next) {
  const amount = String((req.body || {}).amount ?? "");
  if (!AMOUNT_RE.test(amount) || Number(amount) < MIN_DOLLARS || Number(amount) > MAX_DOLLARS)
    return res.status(400).json({ error: `Amount must be $${MIN_DOLLARS} to $${MAX_DOLLARS}` });

  try {
    const nets = await Nets.requestQr(Number(amount));
    if (!Nets.isOk(nets) || !nets.qr_code)
      return res.status(502).json({ error: nets.instruction || "NETS couldn't make a QR code. Try again." });

    const topUp = await TopUp.createPending(req.user.id, req.childId, amount, nets.txn_retrieval_ref);
    res.status(201).json({
      topUpId: topUp.top_up_id,
      amount: Number(topUp.amount),
      status: topUp.status,
      qrCode: "data:image/png;base64," + nets.qr_code,
      expiresInSeconds: QR_SECONDS,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/top-ups/:topUpId
async function getTopUp(req, res, next) {
  const topUpId = Number(req.params.topUpId);
  if (!Number.isInteger(topUpId) || topUpId <= 0)
    return res.status(400).json({ error: "Invalid top-up id" });

  try {
    const topUp = await TopUp.findForParent(topUpId, req.user.id);
    if (!topUp) return res.status(404).json({ error: "Top-up not found" });

    const status = topUp.status === "pending" ? await checkWithNets(topUp) : topUp.status;
    res.json({ topUpId, amount: Number(topUp.amount), status });
  } catch (err) {
    next(err);
  }
}

// asks NETS if the parent has paid; the wallet is only ever credited here, never from the browser
async function checkWithNets(topUp) {
  const timedOut = Date.now() - new Date(topUp.created_at).getTime() >= QR_SECONDS * 1000;
  const nets = await Nets.queryQr(topUp.nets_txn_ref, timedOut);
  if (Nets.isOk(nets)) {
    await TopUp.markSuccess(topUp.top_up_id);
    return "success";
  }
  if (timedOut) {
    await TopUp.markFailed(topUp.top_up_id);
    return "failed";
  }
  return "pending";
}

module.exports = { listWallets, createTopUp, getTopUp };
