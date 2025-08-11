const router = require('express').Router();
const { jsonOk } = require('../utils/response');

// 获取前端配置（简化版）
router.get('/frontend', (req, res) => {
  const config = {
    // 简化配置，前端现在使用固定配置
    piSandbox: false,
    mockPay: false,
    
    // 业务配置
    pointsPerPi: Number(process.env.POINTS_PER_PI) || 1,
    feePercent: Number(process.env.FEE_PERCENT) || 10
  };
  
  res.json(jsonOk({ config }));
});

module.exports = router;
