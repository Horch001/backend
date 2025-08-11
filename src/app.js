require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDb } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { jsonOk } = require('./utils/response');

connectDb();

const app = express();

const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
// 开发环境下允许所有本地端口，生产环境使用配置的域名
const allowedOrigins = origins.length ? origins : [
  'http://localhost:3000',
  'http://localhost:5173', 
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://jiaoyi.zeabur.app',
  'https://jiaoyi.zeabur.app/admin'
];
app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Health
app.get('/health', (req, res) => res.json(jsonOk({ status: 'ok' })));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/products', require('./routes/products'));
app.use('/orders', require('./routes/orders'));
app.use('/complaints', require('./routes/complaints'));
app.use('/withdrawals', require('./routes/withdrawals'));
app.use('/chat', require('./routes/chat'));
app.use('/users', require('./routes/users'));
app.use('/admin', require('./routes/admin'));
app.use('/stats', require('./routes/stats'));
app.use('/payments', require('./routes/payments'));
app.use('/config', require('./routes/config'));

// Errors
app.use(errorHandler);

module.exports = app;


