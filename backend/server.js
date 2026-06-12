const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Track rooms
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Foydalanuvchi ulandi:', socket.id);

  socket.on('create-room', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms.set(roomId, { users: [socket.id], createdAt: Date.now() });
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Xona yaratildi: ${roomId}`);
    callback({ roomId });
  });

  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ error: 'Bunday xona topilmadi' });
    }
    if (room.users.length >= 2) {
      return callback({ error: "Xona to'lgan (max 2 kishi)" });
    }

    room.users.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Xonaga qo'shildi: ${roomId}`);

    socket.to(roomId).emit('user-joined', socket.id);
    callback({ success: true });
  });

  socket.on('ready', (roomId) => {
    socket.to(roomId).emit('user-ready', socket.id);
  });

  // WebRTC Signaling
  socket.on('offer', (data) => {
    console.log(`[Signaling] Offer: ${socket.id} -> ${data.target}`);
    socket.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
  });

  socket.on('answer', (data) => {
    console.log(`[Signaling] Answer: ${socket.id} -> ${data.target}`);
    socket.to(data.target).emit('answer', { sdp: data.sdp, answerer: socket.id });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Foydalanuvchi uzildi:', socket.id);
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.users = room.users.filter(id => id !== socket.id);
        socket.to(socket.roomId).emit('user-left');
        if (room.users.length === 0) rooms.delete(socket.roomId);
      }
    }
  });
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server ishga tushdi: http://localhost:${PORT}`);
});
