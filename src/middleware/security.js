const rateLimit = require('express-rate-limit');

// 创建限流中间件
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs, // 15分钟
    max, // 限制每个IP在windowMs内最多请求max次
    message: {
      error: '请求过于频繁，请稍后再试',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // 返回标准的RateLimit-* headers
    legacyHeaders: false, // 禁用X-RateLimit-* headers
  });
};

// 登录限流（更严格）
const loginLimiter = createRateLimit(15 * 60 * 1000, 5); // 15分钟内最多5次登录尝试

// 支付限流
const paymentLimiter = createRateLimit(15 * 60 * 1000, 10); // 15分钟内最多10次支付请求

// 通用限流
const generalLimiter = createRateLimit(15 * 60 * 1000, 100); // 15分钟内最多100次请求

// 安全检查中间件
const securityCheck = (req, res, next) => {
  // 检查请求来源
  const origin = req.get('Origin');
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
  
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    console.warn('⚠️ 可疑的请求来源:', origin);
  }
  
  // 检查请求大小
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      error: '请求体过大',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
};

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = process.env.LOG_LEVEL || 'info';
    
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (logLevel === 'debug') {
      console.log('📝 请求日志:', logData);
    } else if (res.statusCode >= 400) {
      console.warn('⚠️ 请求错误:', logData);
    }
  });
  
  next();
};

module.exports = {
  loginLimiter,
  paymentLimiter,
  generalLimiter,
  securityCheck,
  requestLogger
};
