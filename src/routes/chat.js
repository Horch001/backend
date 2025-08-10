const router = require('express').Router();
const { auth } = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const { jsonOk } = require('../utils/response');

// 获取指定房间的聊天记录
router.get('/:roomId', auth, async (req, res) => {
  const list = await Message.find({ roomId: req.params.roomId }).sort({ createdAt: 1 }).limit(200);
  res.json(jsonOk({ list }));
});

// 获取用户的所有聊天记录（按房间分组）
router.get('/user/conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // 获取用户参与的所有聊天记录
    const messages = await Message.find({
      $or: [
        { from: userId },
        { to: userId }
      ]
    }).sort({ createdAt: -1 }).populate('from', 'username email').populate('to', 'username email');
    
    // 按房间分组，获取每个房间的最新消息
    const conversations = {};
    messages.forEach(msg => {
      const roomId = msg.roomId;
      if (!conversations[roomId]) {
        conversations[roomId] = {
          roomId,
          lastMessage: msg,
          unreadCount: 0,
          otherUser: null
        };
      }
      
      // 计算未读消息数（对方发送给当前用户的消息）
      if (msg.to.toString() === userId.toString() && !msg.read) {
        conversations[roomId].unreadCount++;
      }
      
      // 确定对方用户信息
      if (msg.from.toString() === userId.toString()) {
        conversations[roomId].otherUser = msg.to;
      } else {
        conversations[roomId].otherUser = msg.from;
      }
    });
    
    // 转换为数组并按最新消息时间排序
    const conversationList = Object.values(conversations).sort((a, b) => 
      new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );
    
    res.json(jsonOk({ conversations: conversationList }));
  } catch (error) {
    console.error('获取聊天记录失败:', error);
    res.status(500).json({ error: '获取聊天记录失败' });
  }
});

// 标记消息为已读
router.post('/:roomId/read', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const roomId = req.params.roomId;
    
    // 将对方发送给当前用户的消息标记为已读
    await Message.updateMany(
      { 
        roomId, 
        to: userId,
        read: { $ne: true }
      },
      { read: true }
    );
    
    res.json(jsonOk({ message: '标记成功' }));
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ error: '标记已读失败' });
  }
});

module.exports = router;


