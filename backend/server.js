// Express server
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// child login (PB02)
app.use("/api", require("./xinsheng/routes/childAuthRoutes"));

// parent log in
app.use("/api", require("./leroy/routes/parentAuthRoutes"));

// parent adds a kid
app.use("/api", require("./leroy/routes/childRoutes"));

// NETS QR wallet top-ups
app.use("/api", require("./leroy/routes/topUpRoutes"));

// kid Home page
app.use("/api", require("./gabriel/routes/homeRoutes"));

// photo upload page
app.use("/api", require("./gabriel/routes/photoRoutes"));

// stall discovery (Raghav)
app.use("/api", require("./raghav/routes/stallRoutes"));

// stall menu, food detail and Ask Mum (Raghav)
app.use("/api", require("./raghav/routes/menuRoutes"));

// tray quote (Raghav)
app.use("/api", require("./raghav/routes/trayRoutes"));

// live queue + order ready ping
app.use("/api", require("./xinsheng/routes/orderQueueRoutes"));

// weekday limits, spending report, low money alerts
app.use("/api", require("./xinsheng/routes/parentMoneyRoutes"));

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}
module.exports = app;
