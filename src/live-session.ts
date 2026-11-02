import questionData from './questions.json';
import { PROTOCOL, PEER_PREFIX, HEARTBEAT_MS, STALE_MS, LOST_MS, MAX_SESSION_MS, MAX_PARTICIPANTS, newRoomCode, newClientId, normalizeCode, cleanName, validEnvelope, validateProgress } from './live-protocol.mjs';

export type Progress = { answers: Record<number, number>; revision: number; current: number; finished: boolean };
export type Participant = Progress & { id: string; name: string; online: boolean; lastSeen: number };
export type Review = { phase: 'practice' | 'review'; question: number; revealed: boolean };
export type HostSnapshot = Review & { active: boolean; status: 'idle' | 'connecting' | 'ready' | 'reconnecting' | 'error'; code: string; error: string; participants: Participant[] };
export type GuestSnapshot = Review & { status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed'; name: string; progress: Progress; acknowledged: number; error: string };
type Connection = { open: boolean; peer: string; on: (event: string, fn: (...args: any[]) => void) => any; send: (data: any) => void; close: () => void };
type PeerLike = { destroyed: boolean; disconnected: boolean; on: (event: string, fn: (...args: any[]) => void) => any; connect: (id: string, options: any) => Connection; reconnect: () => void; destroy: () => void };
export type PeerFactory = (id?: string) => Promise<PeerLike>;
const emptyProgress = (): Progress => ({ answers: {}, revision: 0, current: 1, finished: false });
const emptyReview = (): Review => ({ phase: 'practice', question: 1, revealed: false });
export const emptyHost = (): HostSnapshot => ({ ...emptyReview(), active: false, status: 'idle', code: '', error: '', participants: [] });
export const emptyGuest = (): GuestSnapshot => ({ ...emptyReview(), status: 'idle', name: '', progress: emptyProgress(), acknowledged: -1, error: '' });
const cloneProgress = (p: Progress): Progress => ({ answers: { ...p.answers }, revision: p.revision, current: p.current, finished: p.finished });
const peerFactory: PeerFactory = async id => {
  const { default: Peer, util } = await import('peerjs');
  // PeerJS's public Cloud and default STUN/TURN configuration; no personal API key.
  const defaults = util.defaultConfig;
  const tcpRelays = defaults.iceServers.filter(server => 'username' in server).map(server => ({ ...server, urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((url): url is string => typeof url === 'string' && url.startsWith('turn:')).map(url => `${url}?transport=tcp`) }));
  return new Peer(id || `vch-guest-${newClientId()}`, { secure: true, debug: 0, config: { ...defaults, iceServers: [...defaults.iceServers, ...tcpRelays] } }) as unknown as PeerLike;
};
function send(connection: Connection, message: object) {
  if (connection.open) { try { connection.send({ protocol: PROTOCOL, ...message }); } catch { /* Connection recovery handles loss. */ } }
}
function networkError() { return 'De live verbinding is niet beschikbaar. Controleer internet en probeer opnieuw. Een bedrijfsnetwerk kan de verbinding blokkeren.'; }

export class TrainerSession {
  private snapshot: HostSnapshot = emptyHost();
  private peer?: PeerLike;
  private records = new Map<string, Participant>();
  private connections = new Map<string, Connection>();
  private pending = new Set<Connection>();
  private joinTimers = new Map<Connection, ReturnType<typeof setTimeout>>();
  private heartbeat?: ReturnType<typeof setInterval>;
  private startTimer?: ReturnType<typeof setTimeout>;
  private startedAt = 0;
  private epoch = 0;
  private closed = false;
  constructor(private changed: (value: HostSnapshot) => void, private factory: PeerFactory = peerFactory) {}
  private emit() { this.changed({ ...this.snapshot, participants: [...this.records.values()].map(p => ({ ...p, answers: { ...p.answers } })) }); }
  get active() { return this.snapshot.active; }
  async start() {
    if (this.snapshot.active || this.closed) return;
    const epoch = ++this.epoch;
    this.startedAt = Date.now();
    this.snapshot = { ...emptyHost(), active: true, status: 'connecting', code: newRoomCode() };
    this.emit();
    this.startTimer = setTimeout(() => { if (this.snapshot.status === 'connecting') { this.snapshot.status = 'error'; this.snapshot.error = networkError(); this.emit(); } }, 20000);
    try {
      const peer = await this.factory(PEER_PREFIX + this.snapshot.code);
      if (this.closed || epoch !== this.epoch) { peer.destroy(); return; }
      this.peer = peer;
      peer.on('open', () => { if (this.closed) return; clearTimeout(this.startTimer); this.snapshot.status = 'ready'; this.snapshot.error = ''; this.emit(); });
      peer.on('connection', (connection: Connection) => this.accept(connection));
      peer.on('disconnected', () => { if (!this.closed) { this.snapshot.status = 'reconnecting'; this.snapshot.error = 'Nieuwe deelnemers verbinden zodra internet terug is. Bestaande verbindingen kunnen blijven werken.'; this.emit(); } });
      peer.on('error', (error: { type?: string }) => {
        if (this.closed) return;
        this.snapshot.status = 'error';
        this.snapshot.error = error.type === 'unavailable-id' ? 'Deze sessiecode is al in gebruik. Sluit deze sessie af en start opnieuw.' : networkError(); this.emit();
      });
      this.heartbeat = setInterval(() => this.tick(), HEARTBEAT_MS);
    } catch { if (!this.closed) { this.snapshot.status = 'error'; this.snapshot.error = networkError(); this.emit(); } }
  }
  private accept(connection: Connection) {
    if (this.closed || this.pending.size > MAX_PARTICIPANTS + 10) { connection.close(); return; }
    this.pending.add(connection);
    this.joinTimers.set(connection, setTimeout(() => { this.pending.delete(connection); this.joinTimers.delete(connection); connection.close(); }, 35000));
    let clientId = '';
    connection.on('data', (raw: unknown) => {
      if (this.closed || !validEnvelope(raw)) return;
      const data = raw as any;
      if (!clientId) {
        if (data.type !== 'hello' || typeof data.clientId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.clientId) || !cleanName(data.name)) { connection.close(); return; }
        if (!this.records.has(data.clientId) && this.records.size >= MAX_PARTICIPANTS) { send(connection, { type: 'rejected', message: 'Deze sessie is vol.' }); setTimeout(() => connection.close(), 200); return; }
        clientId = data.clientId;
        clearTimeout(this.joinTimers.get(connection)); this.joinTimers.delete(connection); this.pending.delete(connection);
        const previous = this.connections.get(clientId);
        this.connections.set(clientId, connection);
        if (previous && previous !== connection) previous.close();
        const previousRecord = this.records.get(clientId);
        const record: Participant = previousRecord ? { ...previousRecord, online: true, lastSeen: Date.now() } : { ...emptyProgress(), id: clientId, name: cleanName(data.name), online: true, lastSeen: Date.now() };
        this.records.set(clientId, record);
        send(connection, { type: 'welcome', review: this.reviewState(), progress: cloneProgress(record) });
        this.emit(); return;
      }
      if (this.connections.get(clientId) !== connection) return;
      const person = this.records.get(clientId)!;
      person.lastSeen = Date.now();
      if (!person.online) { person.online = true; this.emit(); }
      if (data.type === 'ping') { send(connection, { type: 'pong' }); return; }
      if (data.type === 'pong') return;
      if (data.type === 'leave') { connection.close(); return; }
      if (data.type === 'update') {
        const value = validateProgress(data.progress, questionData);
        if (!value) return;
        if (this.snapshot.phase === 'practice' && value.revision > person.revision) {
          this.records.set(clientId, { ...person, ...value }); this.emit();
        }
        const stored = this.records.get(clientId)!;
        send(connection, { type: 'ack', progress: cloneProgress(stored), review: this.reviewState() });
      }
    });
    const disconnected = () => {
      clearTimeout(this.joinTimers.get(connection)); this.joinTimers.delete(connection); this.pending.delete(connection);
      if (this.closed || !clientId || this.connections.get(clientId) !== connection) return;
      this.connections.delete(clientId);
      const record = this.records.get(clientId); if (record) record.online = false;
      this.emit();
    };
    connection.on('close', disconnected); connection.on('error', () => { connection.close(); disconnected(); });
  }
  private reviewState(): Review { const { phase, question, revealed } = this.snapshot; return { phase, question, revealed }; }
  private broadcastReview() {
    for (const [id, connection] of this.connections) send(connection, { type: 'review', review: this.reviewState(), progress: cloneProgress(this.records.get(id)!) });
    this.emit();
  }
  review(question: number, revealed: boolean) {
    if (!this.snapshot.active || this.closed || !questionData.some(q => q.n === question)) return;
    this.snapshot = { ...this.snapshot, phase: 'review', question, revealed }; this.broadcastReview();
  }
  resume() { if (!this.closed) { this.snapshot = { ...this.snapshot, phase: 'practice', revealed: false }; this.broadcastReview(); } }
  private tick() {
    if (this.closed) return;
    if (Date.now() - this.startedAt > MAX_SESSION_MS) { this.close(); return; }
    if (this.peer?.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch { /* Next heartbeat retries. */ } }
    let stale = false;
    for (const [id, connection] of this.connections) {
      const record = this.records.get(id)!;
      if (Date.now() - record.lastSeen > STALE_MS) { record.online = false; this.connections.delete(id); connection.close(); stale = true; }
      else send(connection, { type: 'ping' });
    }
    if (stale) this.emit();
  }
  close(immediate = false) {
    if (this.closed) return;
    this.closed = true; ++this.epoch;
    clearTimeout(this.startTimer); clearInterval(this.heartbeat);
    for (const timer of this.joinTimers.values()) clearTimeout(timer); this.joinTimers.clear();
    const connections = [...this.connections.values(), ...this.pending];
    for (const connection of connections) send(connection, { type: 'closed' });
    this.records.clear(); this.connections.clear(); this.pending.clear();
    this.snapshot = emptyHost(); this.emit();
    const peer = this.peer; this.peer = undefined;
    const dispose = () => { for (const c of connections) c.close(); peer?.destroy(); };
    // Let the reliable channel deliver the close message before destroying it.
    if (immediate) dispose(); else setTimeout(dispose, 1000);
  }
}

