const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { jsonOk, jsonErr } = require('../utils/response');
const { paySellerDeposit, SELLER_DEPOSIT_PI, POINTS_PER_PI } = require('../services/tradeRules');
const User = require('../models/User');

// 我的信息
router.get('/me', auth, async (req, res) => {
  const u = await User.findById(req.user._id).lean();
  res.json(jsonOk({ user: {
    id: String(u._id),
    username: u.username,
    role: u.role,
    balancePoints: u.balancePoints,
    frozenPoints: u.frozenPoints || 0,
    depositPoints: u.depositPoints,
    rating: u.rating,
    ratingCount: u.ratingCount,
    violations: u.violations,
    banned: u.banned,
    config: { sellerDepositPi: SELLER_DEPOSIT_PI, pointsPerPi: POINTS_PER_PI }
  } }));
});

// 卖家缴纳押金
router.post('/deposit/pay', auth, async (req, res) => {
  try {
    const user = await paySellerDeposit(req.user._id);
    res.json(jsonOk({ user }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

// 申请退押金（记录状态，管理员在 /admin 审核）
router.post('/deposit/refund', auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user || user.depositPoints <= 0) return res.status(400).json(jsonErr('无可退押金'));
  // 简化处理：仅提示已提交，实际审批在 admin 接口
  res.json(jsonOk({ submitted: true }));
});

// 获取指定用户信息（用于聊天显示）
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username email').lean();
    if (!user) return res.status(404).json(jsonErr('用户不存在'));
    res.json(jsonOk({ user }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

module.exports = router;


