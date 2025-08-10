const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { jsonOk, jsonErr } = require('../utils/response');
const Product = require('../models/Product');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const PriceModification = require('../models/PriceModification');
const { penalizeSellerDeposit } = require('../services/riskControl');
const { settleOrderPayout, refundOrder } = require('../services/settlement');
const Order = require('../models/Order');
const { paySellerDeposit } = require('../services/tradeRules');

router.use(auth, requireRole(ROLES.ADMIN));

router.get('/dashboard', async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
  const todayAmount = await Order.aggregate([
    { $match: { createdAt: { $gte: today } } },
    { $group: { _id: null, amount: { $sum: '$amountPoints' }, fee: { $sum: '$feePoints' } } }
  ]);
  res.json(jsonOk({
    ordersToday: todayOrders,
    amountPointsToday: todayAmount[0]?.amount || 0,
    feePointsToday: todayAmount[0]?.fee || 0
  }));
});

router.get('/products/pending', async (req, res) => {
  const list = await Product.find({ approved: false }).sort({ createdAt: -1 });
  res.json(jsonOk({ list }));
});

router.post('/products/:id/approve', async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
  res.json(jsonOk({ item: p }));
});

// 获取待审核的价格修改申请
router.get('/price-modifications/pending', async (req, res) => {
  const modifications = await PriceModification.find({ status: 'pending' })
    .populate('product', 'title')
    .populate('seller', 'username email')
    .sort({ createdAt: -1 });
  res.json(jsonOk({ modifications }));
});

// 审核价格修改申请
router.post('/price-modifications/:id/review', async (req, res) => {
  try {
    const { approved, note = '' } = req.body;
    const modification = await PriceModification.findById(req.params.id);
    
    if (!modification) {
      return res.status(404).json(jsonErr('申请不存在'));
    }

    if (modification.status !== 'pending') {
      return res.status(400).json(jsonErr('该申请已被处理'));
    }

    modification.status = approved ? 'approved' : 'rejected';
    modification.reviewedBy = req.user._id;
    modification.reviewedAt = new Date();
    modification.reviewNote = note;

    if (approved) {
      // 通过审核，更新商品价格
      const product = await Product.findById(modification.product);
      if (product) {
        product.pricePoints = modification.newPrice;
        product.approved = true; // 确保商品状态为已审核
        await product.save();
      }
    }

    await modification.save();
    res.json(jsonOk({ modification }));
  } catch (error) {
    res.status(400).json(jsonErr(error.message));
  }
});

router.get('/withdrawals', async (req, res) => {
  const list = await Withdrawal.find().sort({ createdAt: -1 });
  res.json(jsonOk({ list }));
});

router.post('/withdrawals/:id/review', async (req, res) => {
  const { action, note = '' } = req.body; // approve/reject/paid
  const w = await Withdrawal.findById(req.params.id);
  if (!w) return res.status(404).json(jsonErr('不存在'));
  if (action === 'approve') w.status = 'approved';
  else if (action === 'reject') w.status = 'rejected';
  else if (action === 'paid') {
    // 标记已打款，同时扣减用户余额
    const user = await User.findById(w.user);
    if (!user) return res.status(404).json(jsonErr('用户不存在'));
    if (user.balancePoints < w.amountPoints) return res.status(400).json(jsonErr('余额不足，无法扣减'));
    user.balancePoints -= w.amountPoints;
    user.frozenPoints = Math.max(0, (user.frozenPoints || 0) - w.amountPoints);
    await user.save();
    w.status = 'paid';
  }
  if (action === 'reject') {
    // 审核拒绝，解冻冻结金额
    const user = await User.findById(w.user);
    if (user) {
      user.frozenPoints = Math.max(0, (user.frozenPoints || 0) - w.amountPoints);
      await user.save();
    }
  }
  w.reviewNote = note;
  await w.save();
  res.json(jsonOk({ item: w }));
});

router.get('/deposits', async (req, res) => {
  const list = await Deposit.find().sort({ createdAt: -1 });
  res.json(jsonOk({ list }));
});

// 审核退押金（示例：直接拒绝或批准并扣减押金）
router.post('/deposits/:userId/refund', async (req, res) => {
  const { action } = req.body; // approve / reject
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json(jsonErr('用户不存在'));
  if (action === 'approve') {
    user.depositPoints = 0; await user.save();
    return res.json(jsonOk({ user }));
  }
  return res.json(jsonOk({ user }));
});

router.get('/complaints', async (req, res) => {
  const list = await Complaint.find().sort({ createdAt: -1 });
  res.json(jsonOk({ list }));
});

router.post('/complaints/:id/decide', async (req, res) => {
  const { decision, penaltyPoints = 0, note = '' } = req.body;
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json(jsonErr('不存在'));
  c.decision = decision; c.penaltyPoints = penaltyPoints; c.resolutionNote = note; c.status = 'resolved'; c.resolvedBy = req.user._id;
  await c.save();
  if (penaltyPoints > 0) await penalizeSellerDeposit(c.seller, penaltyPoints, decision || 'complaint_decision');
  res.json(jsonOk({ item: c }));
});

router.post('/orders/:id/settle', async (req, res) => {
  try {
    const o = await settleOrderPayout(req.params.id, req.user._id);
    res.json(jsonOk({ order: o }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

router.post('/orders/:id/refund', async (req, res) => {
  try {
    const o = await refundOrder(req.params.id, req.user._id);
    res.json(jsonOk({ order: o }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

router.post('/users/:id/ban', async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { banned: true }, { new: true });
  res.json(jsonOk({ user: u }));
});

module.exports = router;


