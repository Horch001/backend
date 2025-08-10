const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Favorite = require('../models/Favorite');
const PriceModification = require('../models/PriceModification');
const { auth, requireRole } = require('../middleware/auth');
const { jsonOk, jsonErr } = require('../utils/response');
const { ROLES } = require('../utils/constants');
const { requireSellerDeposit } = require('../services/tradeRules');

router.get('/', async (req, res) => {
  const { q, category, sort = 'latest' } = req.query;
  const filter = { isActive: true, approved: true, stock: { $gt: 0 } };  // 排除0库存商品
  if (q) filter.$or = [ { title: new RegExp(q, 'i') }, { subtitle: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') } ];
  if (category) filter.category = category;
  const sortMap = { latest: { createdAt: -1 }, sales: { soldCount: -1 } };
  const items = await Product.find(filter).sort(sortMap[sort] || sortMap.latest).limit(100).lean();
  res.json(jsonOk({ items }));
});

// 获取我的商品
router.get('/my', auth, requireRole(ROLES.SELLER), async (req, res) => {
  const products = await Product.find({ seller: req.user._id })
    .sort({ 
      isActive: -1,  // 上架商品在前 (true > false)
      createdAt: -1  // 按创建时间倒序
    })
    .lean();
  res.json(jsonOk({ products }));
});

// 下架商品
router.post('/:id/deactivate', auth, requireRole(ROLES.SELLER), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json(jsonErr('商品不存在'));
    if (String(product.seller) !== String(req.user._id)) return res.status(403).json(jsonErr('无权操作'));
    
    // 检查是否有进行中的订单
    const Order = require('../models/Order');
    const activeOrders = await Order.find({
      product: req.params.id,
      status: { $in: ['paid', 'shipped'] }
    });
    
    if (activeOrders.length > 0) {
      return res.status(400).json(jsonErr(`该商品还有 ${activeOrders.length} 个进行中的订单，请先处理完所有订单后再下架商品`));
    }
    
    // 直接下架商品
    product.isActive = false;
    
    await product.save();
    res.json(jsonOk({ product }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

// 上架商品
router.post('/:id/activate', auth, requireRole(ROLES.SELLER), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json(jsonErr('商品不存在'));
    if (String(product.seller) !== String(req.user._id)) return res.status(403).json(jsonErr('无权操作'));
    
    product.isActive = true;
    await product.save();
    res.json(jsonOk({ product }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

// 提交价格修改申请
router.post('/:id/price-modification', auth, requireRole(ROLES.SELLER), async (req, res) => {
  try {
    const { newPrice, reason } = req.body;
    
    if (!newPrice || !reason) {
      return res.status(400).json(jsonErr('请提供新价格和修改原因'));
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json(jsonErr('商品不存在'));
    if (String(product.seller) !== String(req.user._id)) return res.status(403).json(jsonErr('无权操作'));

    // 检查是否已有待审核的价格修改申请
    const existingModification = await PriceModification.findOne({
      product: req.params.id,
      status: 'pending'
    });

    if (existingModification) {
      return res.status(400).json(jsonErr('该商品已有待审核的价格修改申请'));
    }

    // 创建价格修改申请
    const priceModification = await PriceModification.create({
      product: req.params.id,
      seller: req.user._id,
      oldPrice: product.pricePoints,
      newPrice: Math.round(newPrice * (Number(process.env.POINTS_PER_PI) || 1)),
      reason: reason.trim()
    });

    res.json(jsonOk({ priceModification }));
  } catch (e) { res.status(400).json(jsonErr(e.message)); }
});

// 公开商品详情API（只显示上架商品）
router.get('/:id', async (req, res) => {
  const item = await Product.findById(req.params.id).populate('seller', 'username email').lean();
  if (!item || !item.isActive) return res.status(404).json(jsonErr('商品不存在'));
  const reviews = await Review.find({ product: req.params.id }).populate('buyer', 'username').sort({ createdAt: -1 }).limit(20);
  res.json(jsonOk({ item, reviews }));
});

// 带权限的商品详情API（支持查看下架商品）
router.get('/:id/detail', auth, async (req, res) => {
  const item = await Product.findById(req.params.id).populate('seller', 'username email').lean();
  if (!item) return res.status(404).json(jsonErr('商品不存在'));
  
  // 检查用户权限
  let canView = item.isActive;  // 默认只有上架商品可以查看
  
  // 如果是卖家本人，可以查看自己的商品
  if (String(item.seller._id) === String(req.user._id)) {
    canView = true;
  }
  
  // 如果用户已购买过此商品，也可以查看
  if (!canView) {
    const Order = require('../models/Order');
    const hasOrder = await Order.findOne({
      product: req.params.id,
      buyer: req.user._id
    });
    if (hasOrder) {
      canView = true;
    }
  }
  
  if (!canView) {
    return res.status(404).json(jsonErr('商品不存在或已下架'));
  }
  
  const reviews = await Review.find({ product: req.params.id }).populate('buyer', 'username').sort({ createdAt: -1 }).limit(20);
  res.json(jsonOk({ item, reviews }));
});

router.post(
  '/',
  auth,
  requireRole(ROLES.SELLER),
  body('title').isString().notEmpty(),
  body('pricePoints').isInt({ min: 1 }),
  body('stock').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(jsonErr('参数错误', 'VALIDATION_ERROR', errors.array()));
    try {
      await requireSellerDeposit(req.user._id);
      const { title, subtitle, description, pricePoints, stock, images = [], category = '', deliveryMethod } = req.body;
      const product = await Product.create({ 
        seller: req.user._id, 
        title, 
        subtitle, 
        description, 
        pricePoints, 
        stock,
        images, 
        category, 
        deliveryMethod,
        approved: false 
      });
      res.json(jsonOk({ item: product }));
    } catch (e) { res.status(400).json(jsonErr(e.message)); }
  }
);

router.put('/:id', auth, requireRole(ROLES.SELLER), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json(jsonErr('商品不存在'));
  if (String(product.seller) !== String(req.user._id)) return res.status(403).json(jsonErr('无权操作'));
  
  // 允许更新的字段（不包含价格）
  const updatable = ['title', 'subtitle', 'description', 'stock', 'images', 'category', 'deliveryMethod'];
  for (const key of updatable) if (key in req.body) product[key] = req.body[key];
  
  // 直接保存，不需要重新审核
  await product.save();
  res.json(jsonOk({ item: product }));
});

// 收藏/取消收藏
router.post('/:id/favorite', auth, async (req, res) => {
  const productId = req.params.id;
  const exists = await Favorite.findOne({ user: req.user._id, product: productId });
  let action;
  if (exists) {
    await Favorite.deleteOne({ _id: exists._id });
    await Product.findByIdAndUpdate(productId, { $inc: { favoritesCount: -1 } });
    action = 'unfavorite';
  } else {
    try {
      await Favorite.create({ user: req.user._id, product: productId });
      await Product.findByIdAndUpdate(productId, { $inc: { favoritesCount: 1 } });
      action = 'favorite';
    } catch (e) {
      return res.status(400).json(jsonErr('收藏失败'));
    }
  }
  const p = await Product.findById(productId).lean();
  return res.json(jsonOk({ action, favoritesCount: p?.favoritesCount || 0 }));
});

module.exports = router;


