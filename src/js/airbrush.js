/* ============================================================
   airbrush.js — Geometría pura del aerógrafo: la nube de gotas

   Un elemento `airbrush` guarda el EJE del trazo (`points`, decimado igual
   que el lápiz) y cuatro parámetros —`radius` (boquilla), `density`,
   `lineWidth` (grano) y el `seed`—, nunca la nube. Las gotas se regeneran
   aquí, de forma determinista, cada vez que hacen falta: lienzo, las cinco
   exportaciones, la miniatura del modal y la previsualización del arrastre.
   Así el JSON no engorda y las cinco salidas no pueden divergir.

   DOS DECISIONES QUE SOSTIENEN TODO LO DEMÁS

   1) La aleatoriedad es una FUNCIÓN, no un generador. `mulberry32`
      (sketchy.js) es un flujo con estado: si cambia el número de gotas de
      un tramo, TODA la secuencia posterior se desplaza y la nube entera se
      re-sortea. Eso se ve como "hervido": al arrastrar un handle de
      redimensionado, o simplemente al alargar el trazo mientras se dibuja,
      la mancha bulle en cada fotograma. Con `_rnd(seed, seg, dot, canal)`
      —una mezcla sin estado— los valores de la gota `i` no dependen ni del
      número de gotas ni de la longitud, así que alargar solo AÑADE y
      escalar mueve las que ya había.

   2) La dispersión es 2-D isótropa alrededor del punto del eje, no un
      desplazamiento perpendicular. Un `offset = R * rand**k` en 1-D es
      singular en el eje para todo k>1 (la densidad tiende a infinito en el
      centro): pinta una línea dura y brillante por la mitad, que es lo que
      hace que un aerógrafo falso parezca un rotulador fluorescente. Y deja
      las puntas cuadradas. Con `rho = R * u**SPREAD` y un ángulo uniforme
      salen gratis las puntas redondas (la unión de discos a lo largo de la
      polilínea es un estadio), el sesgo al centro sin línea dura, y —lo más
      importante para el resto de la app— `radius` como COTA DURA: no hay
      tinta a más de R del eje, y por eso los bounds, el recorte al área y
      el alcance del borrador pueden ser exactos.

   El recorte al área (`clip`) se hace descartando gotas por su centro. El
   borde queda ligeramente deshilachado, y es deliberado: una plantilla de
   canto perfecto exigiría `ctx.clip()` en el lienzo, `<clipPath>` en el SVG
   y un tercer camino en el HTML — tres implementaciones que podrían
   divergir. Descartar gotas es UNA regla que las tres salidas comparten.
   ============================================================ */

