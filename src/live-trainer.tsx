import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowRight, Copy, Download, Eye, EyeOff, Play, Trash2, Users, Wifi, WifiOff } from 'lucide-react';
import questions from './questions.json';
import { formatCode, joinUrl, questionStats } from './live-protocol.mjs';
import { isCorrect } from './quiz-core.mjs';
import type { Participant } from './live-session';
import type { useTrainerSession } from './live-hooks';
type Question = typeof questions[number];
const letters = 'ABCDEF';
function choices(mask: number | undefined) { return mask ? [...letters].filter((_, i) => mask & (1 << i)).join(', ') : '—'; }

export function QuestionStats({ q, participants, revealed }: { q: Question; participants: Participant[]; revealed: boolean }) {
  const stats = questionStats(q, participants);
  const good = participants.filter(p => isCorrect(q, p.answers[q.n])).length;
  return <div className="live-question-stats"><div><h3>Antwoorden uit de groep</h3><p>{stats.received} van {participants.length} deelnemers hebben deze vraag beantwoord.{revealed && stats.received > 0 && <> <strong>{good} goed ({Math.round(good / stats.received * 100)}%).</strong></>}</p></div><div className="distribution">{stats.counts.map((count, i) => <div className={`bar-row ${revealed && q.key.split(',').map(s => s.trim()).includes(letters[i]) ? 'correct' : ''}`} key={i}><span className="bar-letter">{letters[i]}</span><span className="bar-track"><span style={{ display: 'block', height: '100%', width: `${stats.received ? count / stats.received * 100 : 0}%`, background: 'currentColor' }} /></span><span className="bar-value">{count} <small>({stats.received ? Math.round(count / stats.received * 100) : 0}%)</small></span></div>)}</div>{q.multi && <small>Bij deze vraag kan iedere deelnemer meerdere antwoorden kiezen.</small>}</div>;
}

