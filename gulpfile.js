'use strict';

/* gulpfile.js — dos cometidos, y solo dos:
     1. Compilar src/scss/ → css/styles.css (artefacto que SÍ va commiteado,
        expandido y con comentarios, para que «clonar y abrir index.html» siga
        funcionando sin instalar nada).
     2. Ensamblar dist/ con lo publicable: LICENSE tal cual, index.html con las
        rutas src/js/ aplanadas a js/, el CSS recompilado comprimido y el JS
        minificado con terser.
   Los src/js/*.js no se transforman nunca en el árbol fuente: la app sigue
   sin build en runtime y el harness de tests los lee tal cual (CLAUDE.md). */

const { watch, series } = require('gulp');
const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');
const { minify } = require('terser');

const ENTRY = 'src/scss/main.scss';
const OUT = 'css/styles.css';

/* Publicable = lo que la app necesita en runtime + la licencia (MIT pide
   acompañar el código distribuido). Tests y config de dev se quedan. */
const DIST = 'dist';
const JS_SRC = 'src/js';
const IMG_SRC = 'src/img';

/* Imágenes que viven en src/img/ pero no las necesita la app: el PNG del que
   se derivan todos los iconos y las capturas que ilustran el README. */
const IMG_SKIP = /icon-source-512\.png$|screenshot-/;

function compile() {
  // style: 'expanded' conserva los comentarios /* */ del fuente; dart-sass
  // antepone @charset "UTF-8"; porque el CSS contiene "·" — correcto, no
  // suprimirlo: protege la apertura por file:// y servidores sin charset.
  const result = sass.compile(ENTRY, { style: 'expanded' });
  fs.writeFileSync(OUT, result.css.endsWith('\n') ? result.css : result.css + '\n');
}

function css(done) {
  compile(); // sin try/catch: un error de Sass debe tumbar el build
  done();
}

async function copyDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'css'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
  fs.copyFileSync('LICENSE', path.join(DIST, 'LICENSE'));
  // Las fuentes autoalojadas (OpenDyslexic) viajan tal cual: css/ las
  // referencia como ../fonts/, que resuelve igual en la raíz y en dist/.
  fs.cpSync('fonts', path.join(DIST, 'fonts'), { recursive: true });

  // Iconos: como los scripts, viven en src/ durante el desarrollo y en el
  // publicable van planos (dist/img/). El manifiesto viaja con ellos.
  fs.cpSync(IMG_SRC, path.join(DIST, 'img'), {
    recursive: true,
    filter: src => fs.statSync(src).isDirectory() || !IMG_SKIP.test(src),
  });
  const manifest = fs.readFileSync('site.webmanifest', 'utf8');
  fs.writeFileSync(path.join(DIST, 'site.webmanifest'), manifest.replaceAll('src/img/', 'img/'));

  // El publicable es plano: scripts en dist/js/ e imágenes en dist/img/, así
  // que las rutas src/ del index de desarrollo se aplanan. Es la única
  // transformación que sufre el HTML.
  const html = fs.readFileSync('index.html', 'utf8');
  fs.writeFileSync(path.join(DIST, 'index.html'),
    html.replaceAll('src="src/js/', 'src="js/').replaceAll('src/img/', 'img/'));

  // CSS de publicación: la misma fuente, comprimida.
  const min = sass.compile(ENTRY, { style: 'compressed' });
  fs.writeFileSync(path.join(DIST, OUT), min.css);

  // JS minificado conservando nombre de fichero (index.html los referencia
  // por nombre). Nada de mangle de nivel superior: cada <script> expone sus
  // globals (TOOLS, Sketchy, …) como bindings top-level que los siguientes
  // scripts consumen — renombrarlos rompería la app publicada.
  for (const file of fs.readdirSync(JS_SRC).filter(f => f.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(JS_SRC, file), 'utf8');
    const res = await minify(code, { mangle: true, compress: true });
    fs.writeFileSync(path.join(DIST, 'js', file), res.code);
  }
  console.log(`[dist] ${DIST}/ regenerado (index.html, LICENSE, iconos, css/ y js/ minificados)`);
}

function watchScss() {
  return watch('src/scss/**/*.scss', { ignoreInitial: false }, function rebuild(done) {
    try {
      compile();
      console.log(`[sass] ${OUT} actualizado`);
    } catch (err) {
      console.error(err.message); // el watcher sobrevive al error de sintaxis
    }
    done();
  });
}

exports.css = css;
exports.dist = series(css, copyDist);
exports.build = series(css, copyDist);
exports.watch = watchScss;
exports.default = watchScss;
