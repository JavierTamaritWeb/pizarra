'use strict';
/* ============================================================
   load-app.js — Arranca js/app.js completo sobre el DOM de dom-stub.js
   y expone gestos de alto nivel (elegir herramienta, arrastrar, borrar…).

   El estado se observa a través del **autosave**: app.js serializa
   `state.elements` en localStorage tras cada cambio, así que `elements()`
   devuelve la escena real sin necesidad de hooks de test en app.js.

     const app = loadApp();
     app.selectTool('fachada');
     app.drag(100, 100, 260, 420);      // dibuja el edificio
     app.elements().length;             // piezas creadas
   ============================================================ */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDom } = require('./dom-stub.js');
const { createCtxStub } = require('./ctx-stub.js');
const { ALL_FILES, PROJECT_ROOT } = require('./load.js');

function loadApp({ prefs, autosave } = {}) {
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
  const dom = createDom({ html });
  if (prefs) dom.localStorage.setItem('sketchwire.prefs', JSON.stringify(prefs));
  if (autosave) dom.localStorage.setItem('sketchwire.autosave', JSON.stringify(autosave));

  // Captura la rAF real del dom ANTES de mezclar: si el sandbox la
  // reexportara delegando en window, Object.assign la haría recursiva.
  const rafImpl = dom.window.requestAnimationFrame;

  const sandbox = {
    console,
    document: dom.document,
    localStorage: dom.localStorage,
    devicePixelRatio: 1,
    requestAnimationFrame: rafImpl,
    cancelAnimationFrame: () => {},
    setTimeout: (fn, ms) => { dom.timers.push({ fn, ms }); return dom.timers.length; },
    clearTimeout: handle => { if (handle) dom.timers.length = 0; },
    alert: msg => { sandbox.alerts.push(String(msg)); },
    alerts: [],
    createCtxStub,
    Image: class { set src(v) { this._src = v; } get src() { return this._src; } },
    Blob: class { constructor(parts = []) { this.parts = parts; } },
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
    FileReader: class { readAsText() {} },
    navigator: { platform: 'MacIntel', userAgent: 'node' },
  };
  sandbox.window = Object.assign(dom.window, sandbox);
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  for (const file of [...ALL_FILES, 'js/app.js']) {
    const abs = path.join(PROJECT_ROOT, file);
    vm.runInContext(fs.readFileSync(abs, 'utf8'), context, { filename: abs });
  }
  dom.flush();

  const $ = id => dom.document.getElementById(id);
  const canvas = $('main-canvas');

  /** Escena actual, leída del autosave (la serialización real de la app). */
  function elements() {
    dom.flush();
    const raw = dom.localStorage.getItem('sketchwire.autosave');
    if (!raw) return [];
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved : (saved.elements || []);
  }

  const pointer = (type, x, y, opts = {}) =>
    canvas.__fire(type, { clientX: x, clientY: y, pointerId: 1, button: 0, ...opts });

  const api = {
    dom,
    context,
    $,
    elements,
    flush: () => dom.flush(),

    /** Pulsa una herramienta del sidebar por su id de TOOLS. */
    selectTool(toolId) {
      const btn = dom.document.querySelectorAll('.sidebar__tool')
        .find(b => b.dataset && b.dataset.tool === toolId);
      if (!btn) throw new Error(`No existe el botón de herramienta "${toolId}"`);
      btn.__fire('click', { target: btn });
      dom.flush();
      return api;
    },

    /** Elige una variante en el modal abierto (Edificios o Jardín).
        El listener de click vive en el <dialog>, no en el botón, así que hay
        que dispararlo ahí con el botón como `target` —igual que haría el
        borboteo real—. El id del modal se deriva del catálogo:
        `planta-catalog` → `modal-planta`, `tree-catalog` → `modal-tree`. */
    pickVariant(catalogId, variantClass, value, datasetKey) {
      const btn = $(catalogId).querySelectorAll(`.${variantClass}`)
        .find(b => b.dataset[datasetKey] === value);
      if (!btn) throw new Error(`No existe la variante "${value}" en #${catalogId}`);
      const modal = $('modal-' + catalogId.replace('-catalog', ''));
      if (!modal || !modal.__listenerCount('click')) {
        throw new Error(`#${catalogId} no tiene un modal con listener de click`);
      }
      modal.__fire('click', { target: btn });
      dom.flush();
      return api;
    },

    /** Arrastre completo: pointerdown → move → up (los move llevan
        `buttons:1`, que es lo que app.js exige para considerarlo arrastre). */
    drag(x1, y1, x2, y2, opts = {}) {
      pointer('pointerdown', x1, y1, opts);
      pointer('pointermove', (x1 + x2) / 2, (y1 + y2) / 2, { buttons: 1, ...opts });
      pointer('pointermove', x2, y2, { buttons: 1, ...opts });
      pointer('pointerup', x2, y2, opts);
      dom.flush();
      return api;
    },

    /** Click simple (sin desplazamiento). */
    click(x, y, opts = {}) {
      pointer('pointerdown', x, y, opts);
      pointer('pointerup', x, y, opts);
      dom.flush();
      return api;
    },

    /** Tecla sobre document (atajos: Delete, ctrl+z…). Devuelve el evento, para
        poder comprobar `defaultPrevented` (los atajos que abren un modal deben
        cancelar la tecla o se la come el control que reciba el foco). */
    key(key, opts = {}) {
      const ev = dom.document.__fire('keydown', {
        key, target: { tagName: 'BODY' },
        ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
        ...opts,
      });
      dom.flush();
      return ev;
    },
  };
  return api;
}

module.exports = { loadApp };
