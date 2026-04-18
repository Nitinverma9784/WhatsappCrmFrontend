import { io, Socket } from 'socket.io-client';

const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';

const socket: Socket = io(url, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
});

export function setSocketAuthToken(token: string | null) {
  (socket as any).auth = { token: token || '' };
}

export default socket;
