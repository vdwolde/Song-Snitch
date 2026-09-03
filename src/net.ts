// The whole client-server transport: connect, reconnect, typed send. Each consuming
// component owns its own state and decides what to do with each incoming message —
// this hook is deliberately dumb about game logic.
import { useEffect, useRef } from 'react';
import type { ClientMsg, ServerMsg } from '../shared/types';

export function useRoom(onMessage: (msg: ServerMsg) => void): { send: (msg: ClientMsg) => void } {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;

    function connect(): void {
      socket = new WebSocket(`ws://${location.host}/ws`);
      wsRef.current = socket;
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

  function send(msg: ClientMsg): void {
    wsRef.current?.send(JSON.stringify(msg));
  }

  return { send };
}
