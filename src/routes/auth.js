const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { verifyPiLoginToken, verifyPiAuthData } = require('../services/pi');
const User = require('../models/User');
const { jsonOk, jsonErr } = require('../utils/response');
const { signToken } = require('../services/tradeRules');

// 处理 OPTIONS 请求（CORS 预检）
router.options('/pi/login', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

router.post(
  '/pi/login',
  body('piToken').isString().notEmpty(),
  async (req, res) => {
    console.log('🔍 收到 Pi 登录请求:', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      origin: req.get('Origin')
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ 参数验证失败:', errors.array());
      return res.status(400).json(jsonErr('参数错误', 'VALIDATION_ERROR', errors.array()));
    }
    
    const { piToken, authData } = req.body;
    
    let profile;
    
    // 如果有真实的 Pi 认证数据，优先验证
    if (authData && authData.user && authData.user.uid) {
      console.log('🔍 验证真实 Pi 认证数据')
      try {
        profile = await verifyPiAuthData(authData);
        if (!profile) {
          console.error('❌ Pi 认证数据验证失败');
          return res.status(400).json(jsonErr('Pi 认证数据验证失败'));
        }
        console.log('✅ Pi 认证数据验证成功，用户名:', profile.username);
      } catch (error) {
        console.error('❌ Pi 认证数据验证异常:', error.message);
        return res.status(400).json(jsonErr(`Pi 认证失败: ${error.message}`));
      }
    } else {
      console.log('🔍 使用 token 验证')
      profile = await verifyPiLoginToken(piToken);
    }
    
    if (!profile) return res.status(401).json(jsonErr('Pi 登录校验失败', 'PI_AUTH_FAILED'));
    
    let user = await User.findOne({ piUserId: profile.piUserId });
    if (!user) {
      // 创建新用户
      user = await User.create({ 
        piUserId: profile.piUserId, 
        username: profile.username,
        role: 'buyer' // 默认角色为买家
      });
      console.log('✅ 创建新用户:', { piUserId: profile.piUserId, username: profile.username });
    } else {
      // 更新现有用户的用户名（确保使用最新的真实用户名）
      if (user.username !== profile.username) {
        user.username = profile.username;
        await user.save();
        console.log('✅ 更新用户用户名:', { oldUsername: user.username, newUsername: profile.username });
      }
    }
    
    const token = signToken(user);
    return res.json(jsonOk({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        role: user.role 
      } 
    }));
  }
);

// 管理后台登录（基于管理员种子账号 + 简单用户名检测）
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json(jsonErr('缺少参数'));
  const envU = process.env.ADMIN_USERNAME;
  const envP = process.env.ADMIN_PASSWORD;
  if (username === envU && password === envP) {
    // 找到管理员用户并签发 JWT
    const admin = await User.findOne({ username: envU, role: 'admin' });
    const token = signToken(admin);
    return res.json(jsonOk({ token }));
  }
  return res.status(401).json(jsonErr('账号或密码错误'));
});

module.exports = router;


