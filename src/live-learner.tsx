import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import questions from './questions.json';
import QuestionView from './question-view';
import { LearnerSession, emptyGuest } from './live-session';
import { normalizeCode, readRoomCode, formatCode } from './live-protocol.mjs';

export default function LiveLearner({ onHome }: { onHome: () => void }) {
  const [code, setCode] = useState(() => readRoomCode(window.location.href));
  const [name, setName] = useState('');
  const [snapshot, setSnapshot] = useState(emptyGuest);
  const [pending, setPending] = useState(false);
  const [validation, setValidation] = useState('');
  const client = useRef<LearnerSession | null>(null);
  const active = !['idle', 'closed', 'error'].includes(snapshot.status);
  useEffect(() => {
    const pageHide = () => client.current?.dispose();
    window.addEventListener('pagehide', pageHide);
    return () => { window.removeEventListener('pagehide', pageHide); client.current?.dispose(); };
  }, []);
  useEffect(() => {
    if (snapshot.status === 'closed' || snapshot.status === 'error') {
      setName(''); setCode(''); setPending(false);
      const url = new URL(window.location.href); url.hash = ''; url.search = '?join=1'; window.history.replaceState({}, '', url);
    }
  }, [snapshot.status]);
  useEffect(() => { if (snapshot.phase === 'review') setPending(false); }, [snapshot.phase]);
  const progress = snapshot.progress;
  const answered = Object.keys(progress.answers).length;
  const synced = snapshot.acknowledged === progress.revision;
  const connected = snapshot.status === 'connected';
  const q = questions[(snapshot.phase === 'review' ? snapshot.question : progress.current) - 1];
  function join(event: React.FormEvent) {
    event.preventDefault();
    const validCode = normalizeCode(code);
    if (!validCode) { setValidation('Vul de 12 tekens van de sessiecode in, of scan de QR van de trainer.'); return; }
    if (!name.trim()) { setValidation('Vul je voornaam of een herkenbare roepnaam in.'); return; }
    setValidation('');
    client.current = new LearnerSession(validCode, setSnapshot);
    setCode(validCode);
    const url = new URL(window.location.href); url.hash = `sessie=${validCode}`; window.history.replaceState({}, '', url);
    void client.current.start(name);
  }
  function choose(choice: number) { client.current?.update({ ...progress, answers: { ...progress.answers, [progress.current]: choice } }); setPending(false); }
  function navigate(current: number) { if (!pending) client.current?.update({ ...progress, current }); }
  function leave() { client.current?.dispose(); setName(''); setPending(false); onHome(); }
  if (snapshot.status === 'closed' || snapshot.status === 'error') return <section className="closed-screen"><div className="closed-icon"><ShieldCheck size={38} /></div><p className="eyebrow">GROEPSSESSIE</p><h1>{snapshot.status === 'closed' ? 'De sessie is afgesloten.' : 'Deelname afgesloten.'}</h1><p>{snapshot.status === 'closed' ? 'De trainer heeft de sessie beëindigd. Je naam en antwoorden zijn uit deze app gewist.' : snapshot.error}</p><button className="btn primary" onClick={onHome}>Naar de startpagina</button></section>;
  if (!active) return <section className="entry-layout"><div className="entry-copy"><p className="eyebrow">OEFENEN MET DE GROEP</p><h1>Doe mee met je trainer.</h1><p>Scan de QR-code op het trainersscherm of vul de sessiecode in. Je trainer ziet je voortgang en antwoorden.</p><p>Na de les sluit de trainer de sessie af en worden de tijdelijke gegevens gewist.</p></div><form className="entry-form live-join-form" onSubmit={join}><label htmlFor="session-code">Sessiecode</label><input id="session-code" value={code} maxLength={18} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCD - EFGH - 2345" onChange={e => setCode(e.target.value)} required /><label htmlFor="participant-name">Je naam</label><input id="participant-name" value={name} maxLength={40} autoComplete="off" placeholder="Voornaam of roepnaam" onChange={e => setName(e.target.value)} required />{validation && <p className="live-form-error" role="alert">{validation}</p>}<button className="btn primary" type="submit">Meedoen <ArrowRight size={19} /></button><p className="muted">Geen account nodig. Houd deze pagina tijdens de les open.</p></form></section>;
  return <div className="participant-page live-participant"><div className={`live-learner-status ${connected ? 'connected' : ''}`} role="status">{connected ? <Wifi size={18} /> : <WifiOff size={18} />}<div><strong>{connected ? synced ? 'Verbonden met de trainer' : 'Antwoord wordt verstuurd…' : 'Verbinding maken met de trainer…'}</strong><span>{connected ? `${snapshot.name} · sessie ${formatCode(code)}` : snapshot.error || 'Even geduld. Je hoeft deze pagina niet te vernieuwen.'}</span></div></div>
    {snapshot.phase === 'review' ? <><div className="participant-top"><div><p className="eyebrow">SAMEN NABESPREKEN</p><h1>Volg de vraag van je trainer.</h1></div></div><QuestionView key={`review-${q.n}`} q={q} choice={progress.answers[q.n]} revealed={snapshot.revealed} /><p className="static-privacy">De trainer kiest de volgende vraag en toont de goede antwoorden.</p></> : progress.finished ? <section className="live-waiting"><div className="closed-icon"><Check size={38} /></div><p className="eyebrow">TWAALF VRAGEN BEANTWOORD</p><h1>{synced ? 'Je trainer heeft je antwoorden ontvangen.' : 'Je antwoorden worden nog verstuurd.'}</h1><p>Houd dit scherm open. Je trainer bespreekt de vragen straks met de groep.</p><button className="btn secondary" disabled={!connected} onClick={() => client.current?.update({ ...progress, finished: false })}>Mijn antwoorden bekijken of aanpassen</button></section> : <>
      <div className="participant-top"><div><p className="eyebrow">OEFENEN MET DE GROEP</p><h1>Wat doe jij in deze situatie?</h1></div><span className="participant-progress"><Check size={17} />{answered} van 12 beantwoord</span></div>
      <nav className="question-nav" aria-label="Kies een vraag">{questions.map(question => <button key={question.n} className={`${progress.current === question.n ? 'active' : ''} ${progress.answers[question.n] ? 'answered' : ''}`} aria-label={`Vraag ${question.n}${progress.answers[question.n] ? ', beantwoord' : ''}`} aria-current={progress.current === question.n ? 'step' : undefined} disabled={pending || !connected} onClick={() => navigate(question.n)}>{question.n}{!!progress.answers[question.n] && <Check size={12} />}</button>)}</nav>
      <QuestionView key={q.n} q={q} choice={progress.answers[q.n]} onChoose={choose} onPending={setPending} disabled={!connected} />
      <div className="question-bottom"><button className="btn secondary" disabled={pending || q.n === 1 || !connected} onClick={() => navigate(q.n - 1)}><ChevronLeft size={18} /> Vorige</button><span role="status">{pending ? 'Sla je gewijzigde keuzes op.' : !connected ? 'Wacht op verbinding met je trainer.' : synced && progress.answers[q.n] ? 'Keuze ontvangen door de trainer.' : !synced ? 'Wijziging wordt verstuurd…' : q.multi ? 'Vink je keuzes aan en sla ze op.' : 'Kies één antwoord.'}</span>{q.n < 12 ? <button className="btn primary" disabled={pending || !progress.answers[q.n] || !connected} onClick={() => navigate(q.n + 1)}>Volgende <ChevronRight size={18} /></button> : <button className="btn primary" disabled={pending || answered < 12 || !connected} onClick={() => client.current?.update({ ...progress, finished: true })}>Ik ben klaar <Check size={18} /></button>}</div>
      {answered === 12 && q.n !== 12 && <div className="finish-row"><button className="btn primary" disabled={pending || !connected} onClick={() => client.current?.update({ ...progress, finished: true })}>Ik ben klaar <Check size={18} /></button></div>}
    </>}
    <p className="static-privacy"><ShieldCheck size={17} />Je naam en antwoorden blijven tijdelijk tijdens deze sessie. Er wordt geen bestand of database met resultaten aangemaakt.</p><button className="text-btn live-leave" onClick={leave}>Groepssessie verlaten</button>
  </div>;
}