export function TrainerSessionPanel({ live, selected, onSelect, onDiscuss, revealed, onReveal }: { live: ReturnType<typeof useTrainerSession>; selected: number[]; onSelect: (value: number[]) => void; onDiscuss: () => void; revealed: boolean; onReveal: () => void }) {
  const { snapshot, start, close } = live;
  const [qr, setQr] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const closeDialog = useRef<HTMLDialogElement>(null);
  const qrDialog = useRef<HTMLDialogElement>(null);
  const url = snapshot.code ? joinUrl(window.location.href, snapshot.code) : '';
  const online = snapshot.participants.filter(p => p.online).length;
  const finished = snapshot.participants.filter(p => p.finished).length;
  useEffect(() => {
    let cancelled = false; setQr('');
    if (url) QRCode.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#00285b', light: '#ffffff' } }).then(data => { if (!cancelled) setQr(data); }).catch(() => { if (!cancelled) setCopyStatus('Gebruik de sessiecode of deelnamelink.'); });
    return () => { cancelled = true; };
  }, [url]);
  async function copy() { try { await navigator.clipboard.writeText(url); setCopyStatus('Deelnamelink gekopieerd.'); } catch { setCopyStatus(url); } }
  if (!snapshot.active) return <section className="live-start overview"><div><p className="eyebrow">LIVE MET DE GROEP</p><h2>Zie wie meedoet en wat de groep antwoordt.</h2><p>Start een sessie en laat deelnemers de QR-code scannen. Namen en antwoorden blijven tijdelijk in dit trainersscherm.</p><p className="muted">Houd deze pagina open. Sluit de sessie na de les af met de wisknop.</p></div><button className="btn primary" onClick={start}><Play size={19} /> Start groepssessie</button></section>;
  return <>
    <section className="live-room" aria-label="Groepssessie">
      <div className="live-room-top"><div className="live-connection"><span className={snapshot.status === 'ready' ? 'status-dot ready' : 'status-dot'} />{snapshot.status === 'ready' ? <><Wifi size={17} /> Groepssessie actief</> : snapshot.status === 'connecting' ? 'Verbinding maken…' : <><WifiOff size={17} /> Verbinding herstellen</>}</div><button className="btn live-delete" onClick={() => closeDialog.current?.showModal()}><Trash2 size={17} /> Sessie afsluiten en wissen</button></div>
      {snapshot.error && <p className="live-warning" role="alert">{snapshot.error}</p>}
      <div className="live-room-grid"><button className="live-qr" aria-label="Toon de sessie-QR groot op het scherm" onClick={() => qrDialog.current?.showModal()}>{qr && <img src={qr} alt="Scan deze QR-code om mee te doen aan deze groepssessie" />}</button><div className="live-invite"><p className="eyebrow">SCAN DE QR OF VUL DE SESSIECODE IN</p><p className="live-code">{formatCode(snapshot.code)}</p><p>Deelnemers kiezen <strong>Meedoen met de groep</strong> en vullen hun naam in.</p><div className="inline-actions"><button className="text-btn" onClick={copy}><Copy size={16} /> Deelnamelink kopiëren</button>{qr && <a className="text-btn" download="VCH-Bulk-sessie-QR.png" href={qr}><Download size={16} /> QR downloaden</a>}</div><p className="live-copy-status" role="status">{copyStatus}</p></div><div className="live-metrics"><div><strong>{online}</strong><span>nu verbonden</span></div><div><strong>{snapshot.participants.length}</strong><span>deelnemers</span></div><div><strong>{finished}</strong><span>klaar met oefenen</span></div></div></div>
      <p className="live-room-note">{snapshot.phase === 'review' ? 'Nabespreking actief: deelnemers volgen de vraag en de antwoordknop van de trainer.' : 'Deelnemers oefenen op hun eigen tempo. U ziet hun opgeslagen keuzes direct.'}</p>
    </section>
    <section className="overview live-overview"><div className="section-heading"><div><p className="eyebrow">LIVE ANTWOORDOVERZICHT</p><h2>Kies wat u wilt bespreken.</h2></div><button className="btn secondary" aria-pressed={revealed} onClick={onReveal}>{revealed ? <EyeOff size={17} /> : <Eye size={17} />}{revealed ? 'Verberg goede antwoorden' : 'Toon goede antwoorden'}</button></div><p className="muted">Groene markeringen en percentages goed zijn standaard verborgen.</p><div className="table-scroll"><table className="live-questions-table"><thead><tr><th scope="col">Selectie</th><th scope="col">Vraag</th><th scope="col">Beantwoord</th><th scope="col">Antwoordverdeling</th>{revealed && <th scope="col">Goed</th>}</tr></thead><tbody>{questions.map(q => {
      const stats = questionStats(q, snapshot.participants);
      const good = snapshot.participants.filter(p => isCorrect(q, p.answers[q.n])).length;
      return <tr key={q.n}><td><input type="checkbox" aria-label={`Vraag ${q.n} selecteren`} checked={selected.includes(q.n)} onChange={e => onSelect(e.target.checked ? [...selected, q.n] : selected.filter(n => n !== q.n))} /></td><th scope="row">{q.n}. {q.title}</th><td>{stats.received} / {snapshot.participants.length}</td><td><div className="mini-distribution">{stats.counts.map((count, i) => <div key={i} className={revealed && q.key.split(',').map(s => s.trim()).includes(letters[i]) ? 'key-count' : ''}><span>{letters[i]}</span><b>{count}</b></div>)}</div></td>{revealed && <td>{stats.received ? `${Math.round(good / stats.received * 100)}%` : '—'}</td>}</tr>;
    })}</tbody></table></div><div className="inline-actions live-overview-actions"><button className="btn primary" disabled={!selected.length} onClick={onDiscuss}>Start nabespreking ({selected.length}) <ArrowRight size={18} /></button><button className="text-btn" onClick={() => onSelect(selected.length === 12 ? [] : questions.map(q => q.n))}>{selected.length === 12 ? 'Selectie wissen' : 'Alles selecteren'}</button>{snapshot.phase === 'review' && <button className="btn secondary" onClick={() => live.client.current?.resume()}>Laat de groep verder oefenen</button>}</div></section>
    <details className="participants-panel" open><summary><Users size={18} /> Deelnemers <span>{online} verbonden · {snapshot.participants.length} aangemeld</span></summary>{snapshot.participants.length === 0 ? <p className="muted live-empty">Nog geen deelnemers. Toon de sessie-QR aan de groep.</p> : <div className="table-scroll"><table className="participants-table"><thead><tr><th scope="col">Naam</th><th scope="col">Verbinding</th><th scope="col">Voortgang</th>{questions.map(q => <th scope="col" key={q.n}>V{q.n}</th>)}{revealed && <th scope="col">Goed</th>}</tr></thead><tbody>{snapshot.participants.map(p => <tr key={p.id}><th scope="row">{p.name}</th><td>{p.online ? 'Verbonden' : 'Onderbroken'}</td><td>{Object.keys(p.answers).length}/12{p.finished ? ' · klaar' : ''}</td>{questions.map(q => <td className={revealed && p.answers[q.n] ? isCorrect(q, p.answers[q.n]) ? 'answer-right' : 'answer-wrong' : ''} key={q.n}>{choices(p.answers[q.n])}</td>)}{revealed && <td>{questions.filter(q => isCorrect(q, p.answers[q.n])).length}/12</td>}</tr>)}</tbody></table></div>}</details>
    <dialog ref={qrDialog} className="live-close-dialog live-qr-dialog" aria-labelledby="qr-title"><p className="eyebrow">MEEDOEN MET DE GROEP</p><h2 id="qr-title">Scan de QR en vul je naam in.</h2>{qr && <img src={qr} alt="Deelnemen aan deze groepssessie" />}<p className="live-code">{formatCode(snapshot.code)}</p><p>{online} verbonden · {snapshot.participants.length} aangemeld</p><button className="btn secondary" onClick={() => qrDialog.current?.close()}>Terug naar het overzicht</button></dialog>
    <dialog ref={closeDialog} className="live-close-dialog" aria-labelledby="close-title"><p className="eyebrow">SESSIE BEËINDIGEN</p><h2 id="close-title">Sessie afsluiten en gegevens wissen?</h2><p>De namen en antwoorden verdwijnen uit dit trainersscherm. Verbonden deelnemers krijgen een afsluitmelding en hun tijdelijke gegevens worden gewist.</p><p>Dit kan niet ongedaan worden gemaakt. Een nieuwe sessie krijgt een nieuwe QR-code.</p><div className="modal-actions"><button className="btn secondary" onClick={() => closeDialog.current?.close()}>Terug naar de sessie</button><button className="btn danger" onClick={() => { closeDialog.current?.close(); close(); }}><Trash2 size={18} /> Afsluiten en wissen</button></div></dialog>
  </>;
}

