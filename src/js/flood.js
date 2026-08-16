/* ============================================================
   flood.js — Geometría pura del bote de pintura («Tinta»)

   Convierte un CLIC dentro de una zona cerrada por varios trazos —el rombo
   que forman dos líneas cruzadas, el caso canónico— en el contorno vectorial
   de esa zona, listo para nacer como un elemento `polygon`. La app no tiene
   ninguna representación de "la región entre unos trazos": aquí se descubre
   rasterizando, y se devuelve otra vez como vectores.

   LA FRONTERA DEL MÓDULO ES LO QUE LO HACE TESTEABLE

   Por aquí sólo cruzan `Uint8Array`, números y listas de {x,y}: nunca un
   ImageData, un contexto ni un elemento de escena. Rasterizar es cosa de
   app.js, que sí tiene canvas; aquí sólo se opera sobre la máscara binaria
   que sale de ese rasterizado. Por eso los tests construyen máscaras a mano
   (`new Uint8Array(w*h)`) y no hace falta ningún stub de canvas — el mismo
   reparto que usa eraser.js con su objeto `deps`.

   CUATRO DECISIONES QUE SOSTIENEN EL RESULTADO

   1) El contorno se extrae con MARCHING SQUARES, que recorre las *grietas*
      entre píxeles, no con un seguimiento de borde tipo Moore, que recorre
      centros. Tres motivos, y el tercero es el que decide: el borde sale a
      medio píxel exacto en vez de medio píxel adentro; un apéndice de 1 px
      —abundantísimo tras un flood contra trazos con antialias— se recorre
      de ida y vuelta sin caso especial, mientras que Moore necesita el
      criterio de parada de Jacob y aun así puede quedarse en bucle; y la
      salida son escaleras alineadas con los ejes, que es justo el input
      ideal de Douglas-Peucker (una escalera diagonal colapsa a un segmento
      EXACTO). Moore devuelve diagonales ya medio simplificadas y ruidosas
      que confunden a DP.

   2) El flood es 4-conexo y va POR TRAMOS horizontales, no píxel a píxel:
      la pila baja dos órdenes de magnitud y el lienzo entero (960 000
      celdas) se recorre en unos 11 ms. Y el escape corta en cuanto un tramo
      toca un borde, así que la zona ABIERTA —donde la pintura se escaparía—
      se detecta en microsegundos en vez de recorrer el papel entero.

   3) LA FISURA. El flood se detiene en el borde interior del trazo, así que
      el polígono nacería separado de la línea por una rendija de papel de
      medio grosor (más lo que se comiera el cierre de huecos). Se arregla
      DILATANDO la región antes de extraer el contorno (`inkRadius`), nunca
      desplazando los vértices hacia fuera: en un polígono cóncavo ese
      desplazamiento se autointerseca, mientras que engordar la máscara es
      topológicamente seguro por construcción. Pasarse es gratis —la mancha
      va DEBAJO de los trazos y el sobrante queda tapado—; quedarse corto se
      ve. La dilatación NO se recorta contra las barreras: precisamente
      queremos que la pintura se meta debajo del trazo.

   4) La dilatación es de Chebyshev (cuadrado), no de disco: es separable en
      dos pasadas de una dimensión, así que cuesta O(w·h·r) con doce líneas
      de código, y su única diferencia —ser algo más generosa en diagonal—
      juega a favor en una herramienta cuyo trabajo es cerrar huecos.

   Determinista y sin DOM: mismas entradas, mismos vértices.
   ============================================================ */

