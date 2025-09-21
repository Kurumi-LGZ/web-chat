// server.js
const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const app = express();

app.use(express.static(path.join(__dirname, './')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(3000, '0.0.0.0', () => {
  console.log('服务器运行在 http://0.0.0.0:3000');
});

const wss = new WebSocket.Server({ server });
let onlineUsers = [];

wss.on('connection', (ws) => {
  if (onlineUsers.length >= 15) {
    ws.send(JSON.stringify({ type: 'error', message: '当前人数已满' }));
    ws.close();
    return;
  }

  const userId = Date.now().toString();
  const userName = `用户${Math.floor(Math.random() * 10000 + 1000)}`;
  onlineUsers.push({ userId, userName, ws });

  // 仅向新用户自己发送包含user信息的事件（核心修复）
  ws.send(JSON.stringify({ 
    type: 'userJoin', 
    user: { userId, userName }, 
    onlineCount: onlineUsers.length 
  }));

  // 向其他用户广播时，严格排除user字段
  broadcast({ 
    type: 'userJoin', 
    onlineCount: onlineUsers.length 
  }, ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'chatMessage') {
        broadcast({ 
          type: 'chatMessage', 
          sender: { userId, userName }, 
          message: data.message,
          timestamp: new Date().toLocaleTimeString()
        }, ws);
      }
    } catch (e) {
      console.error('消息解析错误:', e);
    }
  });

  ws.onclose = () => {
    onlineUsers = onlineUsers.filter(user => user.userId !== userId);
    broadcast({ 
      type: 'userLeave', 
      userId, 
      onlineCount: onlineUsers.length 
    });
  };
});

function broadcast(message, excludeWs) {
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}