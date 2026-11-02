import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
assert.equal(dependencies.some(name => /@netlify\/(database|functions|blobs|neon)|pglite|wrangler|cloudflare|^next$|^vinext$/.test(name)), false, 'Een database- of serverpakket is toegevoegd.');
for (const folder of ['server', 'netlify/functions', 'netlify/database', 'netlify/edge-functions', 'functions']) {
  const exists = await access(folder).then(() => true, () => false);
  assert.equal(exists, false, `${folder} hoort niet in de statische app.`);
}
const settings = await readFile('netlify.toml', 'utf8');
assert.match(settings, /command\s*=\s*""/);
assert.match(settings, /publish\s*=\s*"dist"/);
assert.doesNotMatch(settings, /\[functions|\[plugins|\[\[plugins/);
const source = await readFile('src/learning-app.tsx', 'utf8');
assert.doesNotMatch(source, /\/api\/|XMLHttpRequest|sendBeacon|new WebSocket|new EventSource/);
for (const file of ['src/live-session.ts', 'src/live-protocol.mjs', 'src/live-hooks.ts', 'src/live-learner.tsx', 'src/live-trainer.tsx']) {
  const text = await readFile(file, 'utf8');
  assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB|sendBeacon|\/\.netlify\/functions|\/api\//, `${file}: live groepsgegevens mogen niet permanent worden opgeslagen.`);
}
assert.equal(pkg.dependencies.peerjs, '1.5.5');
const html = await readFile('dist/index.html', 'utf8');
for (const match of html.matchAll(/(?:href|src)="(\.[^"]+)"/g)) await access(resolve('dist', match[1]));
const questions = JSON.parse(await readFile('src/questions.json', 'utf8'));
for (const q of questions) for (const url of q.images) {
  assert.ok(url.startsWith('./images/'), 'Een afbeeldingpad is niet relatief.');
  await access(resolve('dist', url));
  const bytes = await readFile(resolve('dist', url));
  assert.ok(bytes.length > 100, `Afbeelding is leeg of beschadigd: ${url}`);
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', `Geen geldige WebP: ${url}`);
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', `Geen geldige WebP: ${url}`);
}
console.log('Geslaagd: statische Netlify-publicatie, tijdelijke WebRTC-groepsgegevens, geen eigen server of database, alle bestanden en afbeeldingen.');

