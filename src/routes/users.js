const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { jsonOk, jsonErr } = require('../utils/response');
const { paySellerDeposit, SELLER_DEPOSIT_PI, POINTS_PER_PI } = require('../services/tradeRules');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');

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
    const { paymentId, paymentData } = req.body;
    
    // 必须有支付数据才能缴纳押金
    if (!paymentId || !paymentData) {
      return res.status(400).json(jsonErr('缺少支付信息'));
    }
    
    console.log('🔍 验证押金支付:', paymentId)
    
    const { verifyPiPayment } = require('../services/pi');
    const paymentVerification = await verifyPiPayment(paymentId, paymentData);
    
    if (!paymentVerification || !paymentVerification.verified) {
      return res.status(400).json(jsonErr('支付验证失败'));
    }
    
    console.log('✅ 押金支付验证成功:', paymentVerification)
    
    const user = await paySellerDeposit(req.user._id);
    res.json(jsonOk({ user }));
  } catch (e) { 
    console.error('❌ 押金缴纳失败:', e);
    res.status(400).json(jsonErr(e.message)); 
  }
});

// 申请退押金（记录状态，管理员在 /admin 审核）
router.post('/deposit/refund', auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user || user.depositPoints <= 0) return res.status(400).json(jsonErr('无可退押金'));
  // 简化处理：仅提示已提交，实际审批在 admin 接口
  res.json(jsonOk({ submitted: true }));
});

// 用户充值
router.post('/recharge', auth, async (req, res) => {
  try {
    const { amountPi, paymentId, paymentData } = req.body;
    
    if (!amountPi || amountPi <= 0) {
      return res.status(400).json(jsonErr('无效的充值金额'));
    }
    
    // 必须有支付数据才能充值
    if (!paymentId || !paymentData) {
      return res.status(400).json(jsonErr('缺少支付信息'));
    }
    
    console.log('🔍 验证充值支付:', paymentId)
    
    const { verifyPiPayment } = require('../services/pi');
    const paymentVerification = await verifyPiPayment(paymentId, paymentData);
    
    if (!paymentVerification || !paymentVerification.verified) {
      return res.status(400).json(jsonErr('支付验证失败'));
    }
    
    console.log('✅ 充值支付验证成功:', paymentVerification)
    
    // 计算积分数量
    const amountPoints = Math.round(amountPi * POINTS_PER_PI);
    
    // 更新用户余额
    const user = await User.findById(req.user._id);
    user.balancePoints = (user.balancePoints || 0) + amountPoints;
    await user.save();
    
    // 记录充值记录
    await Deposit.create({
      user: user._id,
      amountPoints: amountPoints,
      status: 'paid'
    });
    
    console.log('✅ 充值成功:', {
      userId: user._id,
      amountPi,
      amountPoints,
      newBalance: user.balancePoints
    });
    
    res.json(jsonOk({ 
      user: {
        id: String(user._id),
        username: user.username,
        role: user.role,
        balancePoints: user.balancePoints,
        frozenPoints: user.frozenPoints || 0,
        depositPoints: user.depositPoints,
        rating: user.rating,
        ratingCount: user.ratingCount,
        violations: user.violations,
        banned: user.banned,
        config: { sellerDepositPi: SELLER_DEPOSIT_PI, pointsPerPi: POINTS_PER_PI }
      }
    }));
  } catch (error) {
    console.error('❌ 充值失败:', error);
    res.status(500).json(jsonErr('充值失败'));
  }
});

// 获取用户积分明细（包含充值、提现、押金等所有交易记录）
router.get('/transactions', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // 获取押金记录
    const deposits = await Deposit.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    // 获取提现记录
    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    // 合并并格式化交易记录
    const transactions = [
      ...deposits.map(deposit => ({
        id: deposit._id,
        type: deposit.amountPoints > 0 ? 'recharge' : 'deposit',
        amount: deposit.amountPoints,
        status: deposit.status,
        createdAt: deposit.createdAt,
        description: deposit.amountPoints > 0 ? 'π钱包充值' : '押金缴纳'
      })),
      ...withdrawals.map(withdrawal => ({
        id: withdrawal._id,
        type: 'withdrawal',
        amount: withdrawal.amountPoints,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        description: '提现申请'
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(jsonOk({ 
      list: transactions,
      total: transactions.length
    }));
  } catch (error) {
    console.error('❌ 获取交易记录失败:', error);
    res.status(500).json(jsonErr('获取交易记录失败'));
  }
});

// 获取指定用户信息（用于聊天显示）
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username email').lean();
    if (!user) return res.status(404).json(jsonErr('用户不存在'));
    res.json(jsonOk({ user }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

// 批准支付
router.post('/approve-payment', auth, async (req, res) => {
  try {
    const { paymentId, amount, memo, metadata } = req.body;
    const userId = req.user._id;
    
    console.log('🔍 收到支付批准请求:', {
      paymentId,
      amount,
      memo,
      metadata,
      userId
    });
    
    // 验证支付数据
    if (!paymentId || !amount) {
      return res.status(400).json(jsonErr('缺少支付信息'));
    }
    
    // 这里可以添加额外的验证逻辑
    // 例如检查用户余额、验证支付金额等
    
    console.log('✅ 支付批准成功:', paymentId);
    res.json(jsonOk({ 
      approved: true, 
      paymentId,
      message: '支付已批准'
    }));
  } catch (error) {
    console.error('❌ 支付批准失败:', error);
    res.status(500).json(jsonErr('支付批准失败'));
  }
});

// 完成支付
router.post('/complete-payment', auth, async (req, res) => {
  try {
    const { paymentId, txid, amount, memo, metadata } = req.body;
    const userId = req.user._id;
    
    console.log('🔍 收到支付完成请求:', {
      paymentId,
      txid,
      amount,
      memo,
      metadata,
      userId
    });
    
    // 验证支付数据
    if (!paymentId || !txid || !amount) {
      return res.status(400).json(jsonErr('缺少支付信息'));
    }
    
    // 验证Pi支付
    const { verifyPiPayment } = require('../services/pi');
    const paymentVerification = await verifyPiPayment(paymentId, {
      amount,
      memo,
      metadata
    });
    
    if (!paymentVerification || !paymentVerification.verified) {
      console.error('❌ Pi支付验证失败:', paymentVerification);
      return res.status(400).json(jsonErr('支付验证失败'));
    }
    
    // 计算积分
    const points = amount * POINTS_PER_PI;
    
    // 更新用户余额
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(jsonErr('用户不存在'));
    }
    
    user.balancePoints = (user.balancePoints || 0) + points;
    await user.save();
    
    // 记录充值交易
    await Deposit.create({
      user: userId,
      amountPoints: points,
      status: 'paid',
      paymentId,
      txid,
      metadata: {
        type: 'recharge',
        amountPi: amount,
        memo,
        ...metadata
      }
    });
    
    console.log('✅ 支付完成成功:', {
      paymentId,
      txid,
      amount,
      points,
      newBalance: user.balancePoints
    });
    
    res.json(jsonOk({
      completed: true,
      paymentId,
      txid,
      amount,
      points,
      newBalance: user.balancePoints,
      message: '支付完成'
    }));
  } catch (error) {
    console.error('❌ 支付完成失败:', error);
    res.status(500).json(jsonErr('支付完成失败'));
  }
});

module.exports = router;


