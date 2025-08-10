const router = require('express').Router();
const { jsonOk } = require('../utils/response');

// 获取前端配置
router.get('/frontend', (req, res) => {
  const config = {
    // Pi 相关配置
    piSandbox: process.env.PI_SANDBOX === 'true',
    mockPay: process.env.MOCK_PAY === 'true',
    
    // 业务配置
    pointsPerPi: Number(process.env.POINTS_PER_PI) || 1,
    feePercent: Number(process.env.FEE_PERCENT) || 10,
    
    // 环境信息
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production'
  };
  
  res.json(jsonOk({ config }));
});

module.exports = router;
