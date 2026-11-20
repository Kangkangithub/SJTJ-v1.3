const express = require("express");
const router = express.Router();
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const analytics = require("../services/trafficAnalytics");

// 统计接口仅管理员可访问
router.use(authenticateToken, requireAdmin);

router.get("/overview", async (req, res) => {
  try {
    const data = await analytics.getOverview(req.query.range, { fresh: req.query.fresh === "1" });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
