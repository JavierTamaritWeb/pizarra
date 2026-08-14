/* ============================================================
   solid.js — Figuras 3D a partir de las formas planas

   Mismo contrato que building.js y garden.js: `Solid.elements(tool, p1, p2,
   opts)` devuelve un array plano de elementos de tipos YA EXISTENTES, sin
   `seed` (lo pone app.js con withSeeds) y sin DOM. Es DETERMINISTA — aquí no
   se llama a Math.random: el temblor lo añade Sketchy desde el seed, y si la
   geometría fuese aleatoria la previsualización del arrastre no coincidiría
   con lo que aparece al soltar.

   La proyección es CABALLERA (oblicua): la cara frontal es exactamente la
   forma que arrastras, sin deformar, y la tapa trasera es esa misma forma
   TRASLADADA por un vector fijo `d`. De ahí la decisión que sostiene todo el
   módulo:

     · la CARA FRONTAL se emite como el elemento 2D real de su tipo
       (`pentagon`, `circle`, `star6`…), y así hereda gratis el relleno, el
       temblor, el hit-test y el borrado por silueta, «Bordes ocultos» y las
       cinco exportaciones;
     · las aristas traseras y laterales son `line` y `curveArrow`, que son los
       ÚNICOS tipos que admiten `dash: true`. Por eso la tapa trasera NO puede
       ser un elemento de forma: sus aristas se ven unas sí y otras no, y una
       forma no se puede dibujar a trazos por tramos.

   Prisma, tronco y pirámide son el MISMO cuerpo con distinto factor de tapa
   `k` (1 / 0,1–0,95 / 0), porque V'ᵢ = C + k·(Vᵢ − C) + d hace que toda cara
   lateral sea un trapecio plano para cualquier k. Un solo generador.
   ============================================================ */

