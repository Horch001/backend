const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

let io;

function initSocket(server) {
  const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
  io = new Server(server, { cors: { origin: origins.length ? origins : true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.uid;
      next();
    } catch (e) { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket) => {
    socket.on('join', (roomId) => socket.join(roomId));
    socket.on('message', async ({ roomId, to, content, product }) => {
      if (!roomId || !to || !content) return;
      const msg = await Message.create({ roomId, from: socket.userId, to, content, product });
      io.to(roomId).emit('message', { 
        _id: msg._id, 
        roomId, 
        from: socket.userId, 
        to, 
        content, 
        product: msg.product,
        createdAt: msg.createdAt 
      });
    });
  });
}

module.exports = { initSocket };


