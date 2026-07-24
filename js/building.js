/* ============================================================
   building.js — Geometría pura de la sección "Edificios" (exterior).
   Herramientas SOLO de creación: producen elementos YA EXISTENTES —rect, line,
   circle (óculos) y curveArrow (arcos, arc:true/heads:'none')— sin tipos nuevos
   (renderer/exporter/isValidElement/bounds intactos). Objetos planos y
   serializables, sin `seed` (app.js lo pone con withSeeds) ni DOM.
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
  const BAY_W     = 74;     // ancho objetivo por vano (columna de huecos en fachada)

  const DEFAULTS = {
    [TOOLS.BUILD_PLANTA]: { w: 180, h: 140 },
    [TOOLS.BUILD_FACADE]: { w: 170, h: 280 },
    [TOOLS.BUILD_ROOF]:   { w: 170, h: 90  },
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
      case TOOLS.BUILD_FACADE: return _facadeTool(b, o);
      case TOOLS.BUILD_ROOF:   return _roofTool(b, o);
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

  // Rect de detalle (paneles rehundidos): mismo trazo fino que _lineT.
  const _rectT = (x, y, w, h, o) =>
    ({ type: 'rect', x, y, w, h, color: o.color,
       lineWidth: Math.max(1, Math.round((o.lineWidth || 2) * 0.55)), fill: false });

  // Círculo/óculo (tipo 'circle' ya existente → elipse inscrita en la caja).
  const _circleEl = (x, y, w, h, o) =>
    ({ type: 'circle', x, y, w, h, color: o.color, lineWidth: o.lineWidth, fill: false });

  // Alféizar: repisa fina que sobresale un poco bajo la base del hueco (y+h).
  const _sill = (x, y, w, h, o) =>
    _lineT(x - 2, y + h + 3, x + w + 2, y + h + 3, o);

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

  // Nº de plantas: override explícito (o.floors numérico) o derivado de la altura.
  const _floorCount = (bodyH, floors) =>
    (typeof floors === 'number' && floors >= 1)
      ? Math.max(1, Math.min(FLOOR_MAX, Math.round(floors)))
      : Math.max(1, Math.min(FLOOR_MAX, Math.round(bodyH / FLOOR_H)));

  /* ── huecos de fachada ── */
  // Ventana vertical: marco + montante en cruz + alféizar.
  function _window(x, y, w, h, o) {
    return [
      _rectEl(x, y, w, h, o),
      _lineT(x + w / 2, y, x + w / 2, y + h, o),
      _lineT(x, y + h * 0.42, x + w, y + h * 0.42, o),
      _sill(x, y, w, h, o),
    ];
  }
  // Puerta: marco + dintel (recto) + junta central de la hoja.
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
      case 'arch':        return _archDoor(b, o, false);
      case 'archFrame':   return _archDoor(b, o, true);
      case 'frame':       return _rect(b, o);              // marco rectangular
      case 'double':      return _doubleDoor(b, o, false);
      case 'doubleFrame': return _doubleDoor(b, o, true);  // dos hojas, sin hoja
      case 'panel':       return _panelDoor(b, o);
      case 'garage':      return _garageDoor(b, o);
      default:            return _door(b.x + b.w / 2, b.y + b.h, b.w, b.h, o); // 'door'
    }
  }
  // Puerta doble: marco + montante central (dos hojas). frameOnly deja solo
  // marco + montante; con hoja añade dintel y sendos tiradores.
  function _doubleDoor(b, o, frameOnly) {
    const { x, y, w, h } = b, cx = x + w / 2;
    const els = [_rectEl(x, y, w, h, o), _line(cx, y, cx, y + h, o)];
    if (!frameOnly) {
      els.push(
        _lineT(x, y + h * 0.16, x + w, y + h * 0.16, o),                       // dintel
        _lineT(cx - w * 0.16, y + h * 0.52, cx - w * 0.16, y + h * 0.6, o),    // tirador izq
        _lineT(cx + w * 0.16, y + h * 0.52, cx + w * 0.16, y + h * 0.6, o),    // tirador der
      );
    }
    return els;
  }
  // Puerta de paneles: marco + dos paneles rehundidos (trazo fino).
  function _panelDoor(b, o) {
    const { x, y, w, h } = b;
    const els = [_rectEl(x, y, w, h, o)];
    const mx = Math.min(w * 0.18, w / 2 - 2), pw = w - 2 * mx;
    const gap = h * 0.06, top = y + h * 0.08, ph = (h * 0.84 - gap) / 2;
    if (pw > 2 && ph > 2) {
      els.push(_rectT(x + mx, top, pw, ph, o));
      els.push(_rectT(x + mx, top + ph + gap, pw, ph, o));
    }
    return els;
  }
  // Puerta de garaje/portón: marco + lamas horizontales (trazo fino).
  function _garageDoor(b, o) {
    const { x, y, w, h } = b;
    const els = [_rectEl(x, y, w, h, o)];
    const n = Math.max(3, Math.min(8, Math.round(h / 22)));
    for (let i = 1; i < n; i++) els.push(_lineT(x, y + h * i / n, x + w, y + h * i / n, o));
    return els;
  }
  // Hueco con arco de medio punto: parte recta (altura ajustable con el arrastre)
  // + arco superior. El arco es un curveArrow (tipo existente) sembrado desde la
  // línea de imposta; con sagitta negativa comba hacia arriba (perpendicular
  // u=(-dy,dx) apunta hacia abajo en una cuerda horizontal). frameOnly deja solo
  // el marco (jambas + umbral + arco). Con hoja: cross=false → junta central
  // (puerta); cross=true → montante + travesaño + alféizar (ventana).
  function _arched(b, o, { frameOnly, cross }) {
    const { x, y, w, h } = b, cx = x + w / 2;
    const rise = Math.min(w / 2, Math.max(4, h - 6));   // medio punto si cabe; segmental si es bajo
    const springY = y + rise, bottomY = y + h, bodyH = Math.max(2, h - rise);
    const els = [];
    if (frameOnly) {
      // Solo el marco: jambas + umbral + arco (sin hoja ni detalle interior)
      els.push(
        _line(x, springY, x, bottomY, o),
        _line(x + w, springY, x + w, bottomY, o),
        _line(x, bottomY, x + w, bottomY, o),
      );
    } else if (cross) {
      // Ventana con hoja: parte recta + montante en cruz + alféizar
      els.push(
        _rectEl(x, springY, w, bodyH, o),
        _lineT(cx, springY, cx, bottomY, o),
        _lineT(x, springY + bodyH * 0.5, x + w, springY + bodyH * 0.5, o),
        _sill(x, y, w, h, o),
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
  const _archDoor = (b, o, frameOnly) => _arched(b, o, { frameOnly, cross: false });

  // Despacho del botón Ventana según o.windowType (elegido en el modal).
  function _windowTool(b, o) {
    switch (o.windowType) {
      case 'arch':       return _archWindow(b, o, false);
      case 'archFrame':  return _archWindow(b, o, true);
      case 'frame':      return _rect(b, o);              // marco rectangular
      case 'double':     return _doubleWindow(b, o);
      case 'grid':       return _gridWindow(b, o);
      case 'round':      return _roundWindow(b, o, false); // óculo con cruz
      case 'roundFrame': return _roundWindow(b, o, true);  // óculo solo marco
      default:           return _window(b.x, b.y, b.w, b.h, o); // 'window'
    }
  }
  // Ventana de 2 hojas: marco + montante central (contorno) + travesaño + alféizar.
  function _doubleWindow(b, o) {
    const { x, y, w, h } = b;
    return [
      _rectEl(x, y, w, h, o),
      _line(x + w / 2, y, x + w / 2, y + h, o),               // montante central (dos hojas)
      _lineT(x, y + h * 0.5, x + w, y + h * 0.5, o),           // travesaño
      _sill(x, y, w, h, o),                                    // alféizar
    ];
  }
  // Ventana de cuadrícula (parteluces): marco + montantes/travesaños finos + alféizar.
  function _gridWindow(b, o) {
    const { x, y, w, h } = b;
    const cols = Math.max(2, Math.min(4, Math.round(w / 26)));
    const rows = Math.max(2, Math.min(5, Math.round(h / 26)));
    const els = [_rectEl(x, y, w, h, o)];
    for (let c = 1; c < cols; c++) els.push(_lineT(x + w * c / cols, y, x + w * c / cols, y + h, o));
    for (let r = 1; r < rows; r++) els.push(_lineT(x, y + h * r / rows, x + w, y + h * r / rows, o));
    els.push(_sill(x, y, w, h, o)); // alféizar
    return els;
  }
  // Óculo (ventana redonda): círculo inscrito + cruz (diámetros). frameOnly deja
  // solo el aro, sin la cruz.
  function _roundWindow(b, o, frameOnly) {
    const { x, y, w, h } = b;
    const els = [_circleEl(x, y, w, h, o)];
    if (!frameOnly) {
      els.push(
        _lineT(x + w / 2, y, x + w / 2, y + h, o),   // diámetro vertical
        _lineT(x, y + h / 2, x + w, y + h / 2, o),   // diámetro horizontal
      );
    }
    return els;
  }
  // Ventana con arco de medio punto (comparte geometría con la puerta de arco:
  // parte recta + montante en cruz + alféizar bajo el arco; frameOnly = solo marco).
  const _archWindow = (b, o, frameOnly) => _arched(b, o, { frameOnly, cross: true });

  // Umbral bajo el cual un subtipo rico de hueco (rejilla, arco, óculo…) queda
  // demasiado apretado en una fachada: por debajo se usa el hueco básico.
  const RICH_MIN = 18;
  // Ventana del tipo elegido (o.windowType) dimensionada al hueco; cae al básico
  // en huecos pequeños. Con el tipo por defecto reproduce _window (retrocompat).
  function _windowOfType(x, y, w, h, o) {
    if (o.windowType && o.windowType !== 'window' && (w < RICH_MIN || h < RICH_MIN))
      return _window(x, y, w, h, o);
    return _windowTool({ x, y, w, h }, o);
  }
  // Puerta del tipo elegido (o.doorType), anclada por centro-base como _door; cae
  // al básico en huecos pequeños. Con el tipo por defecto reproduce _door.
  function _doorOfType(cx, baseY, w, h, o) {
    if (o.doorType && o.doorType !== 'door' && (w < RICH_MIN || h < RICH_MIN))
      return _door(cx, baseY, w, h, o);
    return _doorTool({ x: cx - w / 2, y: baseY - h, w, h }, o);
  }

  // Ventanas por planta (verticales, acompasadas) + puerta centrada en PB.
  function _openings(x, y, w, h, n, o) {
    const els = [];
    const fh = h / n;
    const cols = (typeof o.bays === 'number' && o.bays >= 1)
      ? Math.max(1, Math.min(4, Math.round(o.bays)))
      : Math.max(1, Math.min(4, Math.round(w / BAY_W)));
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
        els.push(..._windowOfType(wx, wy, winW, winH, o));
      }
      if (ground && doorW > 2 && doorH > 2) els.push(..._doorOfType(cx, y + h, doorW, doorH, o));
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
  function _body(x, y, w, h, n, o, crown = true) {
    // La cornisa corona la fachada plana; con tejado encima (alzado/perfil) se
    // omite para no solaparse con el alero de la cubierta.
    const els = [];
    if (crown) els.push(_rectEl(x - 6, y - 8, w + 12, 8, o)); // cornisa
    els.push(_rectEl(x, y, w, h, o));                          // muro
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
  // Despacho del botón Fachada según o.facadeShape (elegido en el modal).
  function _facadeTool(b, o) {
    switch (o.facadeShape) {
      case 'gable':   return _gable(b, o);    // alzado frontal (cubierta a dos aguas / o.roofType)
      case 'profile': return _profile(b, o);  // perfil lateral (cubierta trapezoidal)
      default:        return _facade(b, o);   // 'flat': fachada plana
    }
  }
  function _facade(b, o) {                          // fachada plana (sin cubierta a dos aguas)
    const n = _floorCount(b.h, o.floors);
    return _body(b.x, b.y, b.w, b.h, n, o);
  }
  function _gable(b, o) {                           // alzado (cubierta según o.roofType)
    const roofH = b.h * (o.roofPitch || ROOF_FRAC), topY = b.y + roofH, bodyH = b.h - roofH, n = _floorCount(bodyH, o.floors);
    const roofBox = { x: b.x, y: b.y, w: b.w, h: roofH };
    const roof = o.roofType === 'hip' ? _roofHip(roofBox, o)
      : o.roofType === 'mansard' ? _roofMansard(roofBox, o)
      : _gableRoof(b.x, topY, b.w, roofH, o);       // 'gable' (default): dos aguas con alero+chimenea
    return [...roof, ..._body(b.x, topY, b.w, bodyH, n, o, false)];  // sin cornisa: el tejado corona
  }
  function _profile(b, o) {                         // perfil
    const roofH = b.h * (o.roofPitch || ROOF_FRAC), topY = b.y + roofH, bodyH = b.h - roofH, n = _floorCount(bodyH, o.floors);
    return [..._trapRoof(b.x, topY, b.w, roofH, o), ..._body(b.x, topY, b.w, bodyH, n, o, false)];
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
  // Despacho del botón Tejado según o.roofShape (elegido en el modal).
  function _roofTool(b, o) {
    switch (o.roofShape) {
      case 'mono':    return _roofMono(b, o);
      case 'flat':    return _rect(b, o);
      case 'hip':     return _roofHip(b, o);
      case 'mansard': return _roofMansard(b, o);
      default:        return _roofGable(b, o);  // 'gable'
    }
  }
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
  function _roofHip(b, o) {                  // 4 aguas: trapecio (cumbrera corta) + limatesas + tejas
    const baseY = b.y + b.h, R = b.x + b.w;
    const rl = b.x + b.w * 0.28, rr = b.x + b.w * 0.72;
    return [
      _line(b.x, baseY, rl, b.y, o),          // limatesa izquierda
      _line(rl, b.y, rr, b.y, o),              // cumbrera (corta)
      _line(rr, b.y, R, baseY, o),             // limatesa derecha
      _line(R, baseY, b.x, baseY, o),          // alero/base
      ..._tiles(baseY, b.y, s => [b.x + s * (rl - b.x), R - s * (R - rr)], o),
    ];
  }
  function _roofMansard(b, o) {              // mansarda: doble pendiente con quiebre + tejas
    const x = b.x, w = b.w, R = x + w, baseY = b.y + b.h, kneeY = b.y + b.h * 0.52;
    const klx = x + w * 0.12, krx = R - w * 0.12;      // quiebre (ancho)
    const tlx = x + w * 0.32, trx = R - w * 0.32;      // cumbrera (estrecha)
    return [
      _line(x, baseY, klx, kneeY, o),          // faldón inferior izq (empinado)
      _line(klx, kneeY, tlx, b.y, o),          // faldón superior izq (tendido)
      _line(tlx, b.y, trx, b.y, o),            // cumbrera
      _line(trx, b.y, krx, kneeY, o),          // faldón superior der
      _line(krx, kneeY, R, baseY, o),          // faldón inferior der
      _line(R, baseY, x, baseY, o),            // alero/base
      _lineT(klx, kneeY, krx, kneeY, o),       // línea de quiebre
      ..._tiles(baseY, kneeY, s => [x + s * (klx - x), R - s * (R - krx)], o),
    ];
  }

  return { elements, MIN_SPAN, ROOF_FRAC, FLOOR_H };
})();
