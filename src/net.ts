// The whole client-server transport: connect, reconnect, typed send. Each consuming
// component owns its own state and decides what to do with each incoming message —
// this hook is deliberately dumb about game logic.
import { useEffect, useRef } from 'react';
import type { ClientMsg, ServerMsg } from '../shared/types';

// The app is now served from GitHub Pages (see .claude/DECISIONS.md ADR-005), a
// different origin than the game server it must talk to — so the server's own
// bare LAN address (or, for the host's own same-origin copy, nothing at all) travels
// in a ?server= query param on the join link and is cached in sessionStorage before
// any OAuth redirect can strip it from the URL bar (mirrors src/PlayerApp.tsx's
// identity persistence, same reason).
const SERVER_KEY = 'songsnitch-server';

function resolveServer(): string {
  try {
    const saved = sessionStorage.getItem(SERVER_KEY);
    if (saved !== null) return saved;
  } catch {
    // sessionStorage unavailable (private browsing) — falls through to same-origin
  }
  const server = new URLSearchParams(location.search).get('server') ?? '';
  try {
    sessionStorage.setItem(SERVER_KEY, server);
  } catch {
    // ignore
  }
  return server;
}

// '' means same-origin (the host's own copy of the app, served by its own Fastify
// server — the pre-ADR-005 case, still fully supported as a fallback if a phone has no
// internet to reach GitHub Pages but IS on the host's WiFi).
export function apiBase(): string {
  const server = resolveServer();
  return server ? `http://${server}` : '';
}

function wsHost(): string {
  return resolveServer() || location.host;
}

// onOpen fires after every successful connect, including a reconnect — the server
// forgets which player/host owned a socket as soon as it closes, so identity (a
// player's rejoin, the host's hello) must be re-sent every time, not just on mount.
export function useRoom(
  onMessage: (msg: ServerMsg) => void,
  onOpen?: (send: (msg: ClientMsg) => void) => void,
): { send: (msg: ClientMsg) => void } {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  function send(msg: ClientMsg): void {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;

    function connect(): void {
      socket = new WebSocket(`ws://${wsHost()}/ws`);
      wsRef.current = socket;
      socket.onopen = () => {
        if (!cancelled) onOpenRef.current?.(send);
      };
      socket.onmessage = (ev) => {
        if (cancelled) return;
        onMessageRef.current(JSON.parse(ev.data as string) as ServerMsg);
      };
      socket.onclose = () => {
        if (!cancelled) setTimeout(connect, 1000);
      };
    }
    connect();

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  return { send };
}
