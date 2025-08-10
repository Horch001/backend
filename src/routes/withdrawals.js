const router = require('express').Router();
const { auth } = require('../middleware/auth');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const { jsonOk, jsonErr } = require('../utils/response');

router.post('/', auth, async (req, res) => {
  const { amountPoints } = req.body;
  if (!Number.isInteger(amountPoints) || amountPoints <= 0) return res.status(400).json(jsonErr('金额非法'));
  const user = await User.findById(req.user._id);
  if (!user) return res.status(400).json(jsonErr('用户不存在'));
  if (user.balancePoints <= 0) return res.status(400).json(jsonErr('余额不足'));
  if (amountPoints > user.balancePoints - (user.frozenPoints || 0)) return res.status(400).json(jsonErr('提现金额超出可用余额'));
  // 立即冻结申请金额，避免并发重复申请
  user.frozenPoints = (user.frozenPoints || 0) + amountPoints;
  await user.save();
  const w = await Withdrawal.create({ user: req.user._id, amountPoints, status: 'requested' });
  res.json(jsonOk({ withdrawal: w }));
});

router.get('/my', auth, async (req, res) => {
  const list = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(jsonOk({ list }));
});

module.exports = router;


