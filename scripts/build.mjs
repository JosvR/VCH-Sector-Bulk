import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const entry of await readdir('dist')) await rm(`dist/${entry}`, { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public/images', 'dist/images', { recursive: true });
await build({
  entryPoints: ['src/main.tsx'], bundle: true, minify: true, format: 'esm',
  target: ['es2022'], jsx: 'automatic', outfile: 'dist/assets/app.js',
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof',
});
await writeFile('dist/index.html', `<!doctype html>
<html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="Twaalf oefenvragen over veilig werken op een bulkterminal. Zelf oefenen met toelichtingen en samen nabespreken met de trainer."><title>VCH Bulk — samen oefenen</title><link rel="icon" href="./images/vch-logo.png"><link rel="stylesheet" href="./assets/app.css"></head><body><div id="app"></div><noscript>Schakel JavaScript in om de oefenapp te gebruiken.</noscript><script type="module" src="./assets/app.js"></script></body></html>\n`);
console.log('Volledig statische app gereed in dist/. Geen serverfuncties of database nodig.');

