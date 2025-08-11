const { jsonErr } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('❌ 服务器错误:', err);
  
  // 设置 CORS 头
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  const status = err.status || 500;
  res.status(status).json(jsonErr(err.message || 'Server Error', err.code || 'SERVER_ERROR'));
};

module.exports = { errorHandler };


