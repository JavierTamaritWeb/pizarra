/* ============================================================
   curve-path.js — Geometría compartida de flechas curvas
   ============================================================ */

const CurvePath = (() => {
  'use strict';

  const MAX_SEGMENTS = 200;

  function defaultCtrl(p1, p2, flip) {
    const k = flip ? -0.25 : 0.25;
    return {
      cx: (p1.x + p2.x) / 2 - (p2.y - p1.y) * k,
      cy: (p1.y + p2.y) / 2 + (p2.x - p1.x) * k,
    };
  }

  /** Convierte una curva histórica o encadenada en una lista de tramos. */
  function segments(el) {
    if (Array.isArray(el.segments)) return el.segments;
    return [{
      x1: el.x1, y1: el.y1,
      cx: el.cx, cy: el.cy,
      ...(el.cx2 !== undefined ? { cx2: el.cx2, cy2: el.cy2 } : {}),
      x2: el.x2, y2: el.y2,
    }];
  }

  function isChain(el) {
    return Array.isArray(el.segments);
  }

  function pointOnSegment(seg, t) {
    const mt = 1 - t;
    if (seg.cx2 !== undefined) {
      return {
        x: mt ** 3 * seg.x1 + 3 * mt * mt * t * seg.cx +
           3 * mt * t * t * seg.cx2 + t ** 3 * seg.x2,
        y: mt ** 3 * seg.y1 + 3 * mt * mt * t * seg.cy +
           3 * mt * t * t * seg.cy2 + t ** 3 * seg.y2,
      };
    }
    return {
      x: mt * mt * seg.x1 + 2 * mt * t * seg.cx + t * t * seg.x2,
      y: mt * mt * seg.y1 + 2 * mt * t * seg.cy + t * t * seg.y2,
    };
  }

  /**
   * Polilínea de muestreo en orden, compartida por hit-test y posición por
   * longitud. Cada entrada conserva el tramo/t local para poder editar labels.
   */
  function sample(el, perSegment = 20) {
    const segs = segments(el);
    if (!segs.length) return [];
    const out = [{ x: segs[0].x1, y: segs[0].y1, segment: 0, t: 0 }];
    segs.forEach((seg, index) => {
      for (let i = 1; i <= perSegment; i++) {
        out.push({ ...pointOnSegment(seg, i / perSegment), segment: index, t: i / perSegment });
      }
    });
    return out;
  }

  /** Punto en una fracción de la longitud aproximada del trazado completo. */
  function pointAt(el, ratio) {
    const pts = sample(el, 24);
    if (!pts.length) return { x: 0, y: 0 };
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
    const lengths = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lengths.push(d);
      total += d;
    }
    if (!total) return { x: pts[0].x, y: pts[0].y };
    let wanted = Math.max(0, Math.min(1, ratio)) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (wanted <= lengths[i] || i === lengths.length - 1) {
        const u = lengths[i] ? wanted / lengths[i] : 0;
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * u,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * u,
        };
      }
      wanted -= lengths[i];
    }
    return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
  }

  function bounds(el) {
    const segs = segments(el);
    const xs = [], ys = [];
    segs.forEach(seg => {
      xs.push(seg.x1, seg.cx, seg.x2);
      ys.push(seg.y1, seg.cy, seg.y2);
      if (seg.cx2 !== undefined) {
        xs.push(seg.cx2);
        ys.push(seg.cy2);
      }
    });
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function start(el) {
    const first = segments(el)[0];
    return { x: first.x1, y: first.y1 };
  }

  function end(el) {
    const segs = segments(el);
    const last = segs[segs.length - 1];
    return { x: last.x2, y: last.y2 };
  }

  function startTangent(el) {
    const seg = segments(el)[0];
    let dx = seg.x1 - seg.cx, dy = seg.y1 - seg.cy;
    if (!dx && !dy) { dx = seg.x1 - seg.x2; dy = seg.y1 - seg.y2; }
    return { dx, dy };
  }

  function endTangent(el) {
    const segs = segments(el);
    const seg = segs[segs.length - 1];
    const cx = seg.cx2 !== undefined ? seg.cx2 : seg.cx;
    const cy = seg.cy2 !== undefined ? seg.cy2 : seg.cy;
    let dx = seg.x2 - cx, dy = seg.y2 - cy;
    if (!dx && !dy) { dx = seg.x2 - seg.x1; dy = seg.y2 - seg.y1; }
    return { dx, dy };
  }

  function mapSegment(seg, map) {
    const p1 = map(seg.x1, seg.y1);
    const c1 = map(seg.cx, seg.cy);
    const p2 = map(seg.x2, seg.y2);
    const out = { x1: p1.x, y1: p1.y, cx: c1.x, cy: c1.y, x2: p2.x, y2: p2.y };
    if (seg.cx2 !== undefined) {
      const c2 = map(seg.cx2, seg.cy2);
      out.cx2 = c2.x;
      out.cy2 = c2.y;
    }
    return out;
  }

  function withSegments(el, next) {
    if (!next.length) return el;
    return {
      ...el,
      x1: next[0].x1,
      y1: next[0].y1,
      x2: next[next.length - 1].x2,
      y2: next[next.length - 1].y2,
      segments: next,
    };
  }

  function move(el, dx, dy) {
    if (!isChain(el)) return null;
    return withSegments(el, segments(el).map(seg =>
      mapSegment(seg, (x, y) => ({ x: x + dx, y: y + dy }))));
  }

  function scale(el, mapX, mapY) {
    if (!isChain(el)) return null;
    return withSegments(el, segments(el).map(seg =>
      mapSegment(seg, (x, y) => ({ x: mapX(x), y: mapY(y) }))));
  }

  /** Mueve solo un extremo y su control contiguo, conservando el resto. */
  function withEndpoint(el, which, point) {
    const next = segments(el).map(seg => ({ ...seg }));
    const index = which === 'start' ? 0 : next.length - 1;
    const seg = next[index];
    if (which === 'start') {
      const dx = point.x - seg.x1, dy = point.y - seg.y1;
      seg.x1 = point.x; seg.y1 = point.y;
      seg.cx += dx; seg.cy += dy;
    } else {
      const dx = point.x - seg.x2, dy = point.y - seg.y2;
      seg.x2 = point.x; seg.y2 = point.y;
      if (seg.cx2 !== undefined) { seg.cx2 += dx; seg.cy2 += dy; }
      else { seg.cx += dx; seg.cy += dy; }
    }
    return withSegments(el, next);
  }

  function withControl(el, index, point, second = false) {
    const next = segments(el).map(seg => ({ ...seg }));
    if (!next[index]) return el;
    if (second && next[index].cx2 !== undefined) {
      next[index].cx2 = point.x; next[index].cy2 = point.y;
    } else {
      next[index].cx = point.x; next[index].cy = point.y;
    }
    return withSegments(el, next);
  }

  /** Mueve una unión y traslada con ella los controles de ambos lados. */
  function withJoin(el, index, point) {
    const next = segments(el).map(seg => ({ ...seg }));
    if (!next[index] || !next[index + 1]) return el;
    const old = { x: next[index].x2, y: next[index].y2 };
    const dx = point.x - old.x, dy = point.y - old.y;
    next[index].x2 = point.x; next[index].y2 = point.y;
    next[index + 1].x1 = point.x; next[index + 1].y1 = point.y;
    if (next[index].cx2 !== undefined) {
      next[index].cx2 += dx; next[index].cy2 += dy;
    } else {
      next[index].cx += dx; next[index].cy += dy;
    }
    next[index + 1].cx += dx; next[index + 1].cy += dy;
    return withSegments(el, next);
  }

  function reflectPoint(px, py, seg) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len2 = dx * dx + dy * dy;
    if (!len2) return { x: px, y: py };
    const t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2;
    const fx = seg.x1 + dx * t, fy = seg.y1 + dy * t;
    return { x: 2 * fx - px, y: 2 * fy - py };
  }

  function flip(el) {
    if (!isChain(el)) return null;
    const next = segments(el).map(seg => {
      const c1 = reflectPoint(seg.cx, seg.cy, seg);
      const out = { ...seg, cx: c1.x, cy: c1.y };
      if (seg.cx2 !== undefined) {
        const c2 = reflectPoint(seg.cx2, seg.cy2, seg);
        out.cx2 = c2.x; out.cy2 = c2.y;
      }
      return out;
    });
    return withSegments(el, next);
  }

  function reverse(el) {
    if (!isChain(el)) return null;
    const next = segments(el).slice().reverse().map(seg => {
      const out = {
        x1: seg.x2, y1: seg.y2,
        cx: seg.cx, cy: seg.cy,
        x2: seg.x1, y2: seg.y1,
      };
      if (seg.cx2 !== undefined) {
        out.cx = seg.cx2; out.cy = seg.cy2;
        out.cx2 = seg.cx; out.cy2 = seg.cy;
      }
      return out;
    });
    return withSegments(el, next);
  }

  function isValidSegments(value, isNum) {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SEGMENTS) return false;
    for (let i = 0; i < value.length; i++) {
      const seg = value[i];
      if (!seg || typeof seg !== 'object' || Array.isArray(seg)) return false;
      if (![seg.x1, seg.y1, seg.cx, seg.cy, seg.x2, seg.y2].every(isNum)) return false;
      if ((seg.cx2 !== undefined || seg.cy2 !== undefined) &&
          !(isNum(seg.cx2) && isNum(seg.cy2))) return false;
      if (i && (seg.x1 !== value[i - 1].x2 || seg.y1 !== value[i - 1].y2)) return false;
    }
    return true;
  }

  return {
    MAX_SEGMENTS,
    defaultCtrl,
    segments,
    isChain,
    pointOnSegment,
    sample,
    pointAt,
    bounds,
    start,
    end,
    startTangent,
    endTangent,
    move,
    scale,
    withEndpoint,
    withControl,
    withJoin,
    flip,
    reverse,
    isValidSegments,
  };
})();
