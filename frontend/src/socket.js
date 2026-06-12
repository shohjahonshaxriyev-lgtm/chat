import { io } from 'socket.io-client';

// In production build, frontend is served from the same server
const SOCKET_URL = window.location.origin;

const socket = io(SOCKET_URL, {
  autoConnect: false,
  rejectUnauthorized: false,
  transports: ['websocket']
});

export default socket;
