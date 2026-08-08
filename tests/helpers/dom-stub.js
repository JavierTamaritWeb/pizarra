'use strict';
/* ============================================================
   dom-stub.js — DOM mínimo pero suficiente para ejecutar src/js/app.js
   dentro de node:vm, que hasta ahora quedaba fuera del arnés (ver
   PLAN.md §6 y la sección "Solo verificables manualmente" de BUGS.md).

   No requiere ningún hook de test en producción: la observabilidad sale
   del **autosave**, que serializa `state.elements` en localStorage. Los
   tests ejecutan gestos reales (pointerdown/move/up, clicks, teclado) y
   leen el resultado con `elements()`.

   `requestAnimationFrame` y `setTimeout` se encolan y se vacían con
   `flush()`, para que cada gesto termine de forma determinista.
   ============================================================ */

const { createCtxStub } = require('./ctx-stub.js');

/** Selector muy simple: soporta `.clase`, `#id`, `tag` y listas separadas
    por comas. Suficiente para los querySelector que hace app.js. */
function matches(el, selector) {
  return selector.split(',').map(s => s.trim()).filter(Boolean).some(sel => {
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return el.tagName === sel.toUpperCase();
  });
}

function descendants(el, out = []) {
  for (const child of el.children) {
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function createElementStub(tag, doc) {
  const tagName = String(tag).toUpperCase();
  const listeners = new Map();
  const classes = new Set();
  const attrs = {};
  const children = [];

  const el = {
    tagName,
    children,
    parentNode: null,
    id: '',
    value: '',
    textContent: '',
    hidden: false,
    disabled: false,
    checked: false,
    open: false,
    width: 0,
    height: 0,
    clientWidth: 1200,
    clientHeight: 800,
    scrollLeft: 0,
    scrollTop: 0,
    style: {},
    dataset: {},
    files: [],

    /* — eventos — */
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type);
      if (list) listeners.set(type, list.filter(f => f !== fn));
    },
    /** Dispara los listeners de `type` con el evento dado (helper de test). */
    __fire(type, event = {}) {
      const ev = {
        type, target: el, currentTarget: el,
        preventDefault() { ev.defaultPrevented = true; },
        stopPropagation() { ev.propagationStopped = true; },
        ...event,
      };
      if (!ev.target.closest) ev.target.closest = sel => closestFrom(ev.target, sel);
      for (const fn of [...(listeners.get(type) || [])]) fn(ev);
      return ev;
    },
    __listenerCount(type) { return (listeners.get(type) || []).length; },

    /* — árbol — */
    appendChild(child) {
      children.push(child);
      child.parentNode = el;
      return child;
    },
    removeChild(child) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    remove() { if (el.parentNode) el.parentNode.removeChild(el); },
    querySelector(sel) { return descendants(el).find(c => matches(c, sel)) || null; },
    querySelectorAll(sel) { return descendants(el).filter(c => matches(c, sel)); },
    closest(sel) { return closestFrom(el, sel); },

    /* — atributos — */
    setAttribute(k, v) { attrs[k] = String(v); if (k === 'id') el.id = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    hasAttribute(k) { return k in attrs; },

    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
    },

    /* — varios que app.js toca — */
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: el.clientWidth, bottom: el.clientHeight,
      width: el.clientWidth, height: el.clientHeight, x: 0, y: 0,
    }),
    focus() { doc.activeElement = el; },
    blur() { if (doc.activeElement === el) doc.activeElement = null; },
    click() { el.__fire('click'); },
    showModal() { el.open = true; },
    close() { el.open = false; el.__fire('close'); },
    select() {},
    setSelectionRange() {},
    setPointerCapture(id) { el.__captured = id; },
    releasePointerCapture() { el.__captured = null; },
    hasPointerCapture(id) { return el.__captured === id; },
    scrollIntoView() {},
    toDataURL: () => 'data:image/png;base64,stub',
  };

  Object.defineProperty(el, 'className', {
    get() { return [...classes].join(' '); },
    set(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
  });

  // innerHTML: app.js solo lo usa como "vaciar" (root.innerHTML = '')
  Object.defineProperty(el, 'innerHTML', {
    get() { return ''; },
    set(v) { if (!v) { children.forEach(c => { c.parentNode = null; }); children.length = 0; } },
  });

  if (tagName === 'CANVAS') {
    const ctx = createCtxStub();
    el._ctx = ctx;
    el.getContext = () => ctx;
  }
  return el;
}

function closestFrom(node, sel) {
  let cur = node;
  while (cur) {
    if (cur.classList && matches(cur, sel)) return cur;
    cur = cur.parentNode;
  }
  return null;
}

