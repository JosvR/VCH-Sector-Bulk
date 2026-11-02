import { useEffect, useRef, useState } from 'react';
import { Check, X, ZoomIn } from 'lucide-react';
import questionData from './questions.json';
type Question = typeof questionData[number];
const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
const hasKey = (key: string | undefined, letter: string) => !!key?.split(',').map(v => v.trim()).includes(letter);
export default function QuestionView({ q, choice, onChoose, onPending, disabled, revealed, large = false }: { q: Question; choice?: number; onChoose?: (n: number) => void; onPending?: (pending: boolean) => void; disabled?: boolean; revealed?: boolean; large?: boolean }) {
  const [draft, setDraft] = useState(choice || 0);
  const [expandedImage, setExpandedImage] = useState(0);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const imagePaths = q.images || [q.image];
  const isSequence = !!q.captions?.length;
  useEffect(() => { setDraft(choice || 0); }, [q.n, choice]);
  useEffect(() => { imageDialog.current?.close(); }, [q.n]);
  useEffect(() => { onPending?.(q.multi && draft !== (choice || 0)); }, [draft, choice, q.n, q.multi, onPending]);
  const visibleChoice = q.multi && onChoose ? draft : (choice || 0);
  const gallery = <div className={imagePaths.length > 1 ? 'question-gallery' : ''}>{imagePaths.map((src, i) => <figure key={src}><button type="button" className="image-button" aria-label={`Vergroot ${q.captions?.[i] || `afbeelding bij ${q.title}`}`} onClick={() => { setExpandedImage(i); imageDialog.current?.showModal(); }}><img src={src} className="full-image" alt={q.captions?.[i] || `Beeld ${i + 1} bij ${q.title.toLowerCase()}, uit de Bulk-training`} /><span className="image-zoom"><ZoomIn size={16} /> Vergroten</span></button>{q.captions?.[i] && <figcaption>{q.captions[i]}</figcaption>}</figure>)}</div>;
  return <article className={`question-view ${large ? 'large' : ''}`}>
    <div className="question-text"><p className="eyebrow">VRAAG {q.n} VAN 12 <span>· {q.title}</span></p><h2>{q.stem}</h2>
      {isSequence && <div className="sequence-media">{gallery}</div>}
      {q.multi && <p className="multi-hint">Meerdere antwoorden zijn goed.{onChoose && ' Vink alle juiste antwoorden aan. Sla daarna je keuze op.'}</p>}
      <div className="options" role={onChoose ? q.multi ? 'group' : 'radiogroup' : undefined} aria-label="Antwoordmogelijkheden">{q.options.map((option, i) => {
        const isChosen = !!(visibleChoice & (1 << i)), isCorrect = revealed && hasKey(q.key, letters[i]);
        const content = <><span className="option-letter">{letters[i]}</span><span className="option-text">{option}</span><span className="option-mark">{isCorrect ? <Check size={21} aria-label="Juist antwoord" /> : isChosen ? <span className="chosen-dot" /> : null}</span></>;
        const cls = `option ${isChosen ? 'chosen' : ''} ${isCorrect ? 'correct' : ''} ${revealed && isChosen && !isCorrect ? 'incorrect' : ''}`;
        return onChoose ? <button key={i} type="button" role={q.multi ? 'checkbox' : 'radio'} aria-checked={isChosen} className={cls} disabled={disabled} onClick={() => q.multi ? setDraft(v => v ^ (1 << i)) : onChoose(1 << i)}>{content}</button> : <div key={i} className={cls}>{content}</div>;
      })}</div>
      {q.multi && onChoose && <div className="multi-save"><button className="btn primary" disabled={disabled || !draft || draft === choice} onClick={() => onChoose(draft)}><Check size={18} /> Antwoorden opslaan</button><span role="status">{draft === choice ? 'Je keuze is opgeslagen.' : 'Je keuze is nog niet opgeslagen.'}</span>{draft !== (choice || 0) && <button className="text-btn" onClick={() => setDraft(choice || 0)}>Wijziging ongedaan maken</button>}</div>}
      {revealed && q.explain && <div className="answer-explanation"><p><Check size={19} /> Juist antwoord: {q.key}</p><div>{q.explain}</div></div>}
    </div>
    <aside className="question-media">{!isSequence && gallery}</aside>
    <dialog ref={imageDialog} className="image-dialog" aria-label={q.captions?.[expandedImage] || `Afbeelding bij ${q.title}`} onKeyDown={e => e.stopPropagation()} onClick={e => { if (e.target === e.currentTarget) imageDialog.current?.close(); }}><button className="image-dialog-close btn secondary" onClick={() => imageDialog.current?.close()}><X size={20} /> Sluiten</button><img src={imagePaths[expandedImage] || imagePaths[0]} alt={q.captions?.[expandedImage] || q.title} />{q.captions?.[expandedImage] && <p>{q.captions[expandedImage]}</p>}</dialog>
  </article>;
}


