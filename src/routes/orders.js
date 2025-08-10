const router = require('express').Router();
const { auth } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { jsonOk, jsonErr } = require('../utils/response');
const { shipOrder, confirmOrder, createOrderAfterPayment } = require('../services/tradeRules');
const { verifyPiPayment } = require('../services/pi');
const { ORDER_STATUS } = require('../utils/constants');
const Review = require('../models/Review');

// 创建订单（支持 Pi 支付验证）
router.post('/', auth, async (req, res) => {
  try {
    const { productId, paymentId, paymentData } = req.body;
    
    // 检查商品库存
    const product = await Product.findById(productId);
    if (!product || !product.isActive) return res.status(404).json(jsonErr('商品不存在或已下架'));
    if (product.stock <= 0) return res.status(400).json(jsonErr('商品库存不足'));
    
    // 如果有支付ID，验证支付
    if (paymentId && paymentData) {
      console.log('🔍 验证 Pi 支付:', paymentId)
      
      const paymentVerification = await verifyPiPayment(paymentId, paymentData);
      
      if (!paymentVerification || !paymentVerification.verified) {
        return res.status(400).json(jsonErr('支付验证失败'));
      }
      
      console.log('✅ Pi 支付验证成功:', paymentVerification)
    } else {
      // 没有支付信息，检查是否允许模拟支付
      if (process.env.MOCK_PAY !== 'true') {
        return res.status(400).json(jsonErr('需要支付验证'));
      }
      console.log('🔄 使用模拟支付模式')
    }
    
    // 创建订单
    const order = await createOrderAfterPayment({ 
      productId, 
      buyerId: req.user._id,
      paymentId,
      paymentData
    });
    
    // 支付成功后减少库存并计入销量
    await Product.findByIdAndUpdate(productId, { 
      $inc: { soldCount: 1, stock: -1 }
    });
    
    console.log('✅ 订单创建成功:', order._id)
    res.json(jsonOk({ order }));
    
  } catch (e) { 
    console.error('❌ 创建订单失败:', e)
    res.status(400).json(jsonErr(e.message)); 
  }
});

router.get('/my', auth, async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id })
    .populate('product')
    .populate('seller', 'username email')
    .sort({ createdAt: -1 });
  res.json(jsonOk({ orders }));
});

router.get('/sold', auth, async (req, res) => {
  const orders = await Order.find({ seller: req.user._id })
    .populate('product')
    .populate('buyer', 'username email')
    .sort({ createdAt: -1 });
  res.json(jsonOk({ orders }));
});

router.post('/:id/ship', auth, async (req, res) => {
  try {
    const order = await shipOrder(req.params.id, req.user._id);
    res.json(jsonOk({ order }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const order = await confirmOrder(req.params.id, req.user._id);
    res.json(jsonOk({ order }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

// 评价
router.post('/:id/review', auth, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('product');
  if (!order) return res.status(404).json(jsonErr('订单不存在'));
  if (String(order.buyer) !== String(req.user._id)) return res.status(403).json(jsonErr('无权操作'));
  if (order.status !== ORDER_STATUS.COMPLETED) return res.status(400).json(jsonErr('订单未完成'));
  const { rating = 5, content = '' } = req.body;
  const review = await Review.create({
    product: order.product._id,
    order: order._id,
    buyer: order.buyer,
    seller: order.seller,
    rating: Math.max(1, Math.min(5, Number(rating))),
    content
  });
  // 更新商品评分
  const p = order.product;
  const newCount = (p.ratingCount || 0) + 1;
  const newRating = ((p.rating || 0) * (p.ratingCount || 0) + review.rating) / newCount;
  await Product.findByIdAndUpdate(p._id, { rating: newRating, ratingCount: newCount });
  res.json(jsonOk({ review }));
});

router.get('/:id', auth, async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('product')
    .populate('buyer', 'username email')
    .populate('seller', 'username email');
  if (!order) return res.status(404).json(jsonErr('订单不存在'));
  res.json(jsonOk({ order }));
});

module.exports = router;


