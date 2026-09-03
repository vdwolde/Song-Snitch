// The /ws route: socket <-> identity registry, message dispatch, broadcast. All game
// logic lives in server/game.ts — this file only routes messages to it and fans state
// back out to the right sockets.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as game from './game';
import { isHostRequest } from './net';
import type { ClientMsg, ErrorCode, Reveal, ServerMsg } from '../shared/types';

// The minimal surface this file needs from a ws.WebSocket. Declared locally instead of
// importing the 'ws' package's types (a transitive dep of @fastify/websocket, not one
// we list ourselves) — structurally compatible, so no cast is needed at the call site.
interface WsLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  on(event: 'message', cb: (data: Buffer) => void): void;
  on(event: 'close', cb: () => void): void;
}

interface Conn {
  socket: WsLike;
  req: FastifyRequest;
  role: 'host' | 'player';
  playerId?: string;
}

const OPEN = 1;
const conns = new Set<Conn>();

export function registerWs(app: FastifyInstance): void {
  game.setBroadcasters(broadcastState, broadcastReveal);

  app.get('/ws', { websocket: true }, (socket: WsLike, req) => {
    const conn: Conn = { socket, req, role: 'player' };
    conns.add(conn);

    socket.on('message', (raw: Buffer) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      handle(conn, msg);
    });

    socket.on('close', () => {
      conns.delete(conn);
      if (conn.playerId) game.setPlayerConnected(conn.playerId, false);
    });
  });
}

function send(socket: WsLike, msg: ServerMsg): void {
  if (socket.readyState === OPEN) socket.send(JSON.stringify(msg));
}

function sendError(socket: WsLike, code: ErrorCode, message: string): void {
  send(socket, { t: 'error', code, message });
}

// A playerId may have at most one live socket — a rejoin from a new tab/connection
// replaces the old one instead of running two sockets for the same player.
function claimPlayer(conn: Conn, playerId: string): void {
  for (const c of conns) {
    if (c !== conn && c.playerId === playerId) {
      c.playerId = undefined;
      try {
        c.socket.close();
      } catch {
        // already closing
      }
    }
  }
  conn.role = 'player';
  conn.playerId = playerId;
}

function sendPendingReveal(conn: Conn): void {
  const room = game.getRoom();
  if (room?.phase === 'reveal' && room.lastReveal) send(conn.socket, { t: 'reveal', ...room.lastReveal });
}

function handle(conn: Conn, msg: ClientMsg): void {
  if (msg.t.startsWith('host:')) {
    if (!isHostRequest(conn.req)) {
      sendError(conn.socket, 'not-host', 'Host actions require the host session');
      return;
    }
    conn.role = 'host';
  }

  switch (msg.t) {
    case 'host:hello': {
      send(conn.socket, { t: 'host:state', ...game.hostState() });
      sendPendingReveal(conn);
      return;
    }
    case 'host:createRoom':
      game.createRoom(msg.songsPerPlayer);
      return;
    case 'host:deviceReady':
      game.setDeviceReady(msg.deviceId);
      return;
    case 'host:start': {
      const r = game.startGame();
      if (!r.ok) sendError(conn.socket, r.code, r.message);
      return;
    }
    case 'host:skip':
      game.skipRound();
      return;
    case 'host:trackEnded':
      game.trackEnded();
      return;
    case 'host:next':
      game.nextRound();
      return;
    case 'player:join': {
      const r = game.joinRoom(msg.code, msg.name, msg.colour);
      if (!r.ok) {
        sendError(conn.socket, r.code, r.message);
        return;
      }
      claimPlayer(conn, r.value.playerId);
      send(conn.socket, { t: 'player:identity', playerId: r.value.playerId, token: r.value.token });
      const state = game.playerState(r.value.playerId);
      if (state) send(conn.socket, { t: 'player:state', ...state });
      return;
    }
    case 'player:rejoin': {
      const r = game.rejoinPlayer(msg.code, msg.token);
      if (!r.ok) {
        sendError(conn.socket, r.code, r.message);
        return;
      }
      claimPlayer(conn, r.value.playerId);
      const state = game.playerState(r.value.playerId);
      if (state) send(conn.socket, { t: 'player:state', ...state });
      sendPendingReveal(conn);
      return;
    }
    case 'player:submit': {
      if (!conn.playerId) return;
      const r = game.submitTrack(conn.playerId, msg.track);
      if (!r.ok) sendError(conn.socket, r.code, r.message);
      return;
    }
    case 'player:unsubmit': {
      if (!conn.playerId) return;
      const r = game.unsubmitTrack(conn.playerId, msg.trackId);
      if (!r.ok) sendError(conn.socket, r.code, r.message);
      return;
    }
    case 'player:vote': {
      if (!conn.playerId) return;
      const r = game.castVote(conn.playerId, msg.guessId);
      if (!r.ok) sendError(conn.socket, r.code, r.message);
      return;
    }
  }
}

function broadcastState(): void {
  const hostState = game.hostState();
  for (const c of conns) {
    if (c.role === 'host') {
      send(c.socket, { t: 'host:state', ...hostState });
    } else if (c.playerId) {
      const state = game.playerState(c.playerId);
      if (state) send(c.socket, { t: 'player:state', ...state });
    }
  }
}

function broadcastReveal(reveal: Reveal): void {
  for (const c of conns) send(c.socket, { t: 'reveal', ...reveal });
}
