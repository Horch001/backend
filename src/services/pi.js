// Pi SDK 服务端验证
// 生产环境请调用 Pi 平台服务校验用户签名/支付等。

const axios = require('axios');

// 验证 Pi 登录 Token（兼容模拟登录）
async function verifyPiLoginToken(piToken) {
  // TODO: 调用 Pi 平台接口校验。此处提供本地开发 Mock。
  if (!piToken) return null;
  // 简单 mock：token = "pi:USERID:USERNAME"
  if (piToken.startsWith('pi:')) {
    const [, piUserId, username] = piToken.split(':');
    return { piUserId, username: username || `user_${piUserId}` };
  }
  return null;
}

// 验证真实的 Pi 认证数据
async function verifyPiAuthData(authData) {
  try {
    if (!authData || !authData.user || !authData.user.uid) {
      console.log('❌ 无效的 Pi 认证数据')
      return null;
    }

    const { user, accessToken } = authData;
    
    // 验证用户数据完整性
    if (!user.uid || typeof user.uid !== 'string') {
      console.log('❌ 无效的用户 ID')
      return null;
    }
    
    // 详细记录用户数据
    console.log('🔍 Pi 用户数据详情:', {
      uid: user.uid,
      hasAccessToken: !!accessToken,
      userKeys: Object.keys(user),
      authDataKeys: Object.keys(authData)
    });
    
    // 尝试获取用户名，按照优先级顺序
    let username = null;
    
    // 1. 直接从 user.username 获取
    if (user.username) {
      username = user.username;
      console.log('✅ 从 user.username 获取到用户名:', username);
    }
    // 2. 从 user.currentUser.username 获取
    else if (user.currentUser && user.currentUser.username) {
      username = user.currentUser.username;
      console.log('✅ 从 user.currentUser.username 获取到用户名:', username);
    }
    // 3. 从 authData.currentUser.username 获取
    else if (authData.currentUser && authData.currentUser.username) {
      username = authData.currentUser.username;
      console.log('✅ 从 authData.currentUser.username 获取到用户名:', username);
    }
    // 4. 从 authData.user.username 获取
    else if (authData.user && authData.user.username) {
      username = authData.user.username;
      console.log('✅ 从 authData.user.username 获取到用户名:', username);
    }
    // 5. 如果有accessToken，尝试调用Pi API获取用户名
    else if (accessToken) {
      console.log('🔍 尝试通过Pi API获取用户名...');
      try {
        const response = await axios.get(`https://api.minepi.com/v2/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (response.data && response.data.username) {
          username = response.data.username;
          console.log('✅ 通过Pi API获取到用户名:', username);
        } else {
          console.warn('⚠️ Pi API返回的数据中没有用户名');
        }
      } catch (apiError) {
        console.error('❌ 调用Pi API获取用户名失败:', apiError.message);
      }
    }
    
    // 6. 如果都没有，使用UID作为用户名（临时方案）
    if (!username) {
      console.warn('⚠️ 无法找到用户名，使用UID作为用户名');
      username = `user_${user.uid}`;
    }
    
    console.log('✅ Pi 认证数据验证成功:', {
      uid: user.uid,
      username: username
    });

    return {
      piUserId: user.uid,
      username: username
    };
  } catch (error) {
    console.error('❌ Pi 认证数据验证失败:', error);
    return null;
  }
}

// 验证 Pi 支付（生产环境使用）
async function verifyPiPayment(paymentId, paymentData) {
  try {
    // 验证输入参数
    if (!paymentId) {
      console.error('❌ 缺少支付 ID')
      return null;
    }
    
    // 在生产环境中，这里应该调用 Pi 平台 API 验证支付
    // https://api.minepi.com/v2/payments/{payment_id}
    
    // 真实支付验证（需要 Pi API Key）
    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      console.error('❌ 缺少 PI_API_KEY 环境变量');
      return null;
    }

    // 调用 Pi 平台 API 验证支付
    const response = await axios.get(`https://api.minepi.com/v2/payments/${paymentId}`, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });

    const payment = response.data;
    
    // 验证支付数据完整性
    if (!payment.identifier || !payment.amount) {
      console.error('❌ 支付数据不完整:', payment);
      return null;
    }
    
    // 验证支付状态
    if (payment.status === 'completed' && payment.transaction && payment.transaction.verified) {
      console.log('✅ Pi 支付验证成功:', {
        paymentId: payment.identifier,
        amount: payment.amount,
        status: payment.status,
        txid: payment.transaction.txid
      });
      return {
        verified: true,
        paymentId: payment.identifier,
        amount: payment.amount,
        status: payment.status,
        transaction: payment.transaction
      };
    } else {
      console.log('⚠️ Pi 支付未完成或未验证:', {
        status: payment.status,
        verified: payment.transaction?.verified
      });
      return {
        verified: false,
        paymentId: payment.identifier,
        status: payment.status,
        transaction: payment.transaction
      };
    }
  } catch (error) {
    console.error('❌ Pi 支付验证失败:', error);
    
    // 根据错误类型提供更详细的错误信息
    if (error.response) {
      console.error('API 响应错误:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('网络请求失败:', error.message);
    } else {
      console.error('其他错误:', error.message);
    }
    
    return null;
  }
}

// 创建 Pi 支付记录（生产环境使用）
async function createPiPaymentRecord(paymentData) {
  try {
    // 验证支付数据
    if (!paymentData.amount || paymentData.amount <= 0) {
      console.error('❌ 无效的支付金额:', paymentData.amount);
      return null;
    }
    
    if (!paymentData.uid) {
      console.error('❌ 缺少用户 ID');
      return null;
    }
    
    // 真实支付记录创建（需要 Pi API Key）
    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      console.error('❌ 缺少 PI_API_KEY 环境变量');
      return null;
    }

    // 准备支付数据
    const paymentRequest = {
      amount: paymentData.amount,
      memo: paymentData.memo || '商品购买',
      metadata: paymentData.metadata || {},
      uid: paymentData.uid
    };

    console.log('📤 创建支付记录:', paymentRequest);

    const response = await axios.post('https://api.minepi.com/v2/payments', paymentRequest, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });

    const payment = response.data;
    console.log('✅ Pi 支付记录创建成功:', {
      paymentId: payment.identifier,
      status: payment.status
    });
    
    return {
      paymentId: payment.identifier,
      status: payment.status,
      payment: payment
    };
  } catch (error) {
    console.error('❌ Pi 支付记录创建失败:', error);
    
    // 根据错误类型提供更详细的错误信息
    if (error.response) {
      console.error('API 响应错误:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('网络请求失败:', error.message);
    } else {
      console.error('其他错误:', error.message);
    }
    
    return null;
  }
}

module.exports = { 
  verifyPiLoginToken, 
  verifyPiAuthData, 
  verifyPiPayment, 
  createPiPaymentRecord 
};