const Flood = (() => {
  'use strict';

  /* Umbral de alfa para considerar que un píxel es barrera. 16 de 255 (~6%)
     deja fuera el antialias de la punta de un trazo y las gotas más tenues
     del aerógrafo —incluirlas engorda cada línea medio píxel y deja pelusa
     en el contorno— y no llega a descartar un relleno translúcido legítimo,
     que empieza bastante más arriba. */
  const ALPHA_MIN = 16;

  /* Topes. Son defaults: los tests los bajan para ejercitar cada rama sin
     construir máscaras enormes. */
  const MIN_PIXELS = 9;       // menos que esto no es una zona, es ruido
  const MAX_VERTICES = 300;   // ~10 KB en el JSON y en el SVG; más no se ve
  const SNAP_CANDIDATES = 12; // topa el coste del empujón de semilla
  const EPS_MIN = 1.5;
  const EPS_MAX = 4;

  /* ── Máscara ── */

  /**
   * RGBA (el `.data` de un ImageData) → máscara binaria por ALFA. El color no
   * importa: lo que decide es que haya algo pintado, y el rasterizado se hace
   * sobre fondo transparente justamente para que el alfa sea esa respuesta.
   */
  function maskFromAlpha(data, w, h, alphaMin) {
    const min = alphaMin === undefined ? ALPHA_MIN : alphaMin;
    const mask = new Uint8Array(w * h);
    for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
      if (data[p] >= min) mask[i] = 1;
    }
    return mask;
  }

  /**
   * Dilatación de Chebyshev, separable: una pasada horizontal y otra
   * vertical. Con `r = 0` devuelve una COPIA (nunca la misma referencia: quien
   * la recibe la trata como suya y la muta).
   *
   * `box` (inclusivo) limita el trabajo a una ventana. Es lo que hace barata
   * la dilatación anti-fisura: una zona típica ocupa una fracción del lienzo,
   * y acotar baja el coste de ~40 ms a ~3 ms.
   */
  function dilate(mask, w, h, r, box) {
    const out = new Uint8Array(mask); // copia
    if (!r || r < 1) return out;
    const x0 = box ? Math.max(0, box.x0) : 0;
    const y0 = box ? Math.max(0, box.y0) : 0;
    const x1 = box ? Math.min(w - 1, box.x1) : w - 1;
    const y1 = box ? Math.min(h - 1, box.y1) : h - 1;

    // Horizontal: mask → tmp
    const tmp = new Uint8Array(mask);
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        if (mask[row + x]) continue;
        const a = Math.max(x0, x - r), b = Math.min(x1, x + r);
        for (let k = a; k <= b; k++) {
          if (mask[row + k]) { tmp[row + x] = 1; break; }
        }
      }
    }
    // Vertical: tmp → out
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        if (tmp[row + x]) { out[row + x] = 1; continue; }
        const a = Math.max(y0, y - r), b = Math.min(y1, y + r);
        for (let k = a; k <= b; k++) {
          if (tmp[k * w + x]) { out[row + x] = 1; break; }
        }
      }
    }
    return out;
  }

  /* ── Flood fill ── */

  /**
   * Píxeles libres alrededor de (sx, sy), en anillos de distancia creciente.
   * Con el cierre de huecos alto cada trazo se engorda varios píxeles, así que
   * pinchar "junto a" una línea cae dentro de barrera constantemente: sin este
   * empujón la herramienta se sentiría rota.
   *
   * Devuelve VARIOS candidatos, no el primero, porque el más cercano puede
   * estar al otro lado del trazo —en el papel abierto—, y entonces la pintura
   * se escaparía por una zona que el usuario no señaló. Quien llama los prueba
   * en orden y se queda con el primero que dé una zona cerrada; puede
   * permitírselo porque una fuga se detecta en cuanto un tramo toca el borde,
   * o sea en microsegundos.
   */
  function _nudgeCandidates(mask, w, h, sx, sy, radius, max) {
    const out = [];
    for (let r = 1; r <= radius && out.length < max; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (!mask[y * w + x]) out.push({ x, y });
          if (out.length >= max) break;
        }
        if (out.length >= max) break;
      }
    }
    return out;
  }

  /**
   * Flood 4-conexo por tramos horizontales desde (sx, sy).
   *
   * Qué pasa al llegar al borde del lienzo lo decide `allowEdge`:
   *  · sin él, alcanzarlo significa que la pintura se escapa y se aborta —el
   *    modo estricto, útil cuando lo que se quiere es exigir una zona cerrada;
   *  · con él, el borde es una frontera más y la zona se rellena hasta ahí.
   *
   * El bote de pintura usa el segundo, y es lo que permite pintar el fondo:
   * un lienzo vacío es, por definición, una zona abierta, así que en estricto
   * la herramienta se negaba a pintar en él — que es exactamente lo que un
   * bote de pintura tiene que saber hacer.
   */
  function floodRegion(mask, w, h, sx, sy, opts) {
    const o = opts || {};
    const x = Math.round(sx), y = Math.round(sy);
    if (x < 0 || y < 0 || x >= w || y >= h) return { ok: false, reason: 'escaped' };

    if (!mask[y * w + x]) return _fillFrom(mask, w, h, x, y, o);

    // El clic cayó sobre un trazo: se prueban los píxeles libres de alrededor,
    // del más cercano al más lejano, y gana el primero que dé una zona cerrada.
    const cands = o.snapRadius
      ? _nudgeCandidates(mask, w, h, x, y, o.snapRadius, o.snapCandidates || SNAP_CANDIDATES)
      : [];
    if (!cands.length) return { ok: false, reason: 'seed-blocked' };
    let last = null;
    for (const c of cands) {
      const res = _fillFrom(mask, w, h, c.x, c.y, o);
      if (res.ok) return res;
      last = res;
    }
    return last;
  }

  /** El relleno propiamente dicho, ya con una semilla que se sabe libre. */
  function _fillFrom(mask, w, h, x, y, o) {
    const minPixels = o.minPixels === undefined ? MIN_PIXELS : o.minPixels;
    const maxPixels = o.maxPixels === undefined ? w * h : o.maxPixels;
    const region = new Uint8Array(w * h);
    const stack = [x, y];
    let count = 0;
    let edge = false;
    let x0 = x, y0 = y, x1 = x, y1 = y;

    while (stack.length) {
      const py = stack.pop();
      const px = stack.pop();
      const row = py * w;
      if (region[row + px] || mask[row + px]) continue;

      // Extremos del tramo horizontal libre que contiene (px, py).
      let a = px;
      while (a > 0 && !mask[row + a - 1] && !region[row + a - 1]) a--;
      let b = px;
      while (b < w - 1 && !mask[row + b + 1] && !region[row + b + 1]) b++;

      // El tramo toca un lateral, o la fila es la primera o la última.
      if (a === 0 || b === w - 1 || py === 0 || py === h - 1) {
        if (!o.allowEdge) return { ok: false, reason: 'escaped' };
        edge = true;
      }

      for (let k = a; k <= b; k++) {
        region[row + k] = 1;
        count++;
      }
      if (count > maxPixels) return { ok: false, reason: 'too-large' };
      if (a < x0) x0 = a;
      if (b > x1) x1 = b;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;

      for (const ny of [py - 1, py + 1]) {
        // Acotar al lienzo es obligatorio desde que el borde puede ser una
        // frontera válida: en modo estricto tocarlo abortaba antes de llegar
        // aquí, pero con `allowEdge` una fila -1 se colaría en la pila, y como
        // `mask[negativo]` es `undefined` —falsy, o sea «libre»— el relleno
        // seguiría contando píxeles inexistentes para siempre.
        if (ny < 0 || ny >= h) continue;
        const nrow = ny * w;
        for (let k = a; k <= b; k++) {
          if (!mask[nrow + k] && !region[nrow + k]) stack.push(k, ny);
        }
      }
    }

    if (count < minPixels) return { ok: false, reason: 'too-small' };
    return { ok: true, region, count, edge, bounds: { x0, y0, x1, y1 }, seed: { x, y } };
  }

  /* ── Contorno ── */

  /**
   * Marching squares sobre la retícula de ESQUINAS de píxel. Devuelve el
   * contorno exterior del componente como ciclo cerrado (sin repetir el primer
   * punto) y con un vértice sólo donde cambia la dirección.
   *
   * Las coordenadas son de grieta, no de centro: la esquina (i, j) es el punto
   * (i, j) del lienzo, porque el píxel k cubre [k, k+1). No hay medio píxel
   * que corregir después.
   */
  function traceContour(region, w, h) {
    // Arranque: primer píxel en orden de barrido. Su esquina superior
    // izquierda tiene siempre el mismo patrón, así que el ciclo empieza
    // en un punto bien definido y termina al volver a él.
    let start = -1;
    for (let i = 0; i < region.length; i++) {
      if (region[i]) { start = i; break; }
    }
    if (start < 0) return [];
    const sx = start % w, sy = (start / w) | 0;

    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : region[y * w + x]);
    const pts = [];
    let cx = sx, cy = sy;      // esquina actual
    let dx = 0, dy = 0;        // dirección del paso anterior
    let pdx = NaN, pdy = NaN;  // para detectar el cambio de dirección
    const guard = 4 * w * h;

    for (let step = 0; step < guard; step++) {
      const ul = at(cx - 1, cy - 1), ur = at(cx, cy - 1);
      const ll = at(cx - 1, cy), lr = at(cx, cy);
      const s = ul | (ur << 1) | (ll << 2) | (lr << 3);

      switch (s) {
        case 1: case 5: case 13: dx = 0; dy = -1; break;
        case 2: case 3: case 7: dx = 1; dy = 0; break;
        case 4: case 12: case 14: dx = -1; dy = 0; break;
        case 8: case 10: case 11: dx = 0; dy = 1; break;
        // Sillas: dos diagonales opuestas. Se resuelven con la dirección que
        // se traía, que es lo que mantiene el recorrido dentro del mismo
        // componente en vez de saltar al vecino que sólo toca por la esquina.
        case 6: dx = dy === -1 ? 1 : -1; dy = 0; break;
        case 9: dy = dx === 1 ? -1 : 1; dx = 0; break;
        default: return pts; // 0 y 15 no ocurren partiendo del arranque
      }

      if (dx !== pdx || dy !== pdy) {
        pts.push({ x: cx, y: cy });
        pdx = dx; pdy = dy;
      }
      cx += dx; cy += dy;
      if (cx === sx && cy === sy) break;
    }
    return pts;
  }

  /* ── Simplificación ── */

  function _perpDist(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const len = Math.hypot(vx, vy);
    if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs((p.x - a.x) * vy - (p.y - a.y) * vx) / len;
  }

  function _dp(points, eps) {
    if (points.length < 3) return points.slice();
    const keep = new Uint8Array(points.length);
    keep[0] = 1; keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop();
      let far = -1, best = eps;
      for (let k = i + 1; k < j; k++) {
        const d = _perpDist(points[k], points[i], points[j]);
        if (d > best) { best = d; far = k; }
      }
      if (far > 0) {
        keep[far] = 1;
        stack.push([i, far], [far, j]);
      }
    }
    return points.filter((_, i) => keep[i]);
  }

  /**
   * Douglas-Peucker. Con `closed` la lista se trata como ANILLO: se parte en
   * dos cadenas por dos anclas estables (el primer punto y el más lejano a él)
   * y se recompone. Sin ese corte, DP sobre un anillo puede colapsarlo a un
   * triángulo degenerado, porque sus dos extremos son el mismo punto.
   */
  function simplify(points, eps, closed) {
    if (points.length < 4 || !(eps > 0)) return points.slice();
    if (!closed) return _dp(points, eps);

    let far = 0, best = -1;
    for (let i = 1; i < points.length; i++) {
      const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
      if (d > best) { best = d; far = i; }
    }
    const a = _dp(points.slice(0, far + 1), eps);
    // La segunda mitad se CIERRA volviendo al primer punto antes de
    // simplificarla. Sin ese cierre explícito su último vértice es el último
    // del anillo —un vértice legítimo— y al descartarlo por «repetido» se
    // perdía: un rectángulo salía con tres esquinas.
    const b = _dp(points.slice(far).concat([points[0]]), eps);
    // `far` abre la segunda mitad y el primer punto la cierra: los dos están
    // ya en la primera, así que se recortan.
    return a.concat(b.slice(1, b.length - 1));
  }

  /* ── Medidas ── */

  /** Área con signo (fórmula del cordón de zapato). */
  function polygonArea(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  }

  /**
   * Cuántas islas hay dentro de la región. Un `polygon` es un anillo único, así
   * que los agujeros quedarán pintados: contarlos es lo que permite avisar en
   * vez de que el usuario lo descubra al soltar el clic.
   *
   * Se inunda el complemento desde el marco del bbox inflado; lo que queda sin
   * visitar y sin región son las islas.
   */
  function countHoles(region, w, h, bounds) {
    const x0 = Math.max(0, bounds.x0 - 1), y0 = Math.max(0, bounds.y0 - 1);
    const x1 = Math.min(w - 1, bounds.x1 + 1), y1 = Math.min(h - 1, bounds.y1 + 1);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const seen = new Uint8Array(bw * bh);
    const idx = (x, y) => (y - y0) * bw + (x - x0);
    const stack = [];
    for (let x = x0; x <= x1; x++) { stack.push(x, y0, x, y1); }
    for (let y = y0; y <= y1; y++) { stack.push(x0, y, x1, y); }

    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < x0 || y < y0 || x > x1 || y > y1) continue;
      const i = idx(x, y);
      if (seen[i] || region[y * w + x]) continue;
      seen[i] = 1;
      stack.push(x - 1, y, x + 1, y, x, y - 1, x, y + 1);
    }

    let holes = 0;
    const done = new Uint8Array(bw * bh);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        if (seen[i] || done[i] || region[y * w + x]) continue;
        holes++;
        const st = [x, y];
        while (st.length) {
          const cy = st.pop(), cx = st.pop();
          if (cx < x0 || cy < y0 || cx > x1 || cy > y1) continue;
          const k = idx(cx, cy);
          if (done[k] || seen[k] || region[cy * w + cx]) continue;
          done[k] = 1;
          st.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1);
        }
      }
    }
    return holes;
  }

  /* ── Orquestador ── */

  /**
   * De un clic al contorno: flood, dilatación anti-fisura, marching squares y
   * simplificación. Recibe la máscara YA dilatada por el cierre de huecos —esa
   * dilatación se cachea entre clics del lado de app.js, y meterla aquí
   * obligaría a guardar estado oculto en un módulo que debe ser puro.
   *
   * `scale` sólo multiplica al final: existe como escotilla por si algún día
   * el lienzo es tan grande que haya que submuestrear. Hoy vale 1, y conviene
   * que siga valiendo 1 (a escala 2 los trazos de 1 px desaparecen de la
   * máscara y la pintura se escapa por donde no debe).
   */
  function trace(barriers, w, h, sx, sy, options) {
    const o = options || {};
    const scale = o.scale || 1;
    const maxVertices = o.maxVertices === undefined ? MAX_VERTICES : o.maxVertices;

    const res = floodRegion(barriers, w, h, sx, sy, {
      snapRadius: o.snapRadius || 0,
      snapCandidates: o.snapCandidates,
      minPixels: o.minPixels,
      maxPixels: o.maxPixels,
      allowEdge: o.allowEdge,
    });
    if (!res.ok) return { ok: false, reason: res.reason };

    const r = Math.max(0, Math.round(o.inkRadius || 0));
    const b = res.bounds;
    const box = r
      ? { x0: b.x0 - r - 1, y0: b.y0 - r - 1, x1: b.x1 + r + 1, y1: b.y1 + r + 1 }
      : null;
    const filled = r ? dilate(res.region, w, h, r, box) : res.region;

    const loop = traceContour(filled, w, h);
    if (loop.length < 3) return { ok: false, reason: 'too-small' };

    let eps = Math.min(EPS_MAX, Math.max(EPS_MIN, o.epsilon || EPS_MIN));
    let pts = simplify(loop, eps, true);
    for (let i = 0; i < 5 && pts.length > maxVertices; i++) {
      eps *= 1.6;
      pts = simplify(loop, eps, true);
    }
    if (pts.length < 3) return { ok: false, reason: 'too-small' };

    const clampX = v => Math.min(w * scale, Math.max(0, v * scale));
    const clampY = v => Math.min(h * scale, Math.max(0, v * scale));
    const points = pts.map(p => ({
      x: Math.round(clampX(p.x) * 10) / 10,
      y: Math.round(clampY(p.y) * 10) / 10,
    }));

    return {
      ok: true,
      points,
      // `edge` avisa de que la zona llega al borde del lienzo: es el fondo, no
      // un recinto. Quien llama lo usa para rotularlo y para colocarlo al
      // fondo del todo.
      edge: !!res.edge,
      count: res.count,
      bounds: res.bounds,
      seed: res.seed,
      holes: countHoles(res.region, w, h, res.bounds),
      epsilon: eps,
    };
  }

  return {
    maskFromAlpha, dilate, floodRegion, traceContour, simplify,
    polygonArea, countHoles, trace,
    ALPHA_MIN, MIN_PIXELS, MAX_VERTICES, EPS_MIN, EPS_MAX, SNAP_CANDIDATES,
  };
})();