const Solid = (function () {
  'use strict';

  /** Por debajo de esto el arrastre es un "clic" y manda DEFAULTS. */
  const MIN_SPAN = 6;

  // Topes de los mandos. Se exportan porque restorePrefs valida contra ellos
  // y tests/smoke.test.js los compara con los min/max del HTML.
  const DEPTH_MIN = 10,  DEPTH_MAX = 150;        // % del lado menor de la cara
  const ANGLE_MIN = 0,   ANGLE_MAX = 360;        // grados de fuga (vuelta completa)
  const FORESHORTEN_MIN = 10, FORESHORTEN_MAX = 100; // % de escorzo
  const TAPER_MIN = 10,  TAPER_MAX = 95;         // % de la tapa del tronco

  /** El mismo radio de esquina que dibujan Renderer y el rx="12" del SVG. */
  const CORNER_R = 12;
  /** Sin tangentes por debajo de 1 (el vértice cae dentro de la elipse). */
  const RHO_MIN_TANGENT = 1.15;
  /** Por debajo de esto el cilindro es un doble contorno pastoso. */
  const RHO_MIN_ROUND = 0.25;
  /** Empate de área: se resuelve a favor de "visible" (ver _faceVisible). */
  const AREA_EPS = 1e-6;
  const TINY = 1e-9;
  /** Muestras por arco de esquina al armar una cara curva. */
  const FACE_ARC_STEPS = 4;
  /** Muestras por media elipse al armar una cara redonda. */
  const FACE_ELLIPSE_STEPS = 16;

  const DEFAULTS = {
    [TOOLS.SOLID_PRISM]:   { w: 130, h: 110 },
    [TOOLS.SOLID_PYRAMID]: { w: 130, h: 110 },
    [TOOLS.SOLID_FRUSTUM]: { w: 130, h: 110 },
    [TOOLS.SOLID_SPHERE]:  { w: 120, h: 120 },
  };

  // ---------------------------------------------------------------- piezas

  const _line = (a, b, o) => ({
    type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    color: o.color, lineWidth: o.lineWidth,
  });

  /** La ausencia del campo ES el trazo sólido: `dash: false` lo rechaza
      isValidElement, igual que rechaza `opacity: 1` en el aerógrafo. */
  const _dash = (el, hidden) => (hidden ? { ...el, dash: true } : el);

  /**
   * Cara rellena: un `polygon` libre SIN contorno. Va sin contorno porque las
   * aristas del sólido se dibujan aparte, una a una — cada una decide por su
   * cuenta si va discontinua—, y dibujarlo aquí las duplicaría y volvería
   * sólidas las ocultas. Devuelve null si los puntos degeneran.
   */
  function _face(points, o) {
    const pts = [];
    for (const p of points) {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > TINY) pts.push(p);
    }
    while (pts.length > 1 &&
      Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < TINY) {
      pts.pop();
    }
    if (pts.length < 3) return null;
    const el = {
      type: 'polygon', points: pts, color: o.color, lineWidth: o.lineWidth,
      fill: true, stroke: false,
      // SIEMPRE explícito: en un sólido, «Rellenar» tiene que dar relleno
      // OPACO. Sin el campo, Renderer.fillStyle cae en el tinte clásico
      // `color + '20'` (12 %), que además queda MENOS opaco que el modo
      // translúcido (40 %) — el modo sólido se veía más transparente que el
      // translúcido. El color es el que el selector enseña: `fillColor || color`.
      fillColor: o.fillColor || o.color,
    };
    if (o.fillTransparent) el.fillTransparent = true;
    if (Number.isFinite(o.fillOpacity)) el.fillOpacity = o.fillOpacity;
    return el;
  }

  /** Muestreo de un arco de elipse en puntos, para armar caras curvas. */
  function _ellipsePts(c, a, b, t1, t2, steps) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = t1 + (t2 - t1) * i / steps;
      out.push({
        x: c.x + a.x * Math.cos(t) + b.x * Math.sin(t),
        y: c.y + a.y * Math.cos(t) + b.y * Math.sin(t),
      });
    }
    return out;
  }

  const _clamp = (v, lo, hi) =>
    (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

  // ------------------------------------------------------------- geometría

  /** Área con signo (shoelace). Su SIGNO orienta las normales sin depender
      del sentido en que cada módulo devuelva sus vértices. */
  function _shoelace(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a;
  }

  /**
   * ¿Se ve la cara lateral que va de la arista (a→b) a la (ap→bp)?
   *
   * El criterio es el SIGNO DEL ÁREA del cuadrilátero proyectado, no el
   * producto escalar de la normal con `d`. En un poliedro con orientación
   * coherente dos caras que comparten una arista la recorren en sentidos
   * opuestos; la cara frontal recorre a→b y este cuadrilátero también, luego
   * está orientado al revés que el frente, que es la definición de cara
   * vista. Es equivalente a n·d en el prisma, pero vale SIN CAMBIOS para el
   * tronco y para la pirámide (donde la cara está inclinada y su normal 3D ya
   * no es (e_y, −e_x, 0); con el ápice el "cuadrilátero" degenera en el
   * triángulo correcto y el shoelace lo calcula igual), y no necesita ni `d`
   * ni el ángulo, sólo puntos ya proyectados.
   *
   * El empate (arista exactamente de silueta, que ocurre de verdad cuando `d`
   * es paralelo a un lado) se resuelve a favor de VISIBLE: sólido sobre
   * sólido colineal se lee como un trazo algo engrosado y el temblor lo
   * disimula, mientras que discontinuo sobre sólido se lee como roto.
   */
  function _faceVisible(a, b, bp, ap, sigma, refArea) {
    const q = _shoelace([a, b, bp, ap]);
    return q * -sigma > -AREA_EPS * refArea;
  }

  /** Distancia del centro al contorno en la dirección de `u`. Se queda con el
      corte MÁS LEJANO: en un cóncavo el rayo sale y vuelve a entrar, y lo que
      hace falta es la distancia tras la cual ya se está fuera del todo. */
  function _rayBoundary(pts, C, u) {
    const len = Math.hypot(u.x, u.y);
    if (len < TINY) return 0;
    const ux = u.x / len, uy = u.y / len;
    let best = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ex = b.x - a.x, ey = b.y - a.y;
      const den = ux * ey - uy * ex;
      if (Math.abs(den) < TINY) continue;
      const ax = a.x - C.x, ay = a.y - C.y;
      const t = (ax * ey - ay * ex) / den;          // avance sobre el rayo
      const s = (ax * uy - ay * ux) / den;          // posición en la arista
      if (t > best && s >= 0 && s <= 1) best = t;
    }
    return best;
  }

  // ------------------------------------------------------------- perfiles

  /**
   * Perfil de una sección: nodos `pts` y aristas, donde la arista `i` va de
   * `pts[i]` a `pts[i+1]` y es recta (`arcs[i] === null`) o un arco de esquina
   * (sólo el redondeado). Es la representación que hace que polígonos,
   * trapecio y rectángulo redondeado pasen por la misma máquina.
   */
  function _profile(section, box, rotation) {
    if (section === TOOLS.ROUNDED_RECT) return _roundedProfile(box);
    if (section === TOOLS.RECT) {
      const { x, y, w, h } = box;
      return {
        pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
        arcs: [null, null, null, null],
      };
    }
    if (section === TOOLS.TRAPEZOID) {
      const pts = Trapezoid.vertices({ ...box, rotation });
      return { pts, arcs: pts.map(() => null) };
    }
    if (RegularPolygon.isType(section)) {
      const pts = RegularPolygon.vertices({ type: section, ...box, rotation });
      return { pts, arcs: pts.map(() => null) };
    }
    return null;
  }

  /** Las secciones que guardan su orientación como ÁNGULO. El rectángulo, el
      redondeado y el círculo quedan fuera: ahí girar es intercambiar ancho y
      alto, que ya lo da el arrastre, y `isValidElement` rechaza un `rotation`
      en esos tipos. */
  const _rotatable = section =>
    RegularPolygon.isType(section) || section === TOOLS.TRAPEZOID;

  /** Giro de la sección, cuantizado a un paso VÁLIDO de su tipo: 36° no es una
      orientación posible de un hexágono, y un trapecio fuera del cuarto de
      vuelta no pasa la validación de importación. */
  function _rotationFor(section, value) {
    if (!_rotatable(section) || !Number.isFinite(value) || !value) return 0;
    const step = ShapeRotation.step(section);
    if (!step) return 0;
    return ShapeRotation.normalize(Math.round(value / step) * step);
  }

  function _roundedProfile(box) {
    const { x, y, w, h } = box;
    const r = Math.max(0, Math.min(CORNER_R, w / 2, h / 2));
    if (r < 0.5) return _profile(TOOLS.RECT, box);
    const Q = Math.PI / 2, PI = Math.PI;
    return {
      pts: [
        { x: x + r, y }, { x: x + w - r, y },
        { x: x + w, y: y + r }, { x: x + w, y: y + h - r },
        { x: x + w - r, y: y + h }, { x: x + r, y: y + h },
        { x, y: y + h - r }, { x, y: y + r },
      ],
      arcs: [
        null, { cx: x + w - r, cy: y + r, r, t1: -Q, t2: 0 },
        null, { cx: x + w - r, cy: y + h - r, r, t1: 0, t2: Q },
        null, { cx: x + r, cy: y + h - r, r, t1: Q, t2: PI },
        null, { cx: x + r, cy: y + r, r, t1: PI, t2: PI + Q },
      ],
    };
  }

  // --------------------------------------------------------- arcos elípticos

  /**
   * Arco de elipse por diámetros conjugados `a` y `b` (P(t) = c + a·cos t +
   * b·sen t), como UNA cadena de cúbicas dentro de un solo `curveArrow`.
   *
   * Se parte en tramos de ≤90°: con una sola cúbica por media elipse el error
   * radial es del 2,7 % y los extremos salen visiblemente aplanados en un
   * círculo grande; a 90° baja a 2,7·10⁻⁴ del radio, y cuesta lo mismo en
   * número de elementos porque todo va en una cadena.
   *
   * NUNCA se marca `arc: true`: app.js re-normaliza a semicírculo exacto
   * cualquier elemento con esa marca en cuanto se le arrastra un extremo o el
   * handle de curvatura, así que el ecuador de una esfera se convertiría en
   * semicírculo al tocarlo.
   *
   * El punto de empalme se calcula UNA vez y se reutiliza por variable:
   * CurvePath.isValidSegments exige igualdad estricta entre el final de un
   * tramo y el principio del siguiente, y recalcularlo puede dar otro ULP.
   */
  function _ellipseArc(c, a, b, t1, t2, o) {
    const span = t2 - t1;
    const n = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 2) - 1e-9));
    const at = t => ({
      x: c.x + a.x * Math.cos(t) + b.x * Math.sin(t),
      y: c.y + a.y * Math.cos(t) + b.y * Math.sin(t),
    });
    const dt = t => ({
      x: -a.x * Math.sin(t) + b.x * Math.cos(t),
      y: -a.y * Math.sin(t) + b.y * Math.cos(t),
    });
    const step = span / n;
    const alpha = (4 / 3) * Math.tan(step / 4);
    const segments = [];
    const first = at(t1);
    let prev = first;
    for (let i = 0; i < n; i++) {
      const ta = t1 + step * i, tb = t1 + step * (i + 1);
      const pa = prev, pb = at(tb);
      const da = dt(ta), db = dt(tb);
      segments.push({
        x1: pa.x, y1: pa.y,
        cx: pa.x + alpha * da.x, cy: pa.y + alpha * da.y,
        cx2: pb.x - alpha * db.x, cy2: pb.y - alpha * db.y,
        x2: pb.x, y2: pb.y,
      });
      prev = pb;
    }
    return {
      type: 'curveArrow', segments,
      x1: first.x, y1: first.y, x2: prev.x, y2: prev.y,
      heads: 'none', color: o.color, lineWidth: o.lineWidth,
    };
  }

  const _circArc = (c, r, t1, t2, o) =>
    _ellipseArc(c, { x: r, y: 0 }, { x: 0, y: r }, t1, t2, o);

  // ------------------------------------------------------------ cara frontal

  function _frontBox(tool, section, p1, p2) {
    const def = DEFAULTS[tool];
    const rawW = Math.abs(p2.x - p1.x), rawH = Math.abs(p2.y - p1.y);
    // Los polígonos regulares nacen DESDE EL CENTRO y salen cuadrados,
    // exactamente como en «Formas»: el gesto tiene que sentirse igual, y
    // isValidElement rechaza un polígono regular deformado.
    if (RegularPolygon.isType(section)) {
      if (rawW < MIN_SPAN && rawH < MIN_SPAN) {
        return { x: p1.x - def.w / 2, y: p1.y - def.w / 2, w: def.w, h: def.w };
      }
      return RegularPolygon.fromCenter(p1, p2);
    }
    let w = rawW >= MIN_SPAN ? rawW : def.w;
    let h = rawH >= MIN_SPAN ? rawH : def.h;
    if (tool === TOOLS.SOLID_SPHERE) { w = h = Math.min(w, h); }
    return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w, h };
  }

  function _frontEl(section, box, o, rotation) {
    const el = {
      type: section, x: box.x, y: box.y, w: box.w, h: box.h,
      color: o.color, lineWidth: o.lineWidth, fill: !!o.fill,
    };
    // La ausencia del campo es la orientación de siempre, igual que en Formas
    if (rotation) el.rotation = rotation;
    // La cara frontal comparte el relleno de las laterales, o el sólido saldría
    // con los lados opacos y el frente en el tinte clásico (ver `_face`).
    if (o.fill) el.fillColor = o.fillColor || o.color;
    // Sin relleno se conserva el color elegido —vaciar y volver a rellenar
    // recupera el mismo—, pero no se inventa uno derivado del trazo.
    else if (o.fillColor) el.fillColor = o.fillColor;
    if (o.fill && o.fillTransparent) el.fillTransparent = true;
    if (o.fill && Number.isFinite(o.fillOpacity)) el.fillOpacity = o.fillOpacity;
    return el;
  }

  /**
   * Cuánta fuga necesita cada remate para LEERSE, con el mando en el mismo
   * sitio. No se deduce de nada: se calibró mirando las 31 figuras dibujadas,
   * igual que el grano y la densidad del aerógrafo.
   *
   * El motivo es que aquí se mira el sólido por su eje de fuga, y la silueta
   * de una pirámide se derrumba sobre su base: con la misma profundidad que
   * da un prisma correcto, el ápice cae casi encima del contorno y un cono
   * sale como un círculo con una brizna. Un prisma, en cambio, se lee de
   * sobra con media cara de fondo. El deslizador sigue escalando los tres.
   */
  const DEPTH_SCALE = {
    [TOOLS.SOLID_PRISM]: 1,
    [TOOLS.SOLID_FRUSTUM]: 1.5,
    [TOOLS.SOLID_PYRAMID]: 2,
    [TOOLS.SOLID_SPHERE]: 1,
  };

  /** Vector de fuga. La profundidad va en % del lado menor de la cara para
      que una figura pequeña y otra grande salgan con la misma proporción. */
  function _depth(box, o, tool) {
    const p = _clamp(o.solidDepth, DEPTH_MIN, DEPTH_MAX) / 100 *
      (DEPTH_SCALE[tool] || 1) * Math.min(box.w, box.h);
    const k = _clamp(o.solidForeshorten, FORESHORTEN_MIN, FORESHORTEN_MAX) / 100;
    const th = _clamp(o.solidAngle, ANGLE_MIN, ANGLE_MAX) * Math.PI / 180;
    const len = p * k;
    return { x: len * Math.cos(th), y: -len * Math.sin(th) };
  }

  const _scaleTo = (d, len) => {
    const l = Math.hypot(d.x, d.y);
    return l < TINY ? d : { x: d.x * len / l, y: d.y * len / l };
  };

  // -------------------------------------------------------------- extrusión

  function _extrude(section, box, d, k, o, front, rotation) {
    const prof = _profile(section, box, rotation);
    if (!prof || prof.pts.length < 3) return [front];
    const V = prof.pts, n = V.length;
    const area = _shoelace(V);
    if (!area) return [front];           // vértices colineales: no hay sólido
    const sigma = Math.sign(area);
    const refArea = Math.abs(area);
    const C = { x: box.x + box.w / 2, y: box.y + box.h / 2 };

    // Con los convexos nunca hay error geométrico por profundidad corta, sólo
    // apretujamiento; se acota igualmente para que el dibujo se lea.
    const R = Math.max(...V.map(p => Math.hypot(p.x - C.x, p.y - C.y)));
    let minLen = Math.max(10, 0.12 * R);
    // Y con k < 1 hay un segundo suelo, el que de verdad importa: si el punto
    // fijo de la homotecia (el ápice, con k = 0) cae DENTRO de la silueta, el
    // sólido se está viendo por su eje, todas sus caras son traseras y la
    // figura entera sale discontinua — correcto y a la vez ilegible. Es el
    // mismo suelo que el cono aplica con RHO_MIN_TANGENT, aquí medido contra
    // el contorno real en la dirección de la fuga.
    if (k < 1) {
      const bd = _rayBoundary(V, C, d);
      if (bd) minLen = Math.max(minLen, RHO_MIN_TANGENT * (1 - k) * bd);
    }
    if (Math.hypot(d.x, d.y) < minLen) d = _scaleTo(d, minLen);
    if (Math.hypot(d.x, d.y) < TINY) return [front];

    const map = p => ({ x: C.x + k * (p.x - C.x) + d.x, y: C.y + k * (p.y - C.y) + d.y });
    const W = V.map(map);

    const vis = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      vis.push(_faceVisible(V[i], V[j], W[j], W[i], sigma, refArea));
    }

    const parts = [];
    // Tapa trasera: cada arista hereda la visibilidad de SU cara lateral.
    // Con k = 0 (pirámide) todos los W coinciden en el ápice y no se emite
    // ninguna: la deduplicación es lo único que distingue ese caso.
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (Math.hypot(W[j].x - W[i].x, W[j].y - W[i].y) < TINY) continue;
      const arc = prof.arcs[i];
      if (arc) {
        const c = map({ x: arc.cx, y: arc.cy });
        parts.push(_dash(_circArc(c, arc.r * k, arc.t1, arc.t2, o), !vis[i]));
      } else {
        parts.push(_dash(_line(W[i], W[j], o), !vis[i]));
      }
    }
    // Conectores: un vértice se ve si se ve alguna de sus dos caras.
    for (let i = 0; i < n; i++) {
      if (Math.hypot(W[i].x - V[i].x, W[i].y - V[i].y) < TINY) continue;
      const seen = vis[(i - 1 + n) % n] || vis[i];
      parts.push(_dash(_line(V[i], W[i], o), !seen));
    }

    // Caras laterales VISTAS, rellenas. Sólo las vistas: las de detrás
    // quedarían tapadas en opaco, y en translúcido sólo ensuciarían el tono
    // sin aportar volumen. El borde de una esquina redondeada se muestrea,
    // así la cara no deja una cuña sin pintar en cada esquina.
    if (o.fill) {
      const borde = (pts, i, mapFn) => {
        const arc = prof.arcs[i];
        if (!arc) return [pts[i], pts[(i + 1) % n]];
        const c = mapFn ? mapFn({ x: arc.cx, y: arc.cy }) : { x: arc.cx, y: arc.cy };
        const r = mapFn ? arc.r * k : arc.r;
        return _ellipsePts(c, { x: r, y: 0 }, { x: 0, y: r }, arc.t1, arc.t2, FACE_ARC_STEPS);
      };
      for (let i = 0; i < n; i++) {
        if (!vis[i]) continue;
        const cara = _face([...borde(V, i, null), ...borde(W, i, map).reverse()], o);
        if (cara) parts.push(cara);
      }
    }

    return [...parts, front];
  }

  /** Margen del recorte: una arista que sólo roza el contorno no está oculta.
      Sin él, una arista de silueta exacta —que la regla del empate manda
      dibujar sólida— caería del lado de "dentro" por redondeo. */
  const OCCLUDE_MARGIN = 2;
  const OCCLUDE_SAMPLES = 9;

  /**
   * Segunda pasada: marca discontinua toda pieza que la regla de caras dio
   * por vista pero que en realidad pasa POR DETRÁS de la cara frontal.
   *
   * Hace falta porque el test de cara es localmente exacto y aun así "cara
   * delantera" no siempre implica "visible":
   *
   *  · en las secciones CÓNCAVAS (las dos estrellas) la tapa trasera aterriza
   *    con sus puntas dentro de las muescas de la frontal, y sólo quedarían
   *    disjuntas con |d| ≳ 2R, una profundidad absurda: a cualquier
   *    profundidad usable hay cruces, así que esto no es un adorno;
   *  · con k < 1 (tronco y pirámide) la tapa encoge hacia el centro, de modo
   *    que la demostración que sí vale para el prisma convexo —si la cara es
   *    delantera, su arista TRASLADADA cae fuera del semiplano de esa arista—
   *    deja de aplicar.
   *
   * Se marcan discontinuas, no se borran: están ocultas, y discontinuo es
   * justo como esta app dibuja lo oculto. El punto interior lo decide
   * RegularPolygon.contains / Trapezoid.contains (ray casting, ya funcionan
   * con cóncavos) en vez de escribir un point-in-polygon nuevo.
   *
   * Limitación conocida: una arista PARCIALMENTE dentro se clasifica entera.
   * Partirla por sus cortes con el contorno sería exacto y multiplicaría el
   * número de elementos; queda fuera de alcance.
   */
  function _occlude(parts, section, box, rotation) {
    const w = Math.max(1, box.w - 2 * OCCLUDE_MARGIN);
    const h = Math.max(1, box.h - 2 * OCCLUDE_MARGIN);
    const shape = {
      type: section, rotation: rotation || 0, w, h,
      x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2,
    };
    const inside = _containsIn(shape);
    return parts.map(el => (el.dash || !_samples(el).some(inside)
      ? el
      : { ...el, dash: true }));
  }

  function _containsIn(shape) {
    if (RegularPolygon.isType(shape.type)) return p => RegularPolygon.contains(p, shape);
    if (shape.type === TOOLS.TRAPEZOID) return p => Trapezoid.contains(p, shape);
    const rx = shape.w / 2, ry = shape.h / 2;
    const cx = shape.x + rx, cy = shape.y + ry;
    if (shape.type === TOOLS.CIRCLE) {
      return p => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1;
    }
    return p => Math.abs(p.x - cx) < rx && Math.abs(p.y - cy) < ry;
  }

  /** Puntos interiores de una pieza, sin sus extremos: los extremos de un
      conector viven SOBRE el contorno y darían un positivo en todas. */
  function _samples(el) {
    const out = [];
    const n = OCCLUDE_SAMPLES;
    if (el.type === 'line') {
      for (let i = 1; i < n; i++) {
        out.push({
          x: el.x1 + (el.x2 - el.x1) * i / n,
          y: el.y1 + (el.y2 - el.y1) * i / n,
        });
      }
    } else if (Array.isArray(el.segments)) {
      el.segments.forEach(s => {
        for (let i = 1; i < n; i++) {
          const t = i / n, m = 1 - t;
          out.push({
            x: m ** 3 * s.x1 + 3 * m * m * t * s.cx + 3 * m * t * t * s.cx2 + t ** 3 * s.x2,
            y: m ** 3 * s.y1 + 3 * m * m * t * s.cy + 3 * m * t * t * s.cy2 + t ** 3 * s.y2,
          });
        }
      });
    }
    return out;
  }

  // --------------------------------------------------- secciones redondas

  /**
   * Cilindro, cono y tronco de cono. La tapa es la imagen de la frontal por
   * una homotecia de razón k cuyo punto fijo es H = C + d/(1−k), y todas las
   * tangentes exteriores comunes pasan por H — así que cono (k=0) y tronco
   * salen de la MISMA rutina, tangentes desde un punto. k = 1 es el cilindro
   * (H en el infinito) y tiene su propia fórmula cerrada.
   */
  function _round(box, d, k, o, front) {
    const rx = box.w / 2, ry = box.h / 2;
    const C = { x: box.x + rx, y: box.y + ry };
    if (rx < 1 || ry < 1) return [front];
    return Math.abs(1 - k) < 1e-6
      ? _cylinder(C, rx, ry, d, o, front)
      : _cone(C, rx, ry, d, k, o, front);
  }

  function _cylinder(C, rx, ry, d, o, front) {
    let rho = Math.hypot(d.x / rx, d.y / ry);
    if (rho < TINY) return [front];
    if (rho < RHO_MIN_ROUND) {
      d = _scaleTo(d, Math.hypot(d.x, d.y) * RHO_MIN_ROUND / rho);
      rho = RHO_MIN_ROUND;
    }
    // Tangentes en la DIRECCIÓN de d: donde ∇F·d = 0 sobre la elipse.
    const N = Math.sqrt(rx * rx * d.y * d.y + ry * ry * d.x * d.x);
    if (N < TINY) return [front];
    const u = { x: -rx * rx * d.y / N, y: ry * ry * d.x / N };
    const Tp = { x: C.x + u.x, y: C.y + u.y };
    const Tm = { x: C.x - u.x, y: C.y - u.y };
    const tp = Math.atan2(ry * d.x, -rx * d.y);
    const Cb = { x: C.x + d.x, y: C.y + d.y };
    const a = { x: rx, y: 0 }, b = { x: 0, y: ry };
    // El punto de apoyo en dirección d cae SIEMPRE en tp − π/2, así que la
    // mitad visible es [tp − π, tp] sin ninguna rama que decidir.
    const piezas = [
      _dash(_ellipseArc(Cb, a, b, tp, tp + Math.PI, o), true),
      _ellipseArc(Cb, a, b, tp - Math.PI, tp, o),
      _line(Tp, { x: Tp.x + d.x, y: Tp.y + d.y }, o),
      _line(Tm, { x: Tm.x + d.x, y: Tm.y + d.y }, o),
    ];
    // La banda lateral vista: del arco frontal que mira hacia la fuga al mismo
    // arco de la tapa, cerrando por las dos generatrices.
    if (o.fill) {
      const cara = _face([
        ..._ellipsePts(C, a, b, tp - Math.PI, tp, FACE_ELLIPSE_STEPS),
        ..._ellipsePts(Cb, a, b, tp - Math.PI, tp, FACE_ELLIPSE_STEPS).reverse(),
      ], o);
      if (cara) piezas.push(cara);
    }
    return [...piezas, front];
  }

  function _cone(C, rx, ry, d, k, o, front) {
    const f = 1 / (1 - k);
    let u = d.x * f / rx, v = d.y * f / ry;
    let rho = Math.hypot(u, v);
    if (rho < TINY) return [front];
    // Con rho ≤ 1 el vértice de la homotecia cae DENTRO de la elipse y no
    // existen tangentes (la raíz sería NaN). Se aleja `d` lo justo.
    if (rho < RHO_MIN_TANGENT) {
      d = _scaleTo(d, Math.hypot(d.x, d.y) * RHO_MIN_TANGENT / rho);
      u = d.x * f / rx; v = d.y * f / ry;
      rho = Math.hypot(u, v);
    }
    const inv = 1 / (rho * rho);
    const s = Math.sqrt(rho * rho - 1) * inv;
    const p = [
      { x: u * inv - s * v, y: v * inv + s * u },
      { x: u * inv + s * v, y: v * inv - s * u },
    ];
    const T = p.map(q => ({ x: C.x + rx * q.x, y: C.y + ry * q.y }));
    const t = p.map(q => Math.atan2(q.y, q.x));
    const map = q => ({ x: C.x + k * (q.x - C.x) + d.x, y: C.y + k * (q.y - C.y) + d.y });
    const Tb = T.map(map);

    // Mitad del contorno frontal que mira hacia la fuga: es la que limita la
    // superficie lateral vista, tanto en el cono como en el tronco.
    const span0 = ((t[1] - t[0]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const mitades = [[t[0], t[0] + span0], [t[0] + span0, t[0] + 2 * Math.PI]];
    const lejania = ([ta, tb]) => {
      const m = (ta + tb) / 2;
      return rx * Math.cos(m) * d.x + ry * Math.sin(m) * d.y;
    };
    const lejos = lejania(mitades[0]) >= lejania(mitades[1]) ? mitades[0] : mitades[1];
    const aF = { x: rx, y: 0 }, bF = { x: 0, y: ry };

    if (k < 1e-6) {
      // Cono: la base está ENTERA visible —el cuerpo queda detrás de ella—,
      // así que no hay ninguna pieza discontinua.
      const apex = { x: C.x + d.x, y: C.y + d.y };
      const piezas = [_line(T[0], apex, o), _line(T[1], apex, o)];
      if (o.fill) {
        const cara = _face([
          ..._ellipsePts(C, aF, bF, lejos[0], lejos[1], FACE_ELLIPSE_STEPS), apex,
        ], o);
        if (cara) piezas.push(cara);
      }
      return [...piezas, front];
    }

    const Cb = { x: C.x + d.x, y: C.y + d.y };
    const a = { x: k * rx, y: 0 }, b = { x: 0, y: k * ry };
    // La mitad OCULTA de la tapa menor es la que queda del mismo lado de la
    // cuerda T'₀T'₁ que el centro de la cara frontal.
    const cross = (A, B, P) => (B.x - A.x) * (P.y - A.y) - (B.y - A.y) * (P.x - A.x);
    const side = Math.sign(cross(Tb[0], Tb[1], C));
    const span = ((t[1] - t[0]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const halves = [[t[0], t[0] + span], [t[0] + span, t[0] + 2 * Math.PI]];
    const parts = halves.map(([ta, tb]) => {
      const mid = (ta + tb) / 2;
      const P = { x: Cb.x + a.x * Math.cos(mid), y: Cb.y + b.y * Math.sin(mid) };
      const hidden = side !== 0 && Math.sign(cross(Tb[0], Tb[1], P)) === side;
      return _dash(_ellipseArc(Cb, a, b, ta, tb, o), hidden);
    });
    const piezas = [...parts, _line(T[0], Tb[0], o), _line(T[1], Tb[1], o)];
    if (o.fill) {
      const cara = _face([
        ..._ellipsePts(C, aF, bF, lejos[0], lejos[1], FACE_ELLIPSE_STEPS),
        ..._ellipsePts(Cb, a, b, lejos[0], lejos[1], FACE_ELLIPSE_STEPS).reverse(),
      ], o);
      if (cara) piezas.push(cara);
    }
    return [...piezas, front];
  }

  /**
   * Esfera: círculo más ecuador. El ecuador estricto sería una elipse
   * CIZALLADA, que además de no tener primitiva en la app se lee como un
   * error de dibujo y no como perspectiva. Como la esfera es invariante por
   * rotación, el plano del ecuador es libre: se elige el que proyecta con los
   * ejes alineados.
   */
  function _sphere(box, d, o, front) {
    const r = box.w / 2;
    if (r < 1) return [front];
    const C = { x: box.x + r, y: box.y + r };
    const kf = _clamp(o.solidForeshorten, FORESHORTEN_MIN, FORESHORTEN_MAX) / 100;
    const th = _clamp(o.solidAngle, ANGLE_MIN, ANGLE_MAX) * Math.PI / 180;
    const ry = Math.max(2, r * kf * Math.abs(Math.sin(th)));
    const a = { x: r, y: 0 }, b = { x: 0, y: ry };
    // La mitad que se aleja en el sentido de la fuga es la de detrás.
    const far = t => (ry * Math.sin(t)) * d.y > 0;
    return [
      _dash(_ellipseArc(C, a, b, 0, Math.PI, o), far(Math.PI / 2)),
      _dash(_ellipseArc(C, a, b, Math.PI, 2 * Math.PI, o), far(3 * Math.PI / 2)),
      front,
    ];
  }

  // ------------------------------------------------------------------ API

  function elements(tool, p1, p2, opts) {
    const o = {
      color: '#000000', lineWidth: 2,
      solidDepth: 75, solidAngle: 30, solidForeshorten: 80, solidTaper: 55,
      solidRotation: 0,
      ...(opts || {}),
    };
    if (!DEFAULTS[tool]) return [];
    const section = tool === TOOLS.SOLID_SPHERE
      ? TOOLS.CIRCLE
      : (SOLID_SECTIONS.includes(o.solidSection) ? o.solidSection : TOOLS.RECT);
    const box = _frontBox(tool, section, p1, p2);
    if (!(box.w > 0 && box.h > 0)) return [];
    const rotation = _rotationFor(section, o.solidRotation);
    const front = _frontEl(section, box, o, rotation);
    const d = _depth(box, o, tool);
    const k = tool === TOOLS.SOLID_PRISM ? 1
      : tool === TOOLS.SOLID_PYRAMID ? 0
        : _clamp(o.solidTaper, TAPER_MIN, TAPER_MAX) / 100;
    const built = tool === TOOLS.SOLID_SPHERE ? _sphere(box, d, o, front)
      : section === TOOLS.CIRCLE ? _round(box, d, k, o, front)
        : _extrude(section, box, d, k, o, front, rotation);
    // El recorte de ocultas se aplica aquí, una sola vez, para que valga igual
    // a las secciones poligonales y a las redondas — y ANTES de ordenar, o una
    // arista que el recorte acaba de declarar oculta se quedaría dibujada
    // encima de la cara que la tapa.
    // La esfera se queda FUERA del recorte, y es el único caso: su ecuador es
    // una línea sobre la superficie, no una arista de detrás, y va justo por
    // dentro del círculo, así que el recorte lo daba por oculto y marcaba
    // discontinuas sus dos mitades. Se notaba poco sin relleno —dos arcos a
    // trazos siguen leyéndose como una esfera— y con relleno opaco dejaba un
    // círculo plano, sin ecuador ninguno.
    const piezas = tool === TOOLS.SOLID_SPHERE
      ? built.slice(0, -1)
      : _occlude(built.slice(0, -1), section, box, rotation);
    // El orden ES el resultado: aristas ocultas, caras rellenas, la cara
    // frontal y, ENCIMA DE TODO, las aristas vistas. Con relleno opaco las
    // caras tapan lo que pasa por detrás y la figura se lee maciza; con
    // relleno translúcido las ocultas se siguen viendo a través, como un
    // cristal. Sin relleno no hay caras y el orden da igual.
    //
    // Las aristas vistas van DESPUÉS de la cara frontal, no antes: las de una
    // caja caen fuera de ella y el orden no se notaría, pero el ecuador de la
    // esfera va por dentro y con el relleno delante desaparecía — una esfera
    // rellena salía como un círculo plano.
    const ocultas = piezas.filter(el => el.dash);
    const caras = piezas.filter(el => !el.dash && el.type === TOOLS.POLYGON);
    const vistas = piezas.filter(el => !el.dash && el.type !== TOOLS.POLYGON);
    return [...ocultas, ...caras, built[built.length - 1], ...vistas];
  }

  return {
    elements, MIN_SPAN, isRotatableSection: _rotatable,
    DEPTH_MIN, DEPTH_MAX, ANGLE_MIN, ANGLE_MAX,
    FORESHORTEN_MIN, FORESHORTEN_MAX, TAPER_MIN, TAPER_MAX,
  };
})();
