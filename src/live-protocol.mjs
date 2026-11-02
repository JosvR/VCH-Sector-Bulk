export const PROTOCOL = 'vch-bulk-live-1';
export const PEER_PREFIX = 'vch-bulk-v4-';
export const HEARTBEAT_MS = 5000;
export const STALE_MS = 25000;
export const LOST_MS = 60000;
export const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
export const MAX_PARTICIPANTS = 80;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newClientId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newRoomCode() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(n => ALPHABET[n % ALPHABET.length]).join('');
}
/** @param {unknown} value */
export function normalizeCode(value) {
  if (typeof value !== 'string') return '';
  const code = value.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-HJ-NP-Z2-9]{12}$/.test(code) ? code : '';
}
/** @param {string} url */
export function readRoomCode(url) {
  const parsed = new URL(url);
  return normalizeCode(new URLSearchParams(parsed.hash.slice(1)).get('sessie') || parsed.searchParams.get('session'));
}
/** @param {string} code */
export function formatCode(code) { return code.match(/.{1,4}/g)?.join(' - ') || ''; }
/** @param {string} base @param {string} code */
export function joinUrl(base, code) {
  const url = new URL(base); url.search = '?join=1'; url.hash = `sessie=${normalizeCode(code)}`;
  return url.href;
}
/** @param {unknown} value */
export function cleanName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 40) : '';
}
/** @param {unknown} data */
export function validEnvelope(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  try { return JSON.stringify(data).length <= 8000 && /** @type {any} */ (data).protocol === PROTOCOL; }
  catch { return false; }
}
/** @param {any} value @param {{n:number,multi:boolean,options:string[]}[]} questions */
export function validateProgress(value, questions) {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > 1000000) return null;
  if (!Number.isInteger(value.current) || value.current < 1 || value.current > questions.length) return null;
  if (!value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return null;
  if (typeof value.finished !== 'boolean' || Object.keys(value.answers).length > questions.length) return null;
  const answers = /** @type {Record<number,number>} */ ({});
  for (const [n, mask] of Object.entries(value.answers)) {
    const q = questions.find(q => String(q.n) === n);
    if (!q || !Number.isInteger(mask) || /** @type {number} */ (mask) <= 0 || /** @type {number} */ (mask) >= 1 << q.options.length) return null;
    const bits = /** @type {number} */ (mask);
    if (!q.multi && (bits & (bits - 1)) !== 0) return null;
    answers[q.n] = bits;
  }
  if (value.finished && Object.keys(answers).length !== questions.length) return null;
  return { answers, revision: value.revision, current: value.current, finished: value.finished };
}
/** @param {{n:number,options:string[]} } q @param {{answers:Record<number,number>}[]} participants */
export function questionStats(q, participants) {
  const received = participants.filter(p => !!p.answers[q.n]);
  return { received: received.length, counts: q.options.map((_, i) => received.filter(p => p.answers[q.n] & (1 << i)).length) };
}

