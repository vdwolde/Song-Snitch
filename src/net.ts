// The whole client-server transport: connect, reconnect, typed send. Each consuming
// component owns its own state and decides what to do with each incoming message —
// this hook is deliberately dumb about game logic.
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../shared/types';

// onOpen fires after every successful connect, including a reconnect — the server
// forgets which player/host owned a socket as soon as it closes, so identity (a
// player's rejoin, the host's hello) must be re-sent every time, not just on mount.
export function useRoom(
  onMessage: (msg: ServerMsg) => void,
  onOpen?: (send: (msg: ClientMsg) => void) => void,
): { send: (msg: ClientMsg) => void; stalled: boolean } {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  // True once several straight connection attempts have failed without ever opening —
  // something structural is wrong (server not running, firewall, wrong network) and
  // retrying forever with zero feedback just looks like a dead button to whoever's
  // waiting on it.
  const [stalled, setStalled] = useState(false);

  function send(msg: ClientMsg): void {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;
    let failedAttempts = 0;

    function connect(): void {
      socket = new WebSocket(`ws://${location.host}/ws`);
      wsRef.current = socket;
      socket.onopen = () => {
        if (cancelled) return;
        failedAttempts = 0;
        setStalled(false);
        onOpenRef.current?.(send);
      };
      socket.onmessage = (ev) => {
        if (cancelled) return;
        onMessageRef.current(JSON.parse(ev.data as string) as ServerMsg);
      };
      socket.onclose = () => {
        if (cancelled) return;
        failedAttempts++;
        if (failedAttempts >= 3) setStalled(true);
        setTimeout(connect, 1000);
      };
    }
    connect();

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  return { send, stalled };
}
