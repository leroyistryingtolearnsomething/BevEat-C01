// Routes: live queue + wait time, order ready ping
const express = require("express");
const c = require("../controllers/orderQueueController");
const { requireAuth, requireRole } = require("../../middleware/auth");

const router = express.Router();
const owner = [requireAuth, requireRole("stall_owner")];

router.get("/orders/:orderId/queue", requireAuth, c.getOrderQueue);
router.get("/stalls/:stallId/wait", requireAuth, c.getStallWait);
router.get("/me/ready-orders", requireAuth, requireRole("child"), c.getMyReadyOrders);
router.get("/me/orders", requireAuth, requireRole("child"), c.getMyOrders);
router.get("/children/live-orders", requireAuth, requireRole("parent"), c.getKidsOrders);
router.get("/stall/orders", ...owner, c.getStallOrders);
router.put("/orders/:orderId/ready", ...owner, c.markReady);
router.put("/orders/:orderId/collected", ...owner, c.markCollected);
router.put("/orders/:orderId/received", requireAuth, requireRole("child"), c.markReceived);

module.exports = router;
