/* ============================================================
   building.js — Geometría pura de la sección "Edificios" (exterior).
   Herramientas SOLO de creación: producen rect/line YA EXISTENTES (ningún
   tipo nuevo → renderer/exporter/isValidElement/bounds intactos). Objetos
   planos y serializables, sin `seed` (app.js lo pone con withSeeds) ni DOM.
     · Planta   : huella rect / L / U con jardín / claustro (elegida en modal)
     · Fachada  : muro multiplanta con ventanas y puerta
     · Alzado   : fachada con cubierta a dos aguas (alero, tejas, cumbrera, chimenea)
     · Perfil   : vista lateral con cubierta trapezoidal (cumbrera horizontal)
     · Tejados  : dos aguas / un agua / plano
   Diseño basado en el estudio de alzado (plano de arquitecto): el detalle
   (montantes, alféizares, tejas, impostas) usa TRAZO FINO; los contornos usan
   el trazo del usuario.
   ============================================================ */
const Building = (function () {
  'use strict';

  const MIN_SPAN  = 6;      // arrastre mínimo por eje; por debajo, tamaño por defecto
  const ROOF_FRAC = 0.36;   // fracción de altura del tejado en Alzado/Perfil
  const FLOOR_H   = 58;     // altura objetivo por planta (px)
  const FLOOR_MAX = 20;

  const DEFAULTS = {
    [TOOLS.BUILD_PLANTA]: { w: 180, h: 140 },
    [TOOLS.BUILD_FACADE]: { w: 150, h: 210 },
    [TOOLS.BUILD_ROOFF]:  { w: 190, h: 44  },
    [TOOLS.BUILD_ALZADO]: { w: 190, h: 300 },
    [TOOLS.BUILD_PERFIL]: { w: 150, h: 290 },
    [TOOLS.BUILD_ROOF2]:  { w: 160, h: 84  },
    [TOOLS.BUILD_ROOF1]:  { w: 160, h: 84  },
    [TOOLS.BUILD_DOOR]:   { w: 64,  h: 140 },
    [TOOLS.BUILD_WINDOW]: { w: 80,  h: 110 },
  };

  function elements(tool, p1, p2, opts) {
    const o = { color: '#000000', lineWidth: 2, ...(opts || {}) };
    const def = DEFAULTS[tool];
    if (!def) return [];
    const rawW = Math.abs(p2.x - p1.x), rawH = Math.abs(p2.y - p1.y);
    const b = {
      x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
      w: rawW >= MIN_SPAN ? rawW : def.w,
      h: rawH >= MIN_SPAN ? rawH : def.h,
    };
    switch (tool) {
      case TOOLS.BUILD_PLANTA: return _planta(b, o, o.plantaShape || 'rect');
      case TOOLS.BUILD_FACADE: return _facade(b, o);
      case TOOLS.BUILD_ALZADO: return _gable(b, o);
      case TOOLS.BUILD_PERFIL: return _profile(b, o);
      case TOOLS.BUILD_ROOF2:  return _roofGable(b, o);
      case TOOLS.BUILD_ROOF1:  return _roofMono(b, o);
      case TOOLS.BUILD_ROOFF:  return _rect(b, o);
      case TOOLS.BUILD_DOOR:   return _doorTool(b, o);
      case TOOLS.BUILD_WINDOW: return _windowTool(b, o);
      default: return [];
    }
  }

  /* ── primitivas ── */
  const _line = (x1, y1, x2, y2, o) =>
    ({ type: 'line', x1, y1, x2, y2, color: o.color, lineWidth: o.lineWidth });

  // Trazo fino para el detalle (montantes, alféizares, tejas, impostas).
  const _lineT = (x1, y1, x2, y2, o) =>
    ({ type: 'line', x1, y1, x2, y2, color: o.color,
       lineWidth: Math.max(1, Math.round((o.lineWidth || 2) * 0.55)) });

  const _rectEl = (x, y, w, h, o) =>
    ({ type: 'rect', x, y, w, h, color: o.color, lineWidth: o.lineWidth, fill: false });

  const _rect = (b, o) =>
    [{ type: 'rect', x: b.x, y: b.y, w: b.w, h: b.h,
       color: o.color, lineWidth: o.lineWidth, fill: false }];

  function _poly(pts, o) {                  // polilínea cerrada
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      out.push(_line(a[0], a[1], c[0], c[1], o));
    }
    return out;
  }

  const _wing = (w, h) => Math.max(1, Math.min(
    Math.max(10, Math.round(Math.min(w, h) * 0.28)),
    Math.floor(w / 2) - 1, Math.floor(h / 2) - 1,
  ));

  const _floorCount = bodyH =>
    Math.max(1, Math.min(FLOOR_MAX, Math.round(bodyH / FLOOR_H)));

  /* ── huecos de fachada ── */
  // Ventana vertical: marco + montante en cruz + alféizar.
  function _window(x, y, w, h, o) {
    return [
      _rectEl(x, y, w, h, o),
      _lineT(x + w / 2, y, x + w / 2, y + h, o),
      _lineT(x, y + h * 0.42, x + w, y + h * 0.42, o),
      _lineT(x - 2, y + h + 3, x + w + 2, y + h + 3, o),
    ];
  }
  // Puerta: hoja/marco + dintel de abanico + junta central.
  function _door(cx, baseY, w, h, o) {
    const x = cx - w / 2, y = baseY - h;
    return [
      _rectEl(x, y, w, h, o),
      _lineT(x, y + h * 0.2, x + w, y + h * 0.2, o),
      _lineT(cx, y + h * 0.2, cx, y + h, o),
    ];
  }
  // Despacho del botón Puerta según o.doorType (elegido en el modal).
  function _doorTool(b, o) {
    switch (o.doorType) {
      case 'arch':      return _archDoor(b, o, false);
      case 'archFrame': return _archDoor(b, o, true);
      case 'frame':     return _rect(b, o);              // marco rectangular
      default:          return _door(b.x + b.w / 2, b.y + b.h, b.w, b.h, o); // 'door'
    }
  }
  // Puerta con arco de medio punto: vano recto (altura ajustable con el arrastre)
  // + arco superior. El arco es un curveArrow (tipo existente) sembrado desde la
  // línea de imposta; con sagitta negativa comba hacia arriba (perpendicular
  // u=(-dy,dx) apunta hacia abajo en una cuerda horizontal). frameOnly deja solo
  // el marco (jambas + umbral + arco, sin imposta ni junta).
  function _archDoor(b, o, frameOnly) {
    const { x, y, w, h } = b, cx = x + w / 2;
    const rise = Math.min(w / 2, Math.max(4, h - 6));   // medio punto si cabe; segmental si es bajo
    const springY = y + rise, bottomY = y + h, bodyH = Math.max(2, h - rise);
    const els = [];
    if (frameOnly) {
      // Solo el marco: jambas + umbral + arco (sin imposta ni junta de hoja)
      els.push(
        _line(x, springY, x, bottomY, o),
        _line(x + w, springY, x + w, bottomY, o),
        _line(x, bottomY, x + w, bottomY, o),
      );
    } else {
      // Puerta con hoja: vano recto (jambas + umbral + imposta) + junta central
      els.push(
        _rectEl(x, springY, w, bodyH, o),
        _lineT(cx, springY, cx, springY + bodyH, o),
      );
    }
    const arc = ArcMath.arcCtrls(x, springY, x + w, springY, -rise);  // -rise: comba hacia arriba
    if (arc) els.push({
      type: 'curveArrow', x1: x, y1: springY, x2: x + w, y2: springY,
      cx: arc.cx, cy: arc.cy, cx2: arc.cx2, cy2: arc.cy2,
      arc: true, heads: 'none', color: o.color, lineWidth: o.lineWidth,
    });
    return els;
  }

  // Despacho del botón Ventana según o.windowType (elegido en el modal).
  function _windowTool(b, o) {
    switch (o.windowType) {
      case 'arch':      return _archWindow(b, o, false);
      case 'archFrame': return _archWindow(b, o, true);
      case 'frame':     return _rect(b, o);              // marco rectangular
      default:          return _window(b.x, b.y, b.w, b.h, o); // 'window'
    }
  }
  // Ventana con arco de medio punto: parte recta con montante en cruz + alféizar
  // bajo un arco superior (curveArrow). frameOnly deja solo el marco (jambas +
  // dintel inferior + arco, sin montantes ni alféizar).
  function _archWindow(b, o, frameOnly) {
    const { x, y, w, h } = b, cx = x + w / 2;
    const rise = Math.min(w / 2, Math.max(4, h - 6));
    const springY = y + rise, bottomY = y + h, bodyH = Math.max(2, h - rise);
    const els = [];
    if (frameOnly) {
      els.push(
        _line(x, springY, x, bottomY, o),
        _line(x + w, springY, x + w, bottomY, o),
        _line(x, bottomY, x + w, bottomY, o),
      );
    } else {
      els.push(
        _rectEl(x, springY, w, bodyH, o),
        _lineT(cx, springY, cx, bottomY, o),                               // montante vertical
        _lineT(x, springY + bodyH * 0.5, x + w, springY + bodyH * 0.5, o),  // travesaño
        _lineT(x - 2, bottomY + 3, x + w + 2, bottomY + 3, o),              // alféizar
      );
    }
    const arc = ArcMath.arcCtrls(x, springY, x + w, springY, -rise);
    if (arc) els.push({
      type: 'curveArrow', x1: x, y1: springY, x2: x + w, y2: springY,
      cx: arc.cx, cy: arc.cy, cx2: arc.cx2, cy2: arc.cy2,
      arc: true, heads: 'none', color: o.color, lineWidth: o.lineWidth,
    });
    return els;
  }

  // Ventanas por planta (verticales, acompasadas) + puerta centrada en PB.
  function _openings(x, y, w, h, n, o) {
    const els = [];
    const fh = h / n;
    const cols = Math.max(1, Math.min(4, Math.round(w / 74)));
    const mg = w * 0.13, slot = (w - 2 * mg) / cols;
    const winW = Math.min(slot * 0.52, fh * 0.4), winH = fh * 0.5;
    const doorW = Math.min(slot * 0.72, fh * 0.52), doorH = fh * 0.82;
    const cx = x + w / 2;
    if (winW <= 2 || winH <= 2) return els;      // demasiado pequeño para huecos
    for (let f = 0; f < n; f++) {
      const ground = f === n - 1;
      const wy = y + f * fh + (fh - winH) / 2 - fh * 0.04;
      for (let c = 0; c < cols; c++) {
        const wx = x + mg + c * slot + (slot - winW) / 2;
        if (ground && Math.abs(wx + winW / 2 - cx) < slot * 0.62) continue; // deja sitio a la puerta
        els.push(..._window(wx, wy, winW, winH, o));
      }
      if (ground && doorW > 2 && doorH > 2) els.push(..._door(cx, y + h, doorW, doorH, o));
    }
    return els;
  }

  /* ── tejas: líneas finas paralelas al alero (base→cumbre) ── */
  // edgeAt(s) devuelve [xIzq, xDer] del faldón a la altura s∈[0,1] (0=alero, 1=cumbre).
  function _tiles(yBase, yTop, edgeAt, o) {
    const span = yBase - yTop;
    const n = Math.max(2, Math.min(6, Math.round(span / 20)));
    const out = [];
    for (let i = 1; i < n; i++) {
      const s = i / n, y = yBase - s * span, e = edgeAt(s);
      if (e[1] - e[0] > 1) out.push(_lineT(e[0], y, e[1], y, o));
    }
    return out;
  }

  /* ── cuerpo de fachada: cornisa + muro + impostas + huecos + rasante ── */
  function _body(x, y, w, h, n, o) {
    const els = [
      _rectEl(x - 6, y - 8, w + 12, 8, o),                 // cornisa
      _rectEl(x, y, w, h, o),                              // muro
    ];
    const fh = h / n;
    for (let f = 1; f < n; f++) els.push(_lineT(x, y + f * fh, x + w, y + f * fh, o)); // impostas
    els.push(..._openings(x, y, w, h, n, o));
    els.push(_line(x - 20, y + h, x + w + 20, y + h, o));  // rasante
    return els;
  }

  /* ── cubiertas ── */
  // A dos aguas (alzado): alero volado + tejas + remate de cumbrera + chimenea.
  function _gableRoof(x, yBase, w, roofH, o) {
    const eave = Math.min(12, w * 0.06), apex = x + w / 2, topY = yBase - roofH;
    const L = x - eave, R = x + w + eave;
    const els = [
      _line(L, yBase, apex, topY, o),
      _line(apex, topY, R, yBase, o),
      _line(L, yBase, R, yBase, o),               // alero/fascia
      _lineT(apex, topY, apex, topY - 8, o),       // remate de cumbrera
      ..._tiles(yBase, topY, s => [L + s * (apex - L), R - s * (R - apex)], o),
    ];
    const chW = Math.max(8, Math.min(14, w * 0.055)), chx = x + w * 0.64;
    const chTop = yBase - roofH * 0.9, chBot = yBase - roofH * 0.35;
    if (chBot - chTop > 6) {
      els.push(_rectEl(chx, chTop, chW, chBot - chTop, o));      // chimenea
      els.push(_rectEl(chx - 3, chTop - 5, chW + 6, 5, o));      // sombrerete
    }
    return els;
  }
  // Perfil (vista lateral): faldón trapezoidal con cumbrera horizontal + tejas.
  function _trapRoof(x, yBase, w, roofH, o) {
    const eave = Math.min(10, w * 0.06), topY = yBase - roofH;
    const rl = x + w * 0.3, rr = x + w * 0.7, L = x - eave, R = x + w + eave;
    return [
      _line(L, yBase, rl, topY, o),
      _line(rl, topY, rr, topY, o),               // cumbrera horizontal
      _line(rr, topY, R, yBase, o),
      _line(L, yBase, R, yBase, o),               // alero
      ..._tiles(yBase, topY, s => [L + s * (rl - L), R - s * (R - rr)], o),
    ];
  }

  /* ── fachadas / alzados / perfiles ── */
  function _facade(b, o) {                          // fachada plana (sin cubierta a dos aguas)
    const n = _floorCount(b.h);
    return _body(b.x, b.y, b.w, b.h, n, o);
  }
  function _gable(b, o) {                           // alzado
    const roofH = b.h * ROOF_FRAC, topY = b.y + roofH, bodyH = b.h - roofH, n = _floorCount(bodyH);
    return [..._gableRoof(b.x, topY, b.w, roofH, o), ..._body(b.x, topY, b.w, bodyH, n, o)];
  }
  function _profile(b, o) {                         // perfil
    const roofH = b.h * ROOF_FRAC, topY = b.y + roofH, bodyH = b.h - roofH, n = _floorCount(bodyH);
    return [..._trapRoof(b.x, topY, b.w, roofH, o), ..._body(b.x, topY, b.w, bodyH, n, o)];
  }

  /* ── plantas (huellas top-down) ── */
  function _planta(b, o, shape) {
    switch (shape) {
      case 'l':        return _plantaL(b, o);
      case 'u':        return _plantaU(b, o);
      case 'claustro': return _plantaClaustro(b, o);
      default:         return _rect(b, o);          // 'rect'
    }
  }
  function _plantaU(b, o) {                  // U con jardín en el hueco (arriba)
    const t = _wing(b.w, b.h), { x, y, w, h } = b;
    return _poly([
      [x, y], [x + t, y], [x + t, y + h - t], [x + w - t, y + h - t],
      [x + w - t, y], [x + w, y], [x + w, y + h], [x, y + h],
    ], o);
  }
  function _plantaClaustro(b, o) {           // patio/claustro central
    const t = _wing(b.w, b.h);
    const iw = b.w - 2 * t, ih = b.h - 2 * t;
    const els = _rect(b, o);
    if (iw > 0 && ih > 0) els.push(..._rect({ x: b.x + t, y: b.y + t, w: iw, h: ih }, o));
    return els;
  }
  function _plantaL(b, o) {                  // dos alas en L
    const t = _wing(b.w, b.h), { x, y, w, h } = b;
    return _poly([
      [x, y], [x + t, y], [x + t, y + h - t], [x + w, y + h - t],
      [x + w, y + h], [x, y + h],
    ], o);
  }

  /* ── tejados sueltos (con tejas) ── */
  function _roofGable(b, o) {                // triángulo: 2 pendientes + base + tejas
    const ax = b.x + b.w / 2, baseY = b.y + b.h, half = b.w / 2;
    return [
      _line(b.x, baseY, ax, b.y, o),
      _line(ax, b.y, b.x + b.w, baseY, o),
      _line(b.x + b.w, baseY, b.x, baseY, o),
      ..._tiles(baseY, b.y, s => [b.x + s * half, b.x + b.w - s * half], o),
    ];
  }
  function _roofMono(b, o) {                 // triángulo rectángulo: 1 pendiente + tejas
    const baseY = b.y + b.h, rx = b.x + b.w;
    return [
      _line(b.x, baseY, rx, b.y, o),
      _line(rx, b.y, rx, baseY, o),
      _line(rx, baseY, b.x, baseY, o),
      ..._tiles(baseY, b.y, s => [b.x + s * b.w, rx], o),
    ];
  }

  return { elements, MIN_SPAN, ROOF_FRAC, FLOOR_H };
})();