const Airbrush = (() => {
  'use strict';

  const TAU = Math.PI * 2;

  /* Boquilla: semiancho de la banda pintada, en px. */
  const R_MIN = 4, R_MAX = 60;
  /* Densidad: gotas por cada 1000 px² de banda. */
  const DENSITY_MIN = 10, DENSITY_MAX = 120;
  /* Grano: diámetro de la gota. Es `lineWidth`, con el rango de siempre. */
  const GRAIN_MIN = 1, GRAIN_MAX = 8;
  /* Tope de gotas por elemento. Lo fija el SVG exportado, no el lienzo:
     agrupadas salen a ~35 bytes por gota, así que 6000 son ~210 KB por
     mancha. En lienzo, 6000 arc+fill rondan los 4 ms, y en sólido bastante
     menos (una sola ruta, un solo fill).
     Empezó en 3000 y se subió tras verlo en el navegador: con ese tope, un
     trazo largo a densidad alta topaba SIEMPRE, y lo que el usuario veía era
     una mancha que dejaba de espesar por mucho que subiera el mando.
     Es un OBJETIVO, no un corte exacto: el redondeo estocástico que reparte
     las fracciones entre tramos puede desviarse ±√n gotas. */
  const MAX_DOTS = 6000;
  /* Sesgo radial: 0.5 sería un disco uniforme (perfil plano de más) y 1 un
     núcleo duro. 0.75 deja la densidad areal como rho^(-2/3): decreciente
     pero integrable, y su sombra sobre la perpendicular —que es lo que se
     ve— es finita en el centro y llega suave a cero en el borde. */
  const SPREAD = 0.75;
  /* Cuánto adelgaza la gota hacia el borde: el difuminado se lee incluso
     con pocas gotas, sin gastar más gotas en conseguirlo. */
  const EDGE_FADE = 0.45;
  /* Lado mínimo del rectángulo de área: por debajo es un clic torpe. */
  const MIN_AREA = 24;

  /**
   * Valor en [0,1) determinista para (seed, segmento, gota, canal).
   * FUNCIÓN, no generador: por eso el número de gotas de un segmento puede
   * cambiar sin desplazar ni una sola gota de los demás (ver cabecera).
   */
  function _rnd(seed, seg, dot, ch) {
    let h = Math.imul((seed | 0) ^ 0x9e3779b1, 0x85ebca6b);
    h = Math.imul(h ^ (seg + 0x165667b1), 0xc2b2ae35);
    h = Math.imul(h ^ Math.imul(dot + 1, 0x27d4eb2f), 0x9e3779b1);
    h = Math.imul(h ^ (ch + 0x9e3779b9), 0x85ebca6b);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2545f491);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  const _num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback);
  const _pts = el => (Array.isArray(el && el.points) ? el.points : []);

  /** Longitud del eje: suma de los segmentos de la polilínea. */
  function axisLength(el) {
    const pts = _pts(el);
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return len;
  }

  /**
   * Gotas previstas ANTES del recorte, y si el tope las está limitando.
   * El modal lo usa para rotular «≈ N gotas» sin mentir cuando toca techo.
   */
  function estimate(el) {
    const R = Math.max(0, _num(el && el.radius, 0));
    const density = Math.max(0, _num(el && el.density, 0));
    const pts = _pts(el);
    if (!pts.length || !R || !density) return { dots: 0, capped: false };
    const raw = density * 2 * R / 1000 * axisLength(el) +
                density * Math.PI * R * R / 1000;
    return {
      dots: Math.min(MAX_DOTS, Math.round(raw)),
      capped: raw > MAX_DOTS,
    };
  }

  const _inClip = (c, x, y) =>
    x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;

  /**
   * Recorre la nube ya recortada llamando a cb(x, y, r) por gota. Es la
   * única implementación: `dots()` es esta más un push. El renderer usa
   * esta para no asignar miles de objetos en cada repintado.
   *
   * El tope NO corta con un `break`: degrada el ritmo con el factor `k`,
   * porque cortar dejaría el final del trazo en blanco en vez de adelgazar
   * la mancha entera.
   */
  function forEachDot(el, cb) {
    const pts = _pts(el);
    if (!pts.length) return;
    const R = _num(el.radius, 0);
    const density = _num(el.density, 0);
    if (!(R > 0) || !(density > 0)) return;
    const seed = _num(el.seed, 0) | 0;
    const grain = Math.max(0.5, _num(el.lineWidth, 2)) / 2;
    const clip = el.clip && typeof el.clip === 'object' ? el.clip : null;

    const rate = density * 2 * R / 1000;          // gotas por px de eje
    const caps = density * Math.PI * R * R / 1000; // las dos medias tapas
    const raw = rate * axisLength(el) + caps;
    const k = raw > MAX_DOTS ? MAX_DOTS / raw : 1;

    // Las tapas son pseudo-segmentos de longitud cero en cada extremo: dan
    // el soplo redondo del clic sin arrastre y rematan las puntas.
    const last = pts.length - 1;
    const emitSegment = (j, a, b, esperadas) => {
      let n = Math.floor(esperadas);
      // Redondeo estocástico determinista: sin él, un `ceil` forzaría una
      // gota por segmento y la decimación de 2 px del eje dispararía la
      // densidad real de los trazos finos.
      if (_rnd(seed, j, 0, 7) < esperadas - n) n++;
      for (let i = 0; i < n; i++) {
        const t = _rnd(seed, j, i, 0);
        const u = _rnd(seed, j, i, 1);
        const ang = _rnd(seed, j, i, 2) * TAU;
        const sz = _rnd(seed, j, i, 3);
        const rho = R * Math.pow(u, SPREAD);
        const x = a.x + (b.x - a.x) * t + Math.cos(ang) * rho;
        const y = a.y + (b.y - a.y) * t + Math.sin(ang) * rho;
        if (clip && !_inClip(clip, x, y)) continue;
        // La gota se recorta para que NO sobresalga del radio: la tinta acaba
        // exactamente en `R`, que es lo que el círculo del puntero rodea
        // (paintOverlay) y lo que anuncia el mando «Anchura». Se recorta el
        // TAMAÑO y no la posición del centro a propósito: acotar el centro a
        // `R - grano` también daría el borde exacto, pero como el grano no
        // escala con el dibujo, la banda efectiva dejaría de ser proporcional
        // y las gotas se recolocarían al redimensionar. Recortando el tamaño,
        // los centros siguen en `R·u^SPREAD` y el escalado sigue siendo afín
        // exacto. De regalo, el borde se difumina aún más.
        const r = Math.min(
          Math.max(0.35, grain * (1 - EDGE_FADE * (rho / R)) * (0.7 + 0.3 * sz)),
          R - rho,
        );
        if (r < 0.1) continue;   // gota invisible pegada al borde
        cb(x, y, r);
      }
    };

    emitSegment(-1, pts[0], pts[0], k * caps / 2);
    for (let j = 0; j < last; j++) {
      const a = pts[j], b = pts[j + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 0) emitSegment(j, a, b, k * rate * len);
    }
    emitSegment(last, pts[last], pts[last], k * caps / 2);
  }

  /** La nube ya recortada, como array. La usan exportadores y tests. */
  function dots(el) {
    const out = [];
    forEachDot(el, (x, y, r) => out.push({ x, y, r }));
    return out;
  }

  /** Caja del eje inflada en `radius`: la banda entera, sin recortar. */
  function bandBox(el) {
    const pts = _pts(el);
    if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
    const R = Math.max(0, _num(el.radius, 0));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX - R, y: minY - R, w: maxX - minX + R * 2, h: maxY - minY + R * 2 };
  }

  /**
   * Lo que realmente se ve: la banda intersecada con el área. Es lo que
   * devuelve `getElementBounds`, así que el marco de selección cubre la
   * tinta y el hit-test por caja deja de mentir. Con una intersección vacía
   * (solo alcanzable desde un JSON manipulado) se devuelve la banda: una
   * caja degenerada rompería el redimensionado y el marco.
   */
  function visibleBox(el) {
    const band = bandBox(el);
    const c = el && el.clip;
    if (!c || typeof c !== 'object') return band;
    const x1 = Math.max(band.x, c.x), y1 = Math.max(band.y, c.y);
    const x2 = Math.min(band.x + band.w, c.x + c.w);
    const y2 = Math.min(band.y + band.h, c.y + c.h);
    if (!(x2 > x1) || !(y2 > y1)) return band;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /**
   * ¿La nube recortada no pinta nada? La creación lo consulta para no dejar
   * un elemento invisible que cuente en «Elementos» y viaje en el JSON.
   */
  function isEmpty(el) {
    let any = false;
    forEachDot(el, () => { any = true; });
    return !any;
  }

  return {
    dots, forEachDot, estimate, axisLength, bandBox, visibleBox, isEmpty,
    R_MIN, R_MAX, DENSITY_MIN, DENSITY_MAX, GRAIN_MIN, GRAIN_MAX,
    MAX_DOTS, SPREAD, EDGE_FADE, MIN_AREA,
  };
})();