export class LearnerSession {
  private snapshot: GuestSnapshot = emptyGuest();
  private peer?: PeerLike;
  private connection?: Connection;
  private clientId: string = newClientId();
  private timer?: ReturnType<typeof setInterval>;
  private attemptAt = 0;
  private lastSeen = 0;
  private startedAt = 0;
  private disposed = false;
  private welcomed = false;
  private epoch = 0;
  constructor(private code: string, private changed: (value: GuestSnapshot) => void, private factory: PeerFactory = peerFactory) {}
  private emit() { this.changed({ ...this.snapshot, progress: cloneProgress(this.snapshot.progress) }); }
  async start(name: string) {
    if (!normalizeCode(this.code) || !cleanName(name) || this.disposed || this.snapshot.status !== 'idle') return;
    this.snapshot = { ...emptyGuest(), status: 'connecting', name: cleanName(name) };
    this.startedAt = this.lastSeen = Date.now(); this.emit();
    this.timer = setInterval(() => this.tick(), HEARTBEAT_MS);
    await this.createPeer();
  }
  private async createPeer() {
    const epoch = ++this.epoch;
    try {
      const peer = await this.factory();
      if (this.disposed || epoch !== this.epoch) { peer.destroy(); return; }
      this.peer = peer;
      peer.on('open', () => this.connect());
      peer.on('disconnected', () => { /* Existing data channels work independently of signaling. */ });
      peer.on('error', () => {
        if (this.disposed) return;
        if (!this.connection?.open) { this.snapshot.status = 'reconnecting'; this.snapshot.error = 'Geen verbinding met de trainer. We proberen opnieuw; houd dit scherm open.'; this.emit(); }
      });
    } catch { if (!this.disposed) { this.snapshot.status = 'reconnecting'; this.snapshot.error = networkError(); this.emit(); } }
  }
  private connect() {
    if (this.disposed || !this.peer || this.peer.destroyed || this.peer.disconnected) return;
    this.attemptAt = Date.now(); this.welcomed = false;
    let connection: Connection;
    try { connection = this.peer.connect(PEER_PREFIX + normalizeCode(this.code), { reliable: true, serialization: 'json', label: PROTOCOL }); }
    catch { return; }
    const previous = this.connection; this.connection = connection; previous?.close();
    connection.on('open', () => { if (this.connection === connection && !this.disposed) send(connection, { type: 'hello', clientId: this.clientId, name: this.snapshot.name }); });
    connection.on('data', (raw: unknown) => {
      if (this.disposed || this.connection !== connection || !validEnvelope(raw)) return;
      const data = raw as any;
      this.lastSeen = Date.now();
      if (data.type === 'closed') { this.dispose('closed'); return; }
      if (data.type === 'rejected') { this.dispose('error', 'Deze sessie kan geen nieuwe deelnemers ontvangen. Neem contact op met je trainer.'); return; }
      if (data.type === 'ping') { send(connection, { type: 'pong' }); return; }
      if (data.type === 'pong') return;
      if (data.type !== 'welcome' && data.type !== 'ack' && data.type !== 'review') return;
      const progress = validateProgress(data.progress, questionData);
      const review = data.review;
      if (!progress || !review || !['practice', 'review'].includes(review.phase) || !questionData.some(q => q.n === review.question) || typeof review.revealed !== 'boolean') return;
      if (review.phase === 'review' || progress.revision > this.snapshot.progress.revision) this.snapshot.progress = progress;
      this.snapshot = { ...this.snapshot, phase: review.phase, question: review.question, revealed: review.revealed, status: 'connected', error: '', acknowledged: progress.revision };
      const first = !this.welcomed; this.welcomed = true; this.emit();
      if (first && review.phase === 'practice') this.flush();
    });
    const disconnected = () => {
      if (this.disposed || this.connection !== connection) return;
      this.welcomed = false; this.snapshot.status = 'reconnecting';
      this.snapshot.error = 'Verbinding onderbroken. Je keuzes blijven tijdelijk op je telefoon en worden na herstel doorgestuurd.'; this.emit();
    };
    connection.on('close', disconnected); connection.on('error', () => { connection.close(); disconnected(); });
  }
  update(value: Omit<Progress, 'revision'>) {
    if (this.disposed || this.snapshot.phase !== 'practice' || !this.welcomed) return;
    const progress = validateProgress({ ...value, revision: this.snapshot.progress.revision + 1 }, questionData);
    if (!progress) return;
    this.snapshot.progress = progress; this.emit(); this.flush();
  }
  private flush() { if (this.connection && this.welcomed) send(this.connection, { type: 'update', progress: cloneProgress(this.snapshot.progress) }); }
  private tick() {
    if (this.disposed) return;
    if (Date.now() - this.lastSeen > LOST_MS || Date.now() - this.startedAt > MAX_SESSION_MS) {
      this.dispose('error', 'De trainer is niet meer bereikbaar. Deze deelname is afgesloten en je tijdelijke gegevens zijn gewist. Vraag je trainer om een nieuwe sessie-QR.'); return;
    }
    if (this.peer?.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch { /* Retry next heartbeat. */ } }
    if (!this.peer || this.peer.destroyed) { void this.createPeer(); return; }
    if (this.connection?.open && this.welcomed) {
      if (Date.now() - this.lastSeen > STALE_MS) { this.connection.close(); return; }
      send(this.connection, { type: 'ping' });
      if (this.snapshot.acknowledged !== this.snapshot.progress.revision) this.flush();
    } else if (Date.now() - this.attemptAt > 30000) this.connect();
  }
  dispose(status: 'idle' | 'closed' | 'error' = 'idle', error = '') {
    if (this.disposed) return;
    this.disposed = true; ++this.epoch; clearInterval(this.timer);
    if (this.connection) send(this.connection, { type: 'leave' });
    this.connection?.close(); this.peer?.destroy();
    this.connection = undefined; this.peer = undefined; this.clientId = ''; this.code = ''; this.welcomed = false;
    this.snapshot = { ...emptyGuest(), status, error }; this.emit();
  }
}