/** Ids que app.js espera que sean <canvas>. */
const CANVAS_IDS = new Set(['main-canvas', 'overlay-canvas', 'facade-preview']);

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Construye el árbol de stubs a partir del index.html real, para que
 * `querySelector` por clase y el anidamiento (modal → su botón Cancelar)
 * se comporten como en la página. Escáner de etiquetas con pila: basta
 * porque index.html es HTML bien formado y sin scripts inline con "<".
 */
function buildTreeFromHtml(html, doc) {
  const body = createElementStub('body', doc);
  const stack = [body];
  const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
  let m;
  while ((m = TAG_RE.exec(html)) !== null) {
    const [, closing, rawTag, rawAttrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (tag === 'script' || tag === 'link' || tag === 'meta' || tag === 'title') continue;
    if (closing) {
      if (stack.length > 1 && stack[stack.length - 1].tagName === tag.toUpperCase()) stack.pop();
      continue;
    }
    const el = createElementStub(tag, doc);
    for (const a of rawAttrs.matchAll(/([\w:-]+)(?:="([^"]*)"|='([^']*)')?/g)) {
      const name = a[1];
      const value = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : '');
      if (!name) continue;
      if (name === 'id') el.id = value;
      else if (name === 'class') el.className = value;
      else if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        el.dataset[key] = value;
      } else if (name === 'value') el.value = value;
      else if (name === 'type') el.type = value;
      else if (name === 'disabled') el.disabled = true;
      else if (name === 'checked') el.checked = true;
      else if (name === 'hidden') el.hidden = true;
      el.setAttribute(name, value);
    }
    stack[stack.length - 1].appendChild(el);
    if (!VOID_TAGS.has(tag) && !selfClose) stack.push(el);
  }
  return body;
}

function createDom({ html } = {}) {
  const byId = new Map();
  const store = new Map();
  const rafQueue = [];
  const timers = [];

  const doc = {
    activeElement: null,
    getElementById(id) {
      if (!byId.has(id)) {
        // Id que no está en el HTML: se crea al vuelo para no romper el arranque
        const el = createElementStub(CANVAS_IDS.has(id) ? 'canvas' : 'div', doc);
        el.id = id;
        byId.set(id, el);
      }
      return byId.get(id);
    },
    createElement(tag) { return createElementStub(tag, doc); },
    createElementNS(_ns, tag) { return createElementStub(tag, doc); },
    querySelector(sel) { return doc.body.querySelector(sel); },
    querySelectorAll(sel) { return doc.body.querySelectorAll(sel); },
    addEventListener(type, fn) { doc.__listeners.get(type) || doc.__listeners.set(type, []); doc.__listeners.get(type).push(fn); },
    removeEventListener() {},
    __listeners: new Map(),
    __fire(type, event = {}) {
      const ev = {
        type, target: doc, preventDefault() { ev.defaultPrevented = true; },
        stopPropagation() {}, ...event,
      };
      for (const fn of [...(doc.__listeners.get(type) || [])]) fn(ev);
      return ev;
    },
  };
  doc.body = html ? buildTreeFromHtml(html, doc) : createElementStub('body', doc);
  doc.documentElement = createElementStub('html', doc);
  // Indexa por id lo que venga del HTML; los <canvas> reciben su contexto.
  for (const el of descendants(doc.body)) {
    if (!el.id) continue;
    if (CANVAS_IDS.has(el.id) && !el.getContext) {
      const ctx = createCtxStub();
      el._ctx = ctx;
      el.getContext = () => ctx;
    }
    byId.set(el.id, el);
  }

  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(),
    get length() { return store.size; },
  };

  const api = {
    document: doc,
    localStorage,
    byId,
    /** Ejecuta los rAF y timers pendientes hasta que no quede ninguno. */
    flush(maxRounds = 50) {
      let rounds = 0;
      while ((rafQueue.length || timers.length) && rounds++ < maxRounds) {
        const frames = rafQueue.splice(0, rafQueue.length);
        frames.forEach(fn => fn(rounds));
        const due = timers.splice(0, timers.length);
        due.forEach(t => t && t.fn()); // null = timer cancelado con clearTimeout
      }
    },
    rafQueue,
    timers,
  };

  api.window = {
    document: doc,
    localStorage,
    devicePixelRatio: 1,
    innerWidth: 1440,
    innerHeight: 900,
    addEventListener(type, fn) { api.window.__listeners.get(type) || api.window.__listeners.set(type, []); api.window.__listeners.get(type).push(fn); },
    removeEventListener() {},
    __listeners: new Map(),
    __fire(type, event = {}) {
      const ev = { type, preventDefault() {}, ...event };
      for (const fn of [...(api.window.__listeners.get(type) || [])]) fn(ev);
    },
    requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };

  return api;
}

module.exports = { createDom, createElementStub, matches };
