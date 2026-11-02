export const STORAGE_KEY = 'vch-bulk-static-v1';
export const MAX_AGE = 8 * 60 * 60 * 1000;
/** @param {string} key */
export function answerMask(key) {
  return key.split(',').reduce((mask, letter) => mask | (1 << (letter.trim().charCodeAt(0) - 65)), 0);
}
/** @param {{key:string}} question @param {number|undefined} choice */
export function isCorrect(question, choice) { return choice === answerMask(question.key); }
/** @param {{n:number,key:string}[]} questions @param {Record<number,number>} answers */
export function score(questions, answers) {
  const answered = questions.filter(q => !!answers[q.n]).length;
  const correct = questions.filter(q => isCorrect(q, answers[q.n])).length;
  return { answered, correct, total: questions.length };
}
/** @param {string|null} raw @param {{n:number,multi:boolean,options:string[]}[]} questions @param {number} [now] */
export function restore(raw, questions, now = Date.now()) {
  const fresh = () => ({ startedAt: now, answers: /** @type {Record<number,number>} */ ({}), current: 1, finished: false });
  if (!raw) return fresh();
  try {
    const value = JSON.parse(raw);
    if (!Number.isFinite(value.startedAt) || now - value.startedAt > MAX_AGE || value.startedAt > now) return fresh();
    const answers = /** @type {Record<number,number>} */ ({});
    for (const q of questions) {
      const mask = value.answers?.[q.n];
      if (Number.isInteger(mask) && mask > 0 && mask < (1 << q.options.length) && (q.multi || (mask & (mask - 1)) === 0)) answers[q.n] = mask;
    }
    const current = Number.isInteger(value.current) && value.current >= 1 && value.current <= questions.length ? value.current : 1;
    return { startedAt: value.startedAt, answers, current, finished: value.finished === true && Object.keys(answers).length === questions.length };
  } catch { return fresh(); }
}

