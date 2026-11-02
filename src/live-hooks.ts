import { useEffect, useRef, useState } from 'react';
import { TrainerSession, emptyHost } from './live-session';

export function useTrainerSession() {
  const [snapshot, setSnapshot] = useState(emptyHost);
  const client = useRef<TrainerSession | null>(null);
  const active = useRef(false); active.current = snapshot.active;
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (active.current) { event.preventDefault(); event.returnValue = ''; } };
    const pageHide = () => client.current?.close(true);
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide); client.current?.close(true); };
  }, []);
  function start() {
    client.current?.close(true);
    client.current = new TrainerSession(setSnapshot);
    void client.current.start();
  }
  function close() { client.current?.close(); client.current = null; }
  return { snapshot, client, start, close };
}

