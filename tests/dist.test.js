'use strict';
/* ============================================================
   dist.test.js — El publicable (dist/) sale entero y con las rutas
   aplanadas. dist/ es un artefacto local gitignorado, así que estos
   tests solo corren si existe (`npm run build` primero): el skip es
   explícito para que se VEA que no corrieron, en vez de un verde
   engañoso. Auditoría 2026-08-08: ningún test cubría dist/ y el
   aplanado de rutas del gulpfile no se verificaba en ningún sitio.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const skip = fs.existsSync(path.join(dist, 'index.html'))
  ? false
  : 'no hay dist/: ejecuta `npm run build` para cubrir el publicable';

test('dist/index.html sale con las rutas aplanadas, sin restos de src/', { skip }, () => {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.ok(!html.includes('src/js/'), 'ninguna ruta src/js/ sin aplanar');
  assert.ok(!html.includes('src/img/'), 'ninguna ruta src/img/ sin aplanar');
  assert.match(html, /src="js\/app\.js\?v=/, 'los scripts apuntan a js/');
  assert.match(html, /href="css\/styles\.css\?v=/, 'el CSS conserva su ruta');
});

test('dist/ lleva los mismos scripts que src/js/, css, fuentes, iconos y licencias', { skip }, () => {
  const js = fs.readdirSync(path.join(dist, 'js')).filter(f => f.endsWith('.js')).sort();
  const srcJs = fs.readdirSync(path.join(root, 'src', 'js')).filter(f => f.endsWith('.js')).sort();
  assert.deepEqual(js, srcJs, 'mismos nombres de script que src/js/');
  for (const f of [
    'css/styles.css', 'LICENSE', 'LICENSE.es.txt', 'site.webmanifest',
    'fonts/OpenDyslexic-Regular.woff2', 'fonts/OpenDyslexic-Bold.woff2',
  ]) {
    assert.ok(fs.existsSync(path.join(dist, f)), `falta dist/${f}`);
  }
  const manifest = fs.readFileSync(path.join(dist, 'site.webmanifest'), 'utf8');
  assert.ok(!manifest.includes('src/img/'), 'el manifest sale re-escrito a img/');
  assert.ok(!fs.readdirSync(path.join(dist, 'img')).some(f => /^screenshot-|^icon-source-/.test(f)),
    'las capturas del README y el PNG origen no se publican (IMG_SKIP)');
});

// v2.23.0: `dist/` se había quedado en la v2.22.1 y la app abierta desde ahí
// era, entera y funcionando, OTRA versión de la app: la herramienta recién
// añadida no estaba en el sidebar y nada en pantalla lo insinuaba. No se
// regenera solo y está gitignorado, así que puede quedarse atrás
// indefinidamente (ver BUGS.md). El skip compartido lo deja pasar cuando no
// hay build local, que es un estado legítimo.
test('dist/ es de la versión que dice package.json', { skip }, () => {
  const { version } = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

  const otras = [...new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1]))]
    .filter(v => v !== version);
  assert.deepEqual(otras, [],
    `dist/ es de otra versión (${otras.join(', ')} ≠ ${version}): ejecuta npm run build`);
  assert.ok(html.includes(`topbar__badge">v${version}<`),
    `la chapa de dist/ no dice v${version}`);
});
