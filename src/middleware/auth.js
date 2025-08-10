const jwt = require('jsonwebtoken');
const { jsonErr } = require('../utils/response');
const { ROLES } = require('../utils/constants');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json(jsonErr('未登录', 'UNAUTHORIZED'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.uid);
    if (!user || user.banned) return res.status(403).json(jsonErr('账号不可用', 'FORBIDDEN'));
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json(jsonErr('登录状态无效', 'UNAUTHORIZED'));
  }
};

const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json(jsonErr('未登录', 'UNAUTHORIZED'));
  if (req.user.role !== role && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json(jsonErr('权限不足', 'FORBIDDEN'));
  }
  next();
};

module.exports = { auth, requireRole };


