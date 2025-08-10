const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { verifyPiPayment, createPiPaymentRecord } = require('../services/pi');
const { jsonOk, jsonErr } = require('../utils/response');

// 创建支付
router.post('/create', auth, async (req, res) => {
  try {
    const { amount, memo, metadata } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json(jsonErr('无效的支付金额'));
    }

    // 创建支付记录
    const paymentData = {
      amount,
      memo: memo || '商品购买',
      metadata: metadata || {},
      uid: req.user.piUserId
    };

    const paymentRecord = await createPiPaymentRecord(paymentData);
    
    if (!paymentRecord) {
      return res.status(500).json(jsonErr('支付记录创建失败'));
    }

    console.log('✅ 支付记录创建成功:', paymentRecord);

    res.json(jsonOk({
      paymentId: paymentRecord.paymentId,
      status: paymentRecord.status,
      amount,
      memo: paymentData.memo
    }));

  } catch (error) {
    console.error('❌ 创建支付失败:', error);
    res.status(500).json(jsonErr('创建支付失败'));
  }
});

// 验证支付
router.post('/verify', auth, async (req, res) => {
  try {
    const { paymentId, paymentData } = req.body;
    
    if (!paymentId) {
      return res.status(400).json(jsonErr('缺少支付ID'));
    }

    // 验证支付
    const verification = await verifyPiPayment(paymentId, paymentData);
    
    if (!verification) {
      return res.status(500).json(jsonErr('支付验证失败'));
    }

    console.log('✅ 支付验证结果:', verification);

    res.json(jsonOk({
      verified: verification.verified,
      paymentId: verification.paymentId,
      status: verification.status,
      amount: verification.amount
    }));

  } catch (error) {
    console.error('❌ 验证支付失败:', error);
    res.status(500).json(jsonErr('验证支付失败'));
  }
});

// 获取支付状态
router.get('/:paymentId/status', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // 验证支付状态
    const verification = await verifyPiPayment(paymentId, {});
    
    if (!verification) {
      return res.status(404).json(jsonErr('支付记录不存在'));
    }

    res.json(jsonOk({
      paymentId: verification.paymentId,
      status: verification.status,
      verified: verification.verified,
      amount: verification.amount
    }));

  } catch (error) {
    console.error('❌ 获取支付状态失败:', error);
    res.status(500).json(jsonErr('获取支付状态失败'));
  }
});

module.exports = router;
