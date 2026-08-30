/* ============================================================
   building.js — Geometría pura de la sección "Edificios" (exterior).
   Herramientas SOLO de creación: producen elementos YA EXISTENTES —rect, line,
   circle (óculos) y curveArrow (arcos, arc:true/heads:'none')— sin tipos nuevos
   (renderer/exporter/isValidElement/bounds intactos). Objetos planos y
   serializables, sin `seed` (app.js lo pone con withSeeds) ni DOM.
     · Planta   : huella rect / L / U con jardín / claustro (elegida en modal)
     · Fachada  : muro multiplanta con ventanas y puerta
     · Alzado   : fachada con cubierta a dos aguas (alero, tejas, cumbrera, chimenea)
     · Perfil   : vista lateral con cubierta trapezoidal (cumbrera horizontal),
                  sin puerta y con las plantas acompasadas (el acceso va delante)
     · Tejados  : dos aguas / un agua / plano
     · Balcones : barandilla + losa volada en alzado, 8 tipos (francés, forja,
                  balaustrada, corrido, acristalado, terraza, mirador)
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

  // Muro: px por metro (una puerta mide ≈2 m ≈140 px con marco ⇒ ~65-70 px/m,
  // de ahí sale la escala) y tamaños de detalle de su textura/hueco. Los de la
  // piedra van EN METROS: la altura declarada fija la escala del dibujo, así
  // que el mampuesto de un muro de 2 m sale a la mitad de tamaño que el de uno
  // de 1 m dibujado igual de grande (ver _wallPxPerM).
  const WALL_M_PX          = 65;
  const WALL_COURSE_M      = 0.26; // alto de hilada, alzado (mampuesto corriente)
  const WALL_BLOCK_M       = 0.5;  // ancho medio de mampuesto, alzado
  const WALL_RAIL_H_MIN    = 0.3;  // alto de la verja sobre el remate (m)
  const WALL_RAIL_H_MAX    = 1.5;
  const WALL_RAIL_H_DEF    = 0.7;
  const STONE_TICK_GAP     = 26;  // separación del achurado, planta
  const WALL_GATE_W_SINGLE = 60;  // ancho de hueco, puerta de una hoja
  const WALL_GATE_W_DOUBLE = 100; // ancho de hueco, puerta de dos hojas
  const WALL_GATE_H_MIN    = 0.8; // alto de cancela, en metros (rango del deslizador)
  const WALL_GATE_H_MAX    = 3;
  const WALL_GATE_H_DEF    = 2;
  // Verja independiente: el modal trabaja en centímetros, tal como se acota
  // una cerrajería en proyecto. Cero conserva solo la línea de implantación.
  const FENCE_H_MIN_CM     = 0;
  const FENCE_H_MAX_CM     = 350;
  const FENCE_H_DEF_CM     = 180;
  const FENCE_PX_PER_CM    = 0.65;
  // Cancela independiente: comparte escala física con Verjas, pero tiene
  // estado propio porque sus hojas, pilastras y estilo se eligen aparte.
  const GATE_H_MIN_CM      = 0;
  const GATE_H_MAX_CM      = 350;
  const GATE_H_DEF_CM      = 200;
  const GATE_PX_PER_CM     = 0.65;

  /* Tamaño al hacer clic sin arrastrar. Una puerta o una ventana miden lo mismo
     sea cual sea su tipo, así que les basta una caja por herramienta; el balcón
     no —un mirador es alto y un balcón corrido es una franja—, y por eso es el
     único con `byVariant`, resuelto por `variantKey` (mismo recurso que
     js/garden.js, donde la variante manda en todas). */
  const DEFAULTS = {
    [TOOLS.BUILD_PLANTA]: { w: 180, h: 140 },
    [TOOLS.BUILD_FACADE]: { w: 170, h: 280 },
    [TOOLS.BUILD_ROOF]:   { w: 170, h: 90  },
    [TOOLS.BUILD_DOOR]:   { w: 64,  h: 140 },
    [TOOLS.BUILD_WINDOW]: { w: 80,  h: 110 },
    [TOOLS.BUILD_BALCONY]: { w: 120, h: 64, variantKey: 'balconyType', byVariant: {
      french:     { w: 88,  h: 78 },   // sin vuelo: es puro antepecho del hueco
      balustrade: { w: 140, h: 68 },
      long:       { w: 260, h: 62 },   // recorre varios vanos
      terrace:    { w: 180, h: 58 },
      mirador:    { w: 130, h: 100 },  // cuerpo cerrado y acristalado
    } },
    // Muro: la caja por defecto depende de DOS ejes (vista y altura), que
    // `variantKey`/`byVariant` solo resuelven por uno —de ahí `wallSizeKey`,
    // una clave sintética que se deriva AQUÍ (_wallSizeKey), no en app.js: el
    // icono de cada vista del catálogo debe nacer con SU caja aunque la vista
    // activa sea la otra.
    [TOOLS.BUILD_WALL]: { w: 200, h: 24, variantKey: 'wallSizeKey', byVariant: {
      plan1: { w: 200, h: 24 },
      plan2: { w: 200, h: 34 },   // un muro de 2 m tiene más canto también en planta
      h1: { w: 200, h: WALL_M_PX },
      h2: { w: 200, h: WALL_M_PX * 2 },
    } },
    [TOOLS.BUILD_FENCE]: { w: 200, h: FENCE_H_DEF_CM * FENCE_PX_PER_CM },
    [TOOLS.BUILD_GATE]:  { w: 180, h: GATE_H_DEF_CM * GATE_PX_PER_CM },
    // Iluminación: como el Balcón, el modelo manda en la proporción —una
    // farola de pared es casi cuadrada y una torre es un mástil—, así que la
    // caja del clic sin arrastre va por variante.
    [TOOLS.BUILD_LIGHT]: { w: 46, h: 190, variantKey: 'lightType', byVariant: {
      post2:  { w: 96,  h: 190 },
      forge2: { w: 96,  h: 190 },
      wall:   { w: 74,  h: 78  },   // cuelga del muro: ni fuste ni base
      spot:   { w: 62,  h: 74  },
      tower:  { w: 88,  h: 260 },
    } },
  };

  const _wallHeightM = o => (Number(o.wallHeight) === 2 ? 2 : 1);
  const _wallSizeKey = o => (o.wallView === 'elevation' ? 'h' : 'plan') + _wallHeightM(o);
  const _fenceHeightCm = o => {
    const v = Number(o.fenceHeightCm);
    return Math.min(FENCE_H_MAX_CM,
      Math.max(FENCE_H_MIN_CM, Number.isFinite(v) ? v : FENCE_H_DEF_CM));
  };
  const _gateHeightCm = o => {
    const v = Number(o.gateHeightCm);
    return Math.min(GATE_H_MAX_CM,
      Math.max(GATE_H_MIN_CM, Number.isFinite(v) ? v : GATE_H_DEF_CM));
  };

  function elements(tool, p1, p2, opts) {
    const o = { color: '#000000', lineWidth: 2, ...(opts || {}) };
    const base = DEFAULTS[tool];
    if (!base) return [];
    if (tool === TOOLS.BUILD_WALL) o.wallSizeKey = _wallSizeKey(o);
    const def = (base.byVariant && base.byVariant[o[base.variantKey]]) || base;
    const rawW = Math.abs(p2.x - p1.x), rawH = Math.abs(p2.y - p1.y);
    let b = {
      x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
      w: rawW >= MIN_SPAN ? rawW : def.w,
      h: rawH >= MIN_SPAN ? rawH : def.h,
    };
    // En Verjas el arrastre fija la longitud; la altura procede siempre del
    // control 0–350 cm. Así una verja de 120 cm no cambia de escala física
    // según cuánto se desvíe verticalmente el puntero al trazarla.
    if (tool === TOOLS.BUILD_FENCE) {
      const cm = _fenceHeightCm(o);
      const h = o.fenceView === 'plan'
        ? (cm === 0 ? 1 : Math.max(7, Math.min(18, 7 + cm / 35)))
        : (cm === 0 ? 1 : Math.max(12, cm * FENCE_PX_PER_CM));
      b = { ...b, h };
    }
    // En Cancela el arrastre determina solo el ancho. La cota 0–350 cm manda
    // en el alto, igual que en Verjas; en planta se traduce a la profundidad
    // gráfica de pilastras y hojas.
    if (tool === TOOLS.BUILD_GATE) {
      const cm = _gateHeightCm(o);
      const h = o.gateView === 'plan'
        ? (cm === 0 ? 1 : Math.max(8, Math.min(20, 8 + cm / 30)))
        : (cm === 0 ? 1 : Math.max(12, cm * GATE_PX_PER_CM));
      b = { ...b, h };
    }
    switch (tool) {
      case TOOLS.BUILD_PLANTA: return _planta(b, o, o.plantaShape || 'rect');
      case TOOLS.BUILD_FACADE: return _facadeTool(b, o);
      case TOOLS.BUILD_ROOF:   return _roofTool(b, o);
      case TOOLS.BUILD_DOOR:   return _doorTool(b, o);
      case TOOLS.BUILD_WINDOW: return _windowTool(b, o);
      case TOOLS.BUILD_BALCONY: return _balconyTool(b, o);
      case TOOLS.BUILD_WALL:   return _wallTool(b, o);
      case TOOLS.BUILD_FENCE:  return _fenceTool(b, o);
      case TOOLS.BUILD_GATE:   return _gateTool(b, o);
      case TOOLS.BUILD_LIGHT:  return _lightTool(b, o);
      default: return [];
    }
  }

  /* ── primitivas ── */
  const _line = (x1, y1, x2, y2, o) =>
    ({ type: 'line', x1, y1, x2, y2, color: o.color, lineWidth: o.lineWidth });

  // Grosor del detalle: 0.55× el trazo del usuario, nunca menos de 1 px.
  const _thinW = o => Math.max(1, Math.round((o.lineWidth || 2) * 0.55));

  // Trazo fino para el detalle (montantes, alféizares, tejas, impostas).
  const _lineT = (x1, y1, x2, y2, o) =>
    ({ type: 'line', x1, y1, x2, y2, color: o.color, lineWidth: _thinW(o) });

  const _rectEl = (x, y, w, h, o) =>
    ({ type: 'rect', x, y, w, h, color: o.color, lineWidth: o.lineWidth, fill: false });

  // Rect de detalle (paneles rehundidos): mismo trazo fino que _lineT.
  const _rectT = (x, y, w, h, o) =>
    ({ type: 'rect', x, y, w, h, color: o.color, lineWidth: _thinW(o), fill: false });

  // Círculo/óculo (tipo 'circle' ya existente → elipse inscrita en la caja).
  const _circleEl = (x, y, w, h, o) =>
    ({ type: 'circle', x, y, w, h, color: o.color, lineWidth: o.lineWidth, fill: false });

  // Círculo de detalle (rosetas de la forja): trazo fino, como _lineT.
  const _circleT = (x, y, w, h, o) =>
    ({ type: 'circle', x, y, w, h, color: o.color, lineWidth: _thinW(o), fill: false });

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
  // `side` = vista lateral (Perfil): un canto no tiene el acceso principal, así
  // que no lleva puerta y su planta baja se acompasa como las demás (ritmo
  // uniforme, sin el hueco central que la fachada deja para la entrada).
  function _openings(x, y, w, h, n, o, side) {
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
      const ground = !side && f === n - 1;       // en perfil no hay planta de acceso
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
  function _body(x, y, w, h, n, o, crown = true, side = false) {
    // La cornisa corona la fachada plana; con tejado encima (alzado/perfil) se
    // omite para no solaparse con el alero de la cubierta. `side` = vista
    // lateral: los huecos van sin puerta (ver _openings).
    const els = [];
    if (crown) els.push(_rectEl(x - 6, y - 8, w + 12, 8, o)); // cornisa
    els.push(_rectEl(x, y, w, h, o));                          // muro
    const fh = h / n;
    for (let f = 1; f < n; f++) els.push(_lineT(x, y + f * fh, x + w, y + f * fh, o)); // impostas
    els.push(..._openings(x, y, w, h, n, o, side));
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
  // Perfil (canto del edificio): sin cornisa (la corona el tejado) y sin puerta
  // —el acceso principal está en la fachada, no en el lateral—, con las plantas
  // acompasadas de arriba abajo.
  function _profile(b, o) {
    const roofH = b.h * (o.roofPitch || ROOF_FRAC), topY = b.y + roofH, bodyH = b.h - roofH, n = _floorCount(bodyH, o.floors);
    return [..._trapRoof(b.x, topY, b.w, roofH, o), ..._body(b.x, topY, b.w, bodyH, n, o, false, true)];
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

  /* ── balcones (alzado) ──────────────────────────────────────────────
     La caja del arrastre es el balcón ENTERO: la barandilla ocupa la parte
     alta y la losa es la banda del fondo. El vuelo —lo que sobresale del hueco
     al que sirve— se sale de la caja por los lados, como el alero de un tejado
     o la cornisa de una fachada. */

  const BAR_GAP = 13;                                           // separación objetivo entre barrotes
  const _flight  = w => Math.min(10, Math.max(3, w * 0.06));    // vuelo lateral de la losa
  const _slabH   = h => Math.min(16, Math.max(5, h * 0.15));    // canto de la losa
  const _railTop = h => Math.min(8,  Math.max(3, h * 0.09));    // canto del pasamanos
  const _barCount = (w, gap) => Math.max(2, Math.min(20, Math.round(w / gap)));

  // Losa volada: banda inferior de la caja, sobresaliendo `ov` por cada lado.
  const _slab = (b, o, ov) =>
    _rectEl(b.x - ov, b.y + b.h - _slabH(b.h), b.w + 2 * ov, _slabH(b.h), o);

  /**
   * Barandilla: pasamanos (contorno) + barrotes y travesaño inferior (finos).
   * `bar(t, x, y1, y2)` sustituye el barrote recto —la forja los quiere
   * abombados— y `gap` aprieta el ritmo. Con muy poca altura se queda en el
   * pasamanos: unos barrotes de 2 px no se leen y solo ensucian.
   */
  function _railing(x, y, w, h, o, bar, gap) {
    const hr = _railTop(h);
    const els = [_rectEl(x, y, w, hr, o)];
    const top = y + hr, bot = y + h;
    if (bot - top > 3) {
      const n = _barCount(w, gap || BAR_GAP);
      for (let i = 1; i < n; i++) {
        const bx = x + w * i / n;
        els.push(bar ? bar(i / n, bx, top, bot) : _lineT(bx, top, bx, bot, o));
      }
      els.push(_lineT(x, bot - (bot - top) * 0.16, x + w, bot - (bot - top) * 0.16, o));
    }
    return els;
  }

  // Despacho del botón Balcón según o.balconyType (elegido en el modal).
  function _balconyTool(b, o) {
    switch (o.balconyType) {
      case 'french':     return _balconyFrench(b, o);
      case 'iron':       return _balconyIron(b, o);
      case 'balustrade': return _balconyBalustrade(b, o);
      case 'long':       return _balconyLong(b, o);
      case 'glass':      return _balconyGlass(b, o);
      case 'terrace':    return _balconyTerrace(b, o);
      case 'mirador':    return _balconyMirador(b, o);
      default:           return _balconyPlain(b, o);   // 'balcony'
    }
  }

  // Balcón de barrotes: barandilla recta sobre losa volada.
  function _balconyPlain(b, o) {
    const railH = Math.max(4, b.h - _slabH(b.h));
    return [..._railing(b.x, b.y, b.w, railH, o), _slab(b, o, _flight(b.w))];
  }

  // Balcón francés (balconera): no vuela, así que no lleva losa —es lo que lo
  // distingue de un balcón a secas—. Va sujeto al hueco por dos anclajes
  // laterales y su base es el propio antepecho.
  function _balconyFrench(b, o) {
    const els = _railing(b.x, b.y, b.w, b.h, o);
    els.push(_line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, o));   // base
    // Anclajes al muro, a la altura del pasamanos y del pie: dos por lado, o se
    // leerían como suciedad en vez de como los tornillos que sujetan la reja.
    const a = Math.min(11, Math.max(4, b.w * 0.11));
    const L = b.x, R = b.x + b.w;
    for (const ay of [b.y + _railTop(b.h) / 2, b.y + b.h]) {
      els.push(_line(L - a, ay, L, ay, o), _line(R, ay, R + a, ay, o));
    }
    return els;
  }

  // Balcón de forja: barrotes abombados (la "panza") y más apretados, con
  // travesaño a media altura. La panza se reparte desde el centro —el barrote
  // central sale recto y los de los extremos son los que más comban—, que es
  // como se lee de frente una barandilla curva.
  function _balconyIron(b, o) {
    const railH = Math.max(4, b.h - _slabH(b.h));
    const amp = Math.min(8, Math.max(2, b.w * 0.05));
    const bar = (t, x, y1, y2) => {
      const arc = ArcMath.arcCtrls(x, y1, x, y2, -(t - 0.5) * 2 * amp);  // t<0.5 → comba a la izquierda
      return arc
        ? { type: 'curveArrow', x1: x, y1, x2: x, y2,
            cx: arc.cx, cy: arc.cy, cx2: arc.cx2, cy2: arc.cy2,
            arc: true, heads: 'none', color: o.color, lineWidth: _thinW(o) }
        : _lineT(x, y1, x, y2, o);                                       // barrote central: recto
    };
    const els = _railing(b.x, b.y, b.w, railH, o, bar, 9);
    if (railH > 12) els.push(_lineT(b.x, b.y + railH * 0.46, b.x + b.w, b.y + railH * 0.46, o));
    els.push(_slab(b, o, _flight(b.w)));
    return els;
  }

  // Balaustrada: pasamanos y zócalo macizos con balaustres torneados (la panza
  // es un círculo, el cuello y el pie son trazo fino).
  function _balconyBalustrade(b, o) {
    const railH = Math.max(6, b.h - _slabH(b.h));
    const hr = _railTop(railH), base = Math.max(2, railH * 0.14);
    const top = b.y + hr, bot = b.y + railH - base;
    const els = [
      _rectEl(b.x, b.y, b.w, hr, o),                       // pasamanos
      _rectEl(b.x, b.y + railH - base, b.w, base, o),      // zócalo
    ];
    const n = Math.max(2, Math.min(12, Math.round(b.w / 18)));
    const bw = Math.min((b.w / n) * 0.62, (bot - top) * 0.55), bh = (bot - top) * 0.5;
    if (bw > 1.5 && bh > 1.5) {
      for (let i = 0; i < n; i++) {
        const cx = b.x + b.w * (i + 0.5) / n, by = top + (bot - top) * 0.32;
        els.push(_circleEl(cx - bw / 2, by, bw, bh, o));    // panza torneada
        els.push(_lineT(cx, top, cx, by, o));               // cuello
        els.push(_lineT(cx, by + bh, cx, bot, o));          // pie
      }
    }
    els.push(_slab(b, o, _flight(b.w)));
    return els;
  }

  // Balcón corrido: la losa recorre varios vanos y se apoya en ménsulas
  // (canecillos) repartidas por debajo. Los barrotes van más espaciados que en
  // un balcón suelto: al triple de largo, el ritmo corto se emborrona.
  function _balconyLong(b, o) {
    const railH = Math.max(4, b.h - _slabH(b.h));
    const els = [..._railing(b.x, b.y, b.w, railH, o, null, 19), _slab(b, o, _flight(b.w))];
    const slabBot = b.y + b.h;
    // Ménsula ancha y poco profunda: en punta parecería una punta de flecha.
    const mh = Math.min(13, Math.max(4, b.h * 0.16)), mw = mh * 1.8;
    const n = Math.max(2, Math.min(6, Math.round(b.w / 70)));
    for (let i = 0; i < n; i++) {
      const cx = b.x + b.w * (i + 0.5) / n;
      els.push(_line(cx - mw / 2, slabBot, cx, slabBot + mh, o),
               _line(cx, slabBot + mh, cx + mw / 2, slabBot, o));
    }
    return els;
  }

  // Balcón acristalado: paño de vidrio bajo el pasamanos, con montantes en los
  // extremos y el par de diagonales con que se indica el vidrio en un alzado.
  function _balconyGlass(b, o) {
    const railH = Math.max(4, b.h - _slabH(b.h));
    const hr = _railTop(railH);
    const els = [_rectEl(b.x, b.y, b.w, hr, o)];             // pasamanos
    const gy = b.y + hr, gh = railH - hr;
    const inset = Math.min(3, b.w * 0.04);
    const gx = b.x + inset, gw = b.w - 2 * inset;
    if (gh > 3 && gw > 2) {
      els.push(_rectEl(gx, gy, gw, gh, o));                  // paño
      const cols = Math.max(1, Math.min(4, Math.round(gw / 55)));
      for (let c = 1; c < cols; c++) {
        const mx = gx + gw * c / cols;
        els.push(_line(mx, gy, mx, gy + gh, o));             // montante entre paños
      }
      const d = Math.min(gh * 0.7, gw * 0.28);
      if (d > 2) {
        const bx = gx + gw * 0.12, by = gy + gh * 0.9;
        els.push(_lineT(bx, by, bx + d, by - d, o));         // brillo del vidrio
        els.push(_lineT(bx + d * 0.55, by, bx + d * 1.55, by - d, o));
      }
    }
    els.push(_slab(b, o, _flight(b.w)));
    return els;
  }

  // Terraza: antepecho macizo con albardilla (la tapa que lo corona) y un
  // recuadro rehundido. Sin barrotes: eso es lo que la separa de un balcón.
  function _balconyTerrace(b, o) {
    const ov = _flight(b.w);
    const railH = Math.max(4, b.h - _slabH(b.h));
    const cap = Math.min(7, Math.max(2, railH * 0.18)), co = Math.max(2, ov * 0.5);
    const els = [_rectEl(b.x - co, b.y, b.w + 2 * co, cap, o)];   // albardilla
    const bodyH = railH - cap;
    if (bodyH > 1) {
      els.push(_rectEl(b.x, b.y + cap, b.w, bodyH, o));           // antepecho
      const mx = Math.min(b.w * 0.1, 14), my = Math.min(bodyH * 0.22, 8);
      if (b.w - 2 * mx > 2 && bodyH - 2 * my > 2) {
        els.push(_rectT(b.x + mx, b.y + cap + my, b.w - 2 * mx, bodyH - 2 * my, o));
      }
    }
    els.push(_slab(b, o, ov));
    return els;
  }

  // Mirador: el balcón cerrado y acristalado, con su tejadillo. El tejadillo
  // vuela por encima de la caja, igual que el alero de un tejado.
  function _balconyMirador(b, o) {
    const ov = _flight(b.w);
    const bodyH = Math.max(6, b.h - _slabH(b.h));
    const els = [_rectEl(b.x, b.y, b.w, bodyH, o)];              // cuerpo acristalado
    const n = Math.max(2, Math.min(6, Math.round(b.w / 34)));
    for (let i = 1; i < n; i++) {
      const mx = b.x + b.w * i / n;
      els.push(_lineT(mx, b.y, mx, b.y + bodyH, o));             // montantes
    }
    els.push(_lineT(b.x, b.y + bodyH * 0.62, b.x + b.w, b.y + bodyH * 0.62, o));  // antepecho
    const rh = Math.min(18, Math.max(5, b.h * 0.16)), eave = ov + 3, apex = b.x + b.w / 2;
    els.push(
      _line(b.x - eave, b.y, apex, b.y - rh, o),                 // tejadillo
      _line(apex, b.y - rh, b.x + b.w + eave, b.y, o),
      _line(b.x - eave, b.y, b.x + b.w + eave, b.y, o),          // alero
    );
    els.push(_slab(b, o, ov));
    return els;
  }

  /* ── muros perimetrales (planta + alzado) ──────────────────────────
     Único tool de Edificios con dos vistas propias (como Fachada, pero aquí
     una es en planta): `o.wallView` despacha entre el contorno visto desde
     arriba y el paño visto de frente. Material, verja y puerta son ejes
     ortogonales a la vista, no variantes de silueta —viven en o.wallMaterial/
     wallRailing/wallGateType, ajustes propios del modal, no en un catálogo—.
     Los CUATRO se ven en las dos vistas: un ajuste que solo pinta en una mitad
     del catálogo acaba deshabilitado justo cuando se quiere tocar. */

  function _wallTool(b, o) {
    return o.wallView === 'elevation' ? _wallElevation(b, o) : _wallPlan(b, o);
  }

  /* Escala del dibujo: la altura declarada repartida sobre lo que el muro mide
     en pantalla. Es lo que hace que "2 m" se note SIEMPRE y no solo al hacer
     clic sin arrastrar: a igual tamaño dibujado, el doble de altura son
     hiladas y mampuestos la mitad de grandes. Solo tiene sentido en alzado
     (en planta no hay eje vertical que repartir). */
  const _wallPxPerM = (b, o) => Math.max(6, b.h / _wallHeightM(o));

  /* Ruido determinista en [0,1): building.js no usa Math.random —el temblor lo
     pone Sketchy con el seed del elemento— pero la piedra necesita ser
     irregular, y esa irregularidad debe salir idéntica en el icono, la
     miniatura, la previsualización del arrastre y el trazo comprometido. */
  function _noise(i, j) {
    const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // Hueco de la entrada, centrado en la caja: el vano libre (gx, gw) más el
  // ancho de pilastra (pw) y el tramo completo que el paso ocupa en el muro
  // (x1..x2, pilastras incluidas) —de él se apartan la textura, la verja y el
  // propio paño—. null si no hay puerta o si no cabe con un margen mínimo.
  function _wallGateRange(b, o) {
    if (!['single', 'double', 'concave', 'concaveSwan',
      'concavePanel', 'concaveOrnate', 'concaveFan', 'concaveLyre',
      'concaveDiamond', 'concaveRings', 'concavePalmette',
      'convexPanel', 'convexFan', 'convexMedallion',
      'convexBlind', 'solidTransom', 'openBars',
      'openScrolls'].includes(o.wallGateType)) return null;
    const gw = Math.min(b.w * 0.5, o.wallGateType === 'single' ? WALL_GATE_W_SINGLE : WALL_GATE_W_DOUBLE);
    const pw = Math.max(3, Math.min(14, gw * 0.14));
    if (gw < 16 || b.w - gw - 2 * pw < 20) return null;
    const gx = b.x + (b.w - gw) / 2;
    return { gx, gw, pw, x1: gx - pw, x2: gx + gw + pw };
  }

  // Alto de la cancela en metros: ajuste propio, acotado al rango del
  // deslizador (el módulo exporta los límites para que no puedan divergir).
  const _wallGateH = o => {
    const v = Number(o.wallGateHeight);
    return Math.min(WALL_GATE_H_MAX, Math.max(WALL_GATE_H_MIN, v > 0 ? v : WALL_GATE_H_DEF));
  };

  const _wallRailingH = o => {
    const v = Number(o.wallRailingHeight);
    return Math.min(WALL_RAIL_H_MAX,
      Math.max(WALL_RAIL_H_MIN, v > 0 ? v : WALL_RAIL_H_DEF));
  };

  // El paño se PARTE en la entrada en vez de pasar por detrás: si no, el
  // remate del muro cruza la cancela y el hueco deja de leerse como un paso.
  function _wallBody(b, o, gate) {
    return _wallSpans(b, gate).map(s => _rectEl(s[0], b.y, s[1] - s[0], b.h, o));
  }

  // ¿Cae x dentro del paso (pilastras incluidas)?
  const _inGate = (gate, x) => !!gate && x > gate.x1 - 2 && x < gate.x2 + 2;

  /* ── planta: contorno visto desde arriba ── */
  function _wallPlan(b, o) {
    const gate = _wallGateRange(b, o);
    return [
      ..._wallBody(b, o, gate),
      ..._wallTexturePlan(b, o, gate),
      ...(o.wallRailing ? _wallRailingPlan(b, o, gate) : []),
      ...(gate ? _wallGatePlan(b, o, gate) : []),
    ];
  }

  // Piedra: achurado de mampuestos con separación y ligera inclinación
  // IRREGULARES (con paso exacto parecía la junta de un panel prefabricado),
  // salvo en el paso. Hormigón: liso —la ausencia de achurado ES la textura—.
  function _wallTexturePlan(b, o, gate) {
    const ty1 = b.y + b.h * 0.22, ty2 = b.y + b.h * 0.78;
    if (ty2 - ty1 < 2) return [];
    if (o.wallMaterial === 'brick') {
      const els = [];
      const gap = Math.max(8, Math.min(18, b.w / 8));
      for (let i = 0, x = b.x + gap / 2; x < b.x + b.w - 2; i++, x += gap) {
        if (!_inGate(gate, x)) els.push(_lineT(x, ty1, x, ty2, o));
      }
      return els;
    }
    if (o.wallMaterial !== 'stone') return [];
    const gap = Math.max(9, Math.min(STONE_TICK_GAP, b.w / 3));
    const els = [];
    let tx = b.x + gap * (0.5 + 0.5 * _noise(0, 5));
    for (let i = 0; i < 60 && tx < b.x + b.w - 2; i++) {
      if (!_inGate(gate, tx)) els.push(_lineT(tx, ty1, tx + (_noise(i, 9) - 0.5) * gap * 0.25, ty2, o));
      tx += gap * (0.6 + 0.85 * _noise(i, 7));
    }
    return els;
  }

  // Verja en planta: el pasamanos visto desde arriba, dos finas líneas
  // longitudinales sobre el paño (interrumpidas en el paso, que no tiene muro
  // debajo). Existe para que la verja se pueda ver —y por tanto elegir—
  // también en planta: un campo sin efecto acaba deshabilitado.
  function _wallRailingPlan(b, o, gate) {
    const ratio = (_wallRailingH(o) - WALL_RAIL_H_MIN) /
      (WALL_RAIL_H_MAX - WALL_RAIL_H_MIN);
    const inset = Math.max(1.2, b.h * (0.36 - ratio * 0.16));
    if (b.h - 2 * inset < 2) return [];
    const els = [];
    [b.y + inset, b.y + b.h - inset].forEach(y => {
      if (!gate) { els.push(_lineT(b.x, y, b.x + b.w, y, o)); return; }
      if (gate.x1 - b.x > 1) els.push(_lineT(b.x, y, gate.x1, y, o));
      if (b.x + b.w - gate.x2 > 1) els.push(_lineT(gate.x2, y, b.x + b.w, y, o));
    });
    const style = o.wallRailingType || 'spear';
    if (style !== 'spear') {
      const step = Math.max(12, Math.min(24, b.w / 8));
      _wallSpans(b, gate).forEach(span => {
        for (let x = span[0] + step; x < span[1] - 2; x += step) {
          els.push(_lineT(x, b.y + inset, x, b.y + b.h - inset, o));
        }
      });
    }
    return els;
  }

  // En planta la cancela son sus dos pilastras —sobresalen del paño, como en
  // alzado, con la basa dibujada dentro, y engordan con el alto declarado— y la
  // hoja (o las dos) cerrando el vano. Sin arco de barrido: es boceto, no un
  // símbolo CAD de puerta.
  function _wallGatePlan(b, o, gate) {
    const out = Math.max(1.5, b.h * 0.2) * (0.7 + 0.2 * _wallGateH(o));
    const els = [];
    [gate.x1, gate.gx + gate.gw].forEach(px => {
      els.push(_rectEl(px, b.y - out, gate.pw, b.h + 2 * out, o));
      const i = Math.min(out * 0.5, gate.pw * 0.28);
      if (i > 1) els.push(_rectT(px + i, b.y - out + i, gate.pw - 2 * i, b.h + 2 * out - 2 * i, o));
    });
    const my = b.y + b.h / 2;
    const leaves = o.wallGateType === 'single' ? 1 : 2;
    const leafW = gate.gw / leaves;
    for (let i = 0; i < leaves; i++) {
      els.push(_lineT(gate.gx + i * leafW + 1, my, gate.gx + (i + 1) * leafW - 1, my, o));
    }
    return els;
  }

  /* ── alzado: paño visto de frente ── */
  function _wallElevation(b, o) {
    const gate = _wallGateRange(b, o);
    const pxM = _wallPxPerM(b, o);
    const trim = _wallTrim(b, o, pxM);
    const els = [];
    _wallSpans(b, gate).forEach(s => els.push(..._wallPanelElevation(b, o, s, pxM, trim)));
    if (o.wallRailing) els.push(..._wallRailingTop(b, o, gate, trim));
    if (gate) els.push(..._wallGateElevation(b, o, gate));
    els.push(_line(b.x - 10, b.y + b.h, b.x + b.w + 10, b.y + b.h, o));  // rasante
    return els;
  }

  // Tramos de paño que quedan a cada lado del paso (uno solo si no hay puerta).
  function _wallSpans(b, gate) {
    if (!gate) return [[b.x, b.x + b.w]];
    return [[b.x, gate.x1], [gate.x2, b.x + b.w]].filter(s => s[1] - s[0] > 2);
  }

  /* Albardilla y zócalo: el remate y la basa que tiene cualquier muro viejo.
     Van DENTRO de la caja (la albardilla vuela solo de lado): un remate que
     creciera hacia arriba cambiaría el alto que el arrastre promete. */
  function _wallTrim(b, o, pxM) {
    return {
      cap:    b.h > 26 ? Math.min(9, Math.max(3, pxM * 0.1)) : 0,
      plinth: b.h > 44 && o.wallMaterial === 'stone' ? Math.min(13, Math.max(5, pxM * 0.16)) : 0,
    };
  }

  // Un tramo de paño completo: cuerpo, albardilla volada, zócalo, aparejo y
  // esquinas de sillería (la cadena de sillares alternos que remata cualquier
  // muro de fábrica antiguo).
  function _wallPanelElevation(b, o, span, pxM, trim) {
    const x1 = span[0], x2 = span[1], w = x2 - x1;
    const ground = b.y + b.h;
    const els = [_rectEl(x1, b.y, w, b.h, o)];
    if (trim.cap) {
      const ov = Math.min(3, w * 0.03);
      els.push(_rectEl(x1 - ov, b.y, w + 2 * ov, trim.cap, o));
      els.push(_lineT(x1, b.y + trim.cap * 0.55, x2, b.y + trim.cap * 0.55, o));  // moldura
    }
    els.push(..._wallTextureElevation(b, o, span, pxM, trim));
    if (trim.plinth) els.push(_lineT(x1, ground - trim.plinth, x2, ground - trim.plinth, o));
    return els;
  }

  // Piedra: mampostería de hiladas y piezas IRREGULARES, con cadena de sillares
  // en las esquinas. El alto de hilada y el ancho de mampuesto salen de la
  // escala (px/m, o sea de la altura en metros) y varían pieza a pieza con
  // _noise; las llagas van algo inclinadas. Con la retícula exacta anterior
  // —hilada fija de 22 px y junta siempre a media pieza— el muro parecía de
  // bloques prefabricados. Hormigón: una junta de hormigonado por tongada
  // (~0,5 m), que es lo que delata su altura.
  function _wallTextureElevation(b, o, span, pxM, trim) {
    const x1 = span[0], x2 = span[1];
    const top = b.y + trim.cap, bot = b.y + b.h - trim.plinth;
    const els = [];
    if (bot - top < 6 || x2 - x1 < 6) return els;
    if (o.wallMaterial === 'brick') {
      const rowH = Math.max(6, Math.min(13, pxM * 0.12));
      const rows = Math.max(2, Math.min(18, Math.round((bot - top) / rowH)));
      const brickW = Math.max(12, Math.min(30, pxM * 0.28));
      for (let r = 1; r < rows; r++) {
        const y = top + (bot - top) * r / rows;
        els.push(_lineT(x1, y, x2, y, o));
      }
      for (let r = 0; r < rows; r++) {
        const y1 = top + (bot - top) * r / rows;
        const y2 = top + (bot - top) * (r + 1) / rows;
        const offset = r % 2 ? 0 : brickW / 2;
        for (let x = x1 + offset + brickW; x < x2 - 2; x += brickW) {
          els.push(_lineT(x, y1, x, y2, o));
        }
      }
      return els;
    }
    if (o.wallMaterial !== 'stone') {
      const lifts = Math.max(2, Math.min(6, Math.round(_wallHeightM(o) / 0.5)));
      for (let i = 1; i < lifts; i++) els.push(_lineT(x1, top + (bot - top) * i / lifts, x2, top + (bot - top) * i / lifts, o));
      return els;
    }
    const box = { x: x1, y: top, w: x2 - x1, h: bot - top };
    const ys = _wallCourseYs(box, pxM);
    for (let r = 1; r < ys.length - 1; r++) els.push(_lineT(x1, ys[r], x2, ys[r], o));
    const blockW = Math.max(8, WALL_BLOCK_M * pxM);
    // Sillares de esquina, alternos hilada a hilada: la cadena de cantería que
    // remata cualquier muro de fábrica antiguo.
    const q = box.w > 46 ? Math.min(26, Math.max(8, pxM * 0.3)) : 0;
    for (let r = 0; r < ys.length - 1; r++) {
      const y1 = ys[r], y2 = ys[r + 1];
      if (q) {
        const d = q * (r % 2 ? 1 : 0.62);
        els.push(_lineT(x1 + d, y1, x1 + d, y2, o), _lineT(x2 - d, y1, x2 - d, y2, o));
      }
      // Cada hilada tiene su propio calibre de piedra: unas de mampuesto
      // menudo y otras de perpiaño largo. Sin esto el paño lee como ladrillo.
      const rowW = blockW * (0.75 + 0.75 * _noise(r, 31));
      let x = x1 + q * 1.2 + rowW * (0.3 + 0.55 * _noise(r, 11));
      for (let k = 0; k < 60 && x < x2 - q * 1.2 - 3; k++) {
        els.push(_lineT(x, y1, x + (_noise(r, k + 23) - 0.5) * (y2 - y1) * 0.3, y2, o));
        x += rowW * (0.6 + 0.9 * _noise(r, k));
      }
    }
    // Zócalo: una sola hilada de piezas grandes, sin llagas menudas.
    if (trim.plinth > 4) {
      const pw2 = blockW * 1.8;
      for (let x = x1 + pw2; x < x2 - 4; x += pw2) {
        els.push(_lineT(x, bot, x, b.y + b.h, o));
      }
    }
    return els;
  }

  // Alturas de hilada: nominales por escala (WALL_COURSE_M) y luego repartidas
  // con pesos irregulares que suman b.h exacto —una hilada de alto constante es
  // justo lo que delata al bloque de hormigón—.
  function _wallCourseYs(b, pxM) {
    const rows = Math.max(2, Math.min(16, Math.round(b.h / Math.max(7, WALL_COURSE_M * pxM))));
    const weights = [];
    let sum = 0;
    for (let r = 0; r < rows; r++) {
      const v = 0.75 + 0.5 * _noise(r, 3);
      weights.push(v);
      sum += v;
    }
    const ys = [b.y];
    let acc = 0;
    for (let r = 0; r < rows; r++) { acc += weights[r]; ys.push(b.y + b.h * acc / sum); }
    return ys;
  }

  // Barrote abombado: el gesto de la forja. Cae a línea recta si el arco no se
  // puede resolver (comba nula o chorda degenerada).
  function _bowBar(x, y1, y2, sag, o) {
    const arc = ArcMath.arcCtrls(x, y1, x, y2, sag);
    return arc
      ? { type: 'curveArrow', x1: x, y1, x2: x, y2,
          cx: arc.cx, cy: arc.cy, cx2: arc.cx2, cy2: arc.cy2,
          arc: true, heads: 'none', color: o.color, lineWidth: _thinW(o) }
      : _lineT(x, y1, x, y2, o);
  }

  /**
   * Remate defensivo de una barra de verja. Todas las variantes terminan en
   * una punta real, pero su silueta y el collar que la sostiene pertenecen al
   * lenguaje ornamental del paño: no tendría sentido coronar una rocalla con
   * la misma flecha industrial de una verja minimalista.
   */
  function _forgeFinial(type, cx, baseY, h, bay, o, index = 0) {
    const style = type || 'spear';
    const tipY = baseY - h;
    const half = Math.max(1.25, Math.min(bay * 0.24, h * 0.43));
    const neckY = baseY - h * 0.08;
    const collarY = baseY - h * 0.2;
    const d = Math.max(2, Math.min(half * 1.25, h * 0.34));
    const els = [];
    const curve = (x1, y1, x2, y2, qx, qy) => ({
      type: 'curveArrow', x1, y1, x2, y2, cx: qx, cy: qy,
      heads: 'none', color: o.color, lineWidth: _thinW(o),
    });
    const point = (left, leftY, right = left, rightY = leftY) => {
      // Toda variante conserva dos filos que convergen en una punta defensiva.
      els.push(_lineT(cx - left, leftY, cx, tipY, o),
        _lineT(cx + right, rightY, cx, tipY, o));
    };
    const nerve = () => els.push(_lineT(cx, tipY, cx, baseY, o));

    if (style === 'minimal') {
      // Aguja estrecha tradicional: sin hoja abombada, con doble collar fino.
      point(half * 0.55, neckY);
      nerve();
      els.push(_lineT(cx - half * 0.9, collarY, cx + half * 0.9, collarY, o),
        _lineT(cx - half * 0.7, collarY + d * 0.38, cx + half * 0.7, collarY + d * 0.38, o));
    } else if (style === 'arches') {
      // Ojiva trilobulada: pico central y dos lóbulos góticos descendentes.
      const shoulderY = tipY + h * 0.46;
      point(half * 0.72, shoulderY);
      nerve();
      els.push(curve(cx - half * 0.72, shoulderY, cx, neckY,
        cx - half * 1.3, collarY - d * 0.45),
      curve(cx + half * 0.72, shoulderY, cx, neckY,
        cx + half * 1.3, collarY - d * 0.45),
      _lineT(cx - half * 1.05, neckY, cx + half * 1.05, neckY, o));
    } else if (style === 'diamonds') {
      // Hierro de pica romboidal: cuatro facetas forman la propia hoja.
      const waistY = tipY + h * 0.55;
      point(half * 0.94, waistY);
      els.push(_lineT(cx - half * 0.94, waistY, cx, neckY, o),
        _lineT(cx + half * 0.94, waistY, cx, neckY, o),
        _lineT(cx, tipY, cx, neckY, o),
        _lineT(cx - half * 0.7, collarY, cx + half * 0.7, collarY, o));
    } else if (style === 'rings') {
      // Hoja de laurel perforada sobre anilla neoclásica.
      const shoulderY = tipY + h * 0.64;
      point(half * 0.86, shoulderY);
      els.push(curve(cx - half * 0.86, shoulderY, cx, neckY,
        cx - half * 0.35, baseY - h * 0.02),
      curve(cx + half * 0.86, shoulderY, cx, neckY,
        cx + half * 0.35, baseY - h * 0.02),
      _lineT(cx, tipY, cx, collarY - d * 0.55, o),
      _circleT(cx - d / 2, collarY - d / 2, d, d, o),
        _lineT(cx - d * 0.75, collarY, cx - d / 2, collarY, o),
        _lineT(cx + d / 2, collarY, cx + d * 0.75, collarY, o));
    } else if (style === 'scrolls') {
      // Punta flamígera barroca: hombros desiguales y roleos abiertos.
      const leftY = tipY + h * 0.47, rightY = tipY + h * 0.66;
      point(half * 0.72, leftY, half * 1.06, rightY);
      els.push(curve(cx - half * 0.72, leftY, cx, neckY,
        cx - half * 1.35, collarY - d * 0.45),
      curve(cx + half * 1.06, rightY, cx, neckY,
        cx + half * 0.55, collarY - d * 0.65),
      curve(cx, neckY, cx - half * 1.65, collarY, cx - half * 1.55, tipY + h * 0.7),
      curve(cx, neckY, cx + half * 1.65, collarY, cx + half * 1.55, tipY + h * 0.7),
      _lineT(cx, tipY, cx, baseY, o));
    } else if (style === 'fans') {
      // Palmeta de cinco hojas: la central es la punta y las laterales abanican.
      const shoulderY = tipY + h * 0.58;
      point(half * 0.88, shoulderY);
      nerve();
      els.push(_lineT(cx - half * 0.88, shoulderY, cx, neckY, o),
        _lineT(cx + half * 0.88, shoulderY, cx, neckY, o),
        _lineT(cx, baseY, cx - half * 1.65, shoulderY + h * 0.2, o),
        _lineT(cx, baseY, cx + half * 1.65, shoulderY + h * 0.2, o),
        _circleT(cx - d * 0.28, collarY - d * 0.28, d * 0.56, d * 0.56, o));
    } else if (style === 'castilian') {
      // Hoja de cuatro planos, corta y recia, sobre cuadradillo torsionado.
      const shoulderY = tipY + h * 0.5;
      point(half * 1.08, shoulderY);
      const nd = d * 0.72;
      nerve();
      els.push(_lineT(cx - half * 1.08, shoulderY, cx, neckY, o),
        _lineT(cx + half * 1.08, shoulderY, cx, neckY, o),
        _lineT(cx - half * 0.9, shoulderY, cx + half * 0.9, shoulderY, o),
        _rectT(cx - nd / 2, collarY - nd / 2, nd, nd, o),
        _lineT(cx - nd / 2, collarY - nd / 2, cx + nd / 2, collarY + nd / 2, o),
        _lineT(cx - nd / 2, collarY + nd / 2, cx + nd / 2, collarY - nd / 2, o));
    } else if (style === 'plateresque') {
      // Flor de lis plateresca: pétalo axial afilado y dos hojas vueltas.
      const shoulderY = tipY + h * 0.42;
      point(half * 0.58, shoulderY);
      nerve();
      els.push(_lineT(cx - half * 0.58, shoulderY, cx, neckY, o),
        _lineT(cx + half * 0.58, shoulderY, cx, neckY, o),
        curve(cx, neckY, cx - half * 1.9, shoulderY + h * 0.16,
          cx - half * 1.55, collarY - h * 0.22),
        curve(cx, neckY, cx + half * 1.9, shoulderY + h * 0.16,
          cx + half * 1.55, collarY - h * 0.22),
        _lineT(cx - half * 1.25, collarY, cx + half * 1.25, collarY, o));
    } else if (style === 'herrerian') {
      // Piramidión herreriano: triángulo neto sobre dado, sin hoja vegetal.
      const baseTipY = tipY + h * 0.72;
      point(half * 0.98, baseTipY);
      const block = d * 0.78;
      els.push(_lineT(cx - half * 0.98, baseTipY, cx + half * 0.98, baseTipY, o),
        _lineT(cx, tipY, cx, baseTipY, o),
        _rectT(cx - block / 2, collarY - block / 2, block, block, o),
        _lineT(cx - half * 1.15, neckY, cx + half * 1.15, neckY, o));
    } else if (style === 'andalusian') {
      // Cáliz de perfil morisco: punta esbelta nacida entre dos ces enfrentadas.
      const shoulderY = tipY + h * 0.62;
      point(half * 0.74, shoulderY);
      const flip = index % 2 ? -1 : 1;
      nerve();
      els.push(curve(cx - half * 0.74, shoulderY, cx, neckY,
        cx - half * 1.18, collarY - d * 0.5),
      curve(cx + half * 0.74, shoulderY, cx, neckY,
        cx + half * 1.18, collarY - d * 0.5),
      curve(cx, neckY, cx - half * 1.8, collarY + d * 0.2,
        cx - half * (0.45 + 0.18 * flip), shoulderY - d * 0.3),
      curve(cx, neckY, cx + half * 1.8, collarY + d * 0.2,
        cx + half * (0.45 + 0.18 * flip), shoulderY - d * 0.3));
    } else if (style === 'catalan') {
      // Hoja acorazonada catalana sobre roseta y arranques espirales.
      const shoulderY = tipY + h * 0.55;
      point(half * 1.02, shoulderY);
      nerve();
      els.push(curve(cx - half * 1.02, shoulderY, cx, neckY,
        cx - half * 0.95, baseY - h * 0.02),
      curve(cx + half * 1.02, shoulderY, cx, neckY,
        cx + half * 0.95, baseY - h * 0.02),
      _circleT(cx - d / 2, collarY - d / 2, d, d, o),
        curve(cx - d / 2, collarY, cx - half * 1.6, baseY,
          cx - half * 1.35, collarY - d),
        curve(cx + d / 2, collarY, cx + half * 1.6, baseY,
          cx + half * 1.35, collarY - d));
    } else if (style === 'valencian') {
      // Llama de rocalla valenciana: perfil clásico, quebrado y asimétrico.
      const flip = index % 2 ? -1 : 1;
      const hubX = cx + flip * d * 0.16;
      const leftY = tipY + h * (flip > 0 ? 0.43 : 0.66);
      const rightY = tipY + h * (flip > 0 ? 0.68 : 0.46);
      point(half * (flip > 0 ? 0.65 : 1.08), leftY,
        half * (flip > 0 ? 1.12 : 0.68), rightY);
      nerve();
      els.push(curve(cx - half * (flip > 0 ? 0.65 : 1.08), leftY, cx, neckY,
        cx - half * 1.25, collarY - d * 0.7),
      curve(cx + half * (flip > 0 ? 1.12 : 0.68), rightY, cx, neckY,
        cx + half * 0.55, collarY - d * 0.8),
      curve(cx, neckY, cx - half * 1.9, baseY,
        cx - half * (1.6 + 0.2 * flip), tipY + h * 0.58),
      curve(cx, neckY, cx + half * 1.55, collarY + d * 0.25,
        cx + half * (1.15 - 0.15 * flip), tipY + h * 0.5 - d * 0.45));
      [-0.9, -0.45, 0, 0.45, 0.9].forEach(ray => {
        els.push(_lineT(hubX, baseY, hubX + half * ray, collarY - d * (0.4 - 0.18 * Math.abs(ray)), o));
      });
    } else {
      // Hoja lanceolada clásica: perfil cerrado, nervio y collar doble.
      const shoulderY = tipY + h * 0.54;
      point(half, shoulderY);
      nerve();
      els.push(_lineT(cx - half, shoulderY, cx, neckY, o),
        _lineT(cx + half, shoulderY, cx, neckY, o),
        _lineT(cx - half * 1.2, collarY, cx + half * 1.2, collarY, o),
        _lineT(cx - half * 0.9, collarY + d * 0.38, cx + half * 0.9, collarY + d * 0.38, o));
    }
    return els;
  }

  /**
   * Panel de reja de forja antigua: puntas de lanza, pasamanos, banda de
   * roleos (dos travesaños con rosetas), barrotes abombados a lados alternos y
   * zócalo de chapa al pie. Es el motivo compartido por la verja del remate y
   * por las hojas de la cancela, y NO reutiliza `_railing` (el balcón) a
   * propósito: allí la comba crece con la posición del barrote, que en un paño
   * largo dibuja una lente de lado a lado; y sin puntas, roleos ni zócalo una
   * hoja de barrotes parece una valla de tablas.
   * Cada remate aparece solo si hay sitio: por debajo, el panel degrada a
   * pasamanos + barrotes + travesaño, que es lo que se lee a ese tamaño.
   */
  function _railPanel(x, y, w, h, o, gap) {
    if (w < 10 || h < 12) return [];
    const tip = Math.min(10, Math.max(3, h * 0.14));   // punta de lanza
    const hr  = Math.min(6, Math.max(2, h * 0.07));    // canto del pasamanos
    const top = y + tip, bot = y + h;
    const els = [_rectEl(x, top, w, hr, o)];
    const n = _barCount(w, gap), step = w / n;

    const plinth = h >= 56 ? Math.min(18, Math.max(6, h * 0.13)) : 0;   // zócalo de chapa
    const base = bot - plinth;
    const band = base - top - hr > 26 ? Math.min(24, Math.max(9, h * 0.17)) : 0;
    const mid = top + hr + band;

    const amp = Math.min(step * 0.18, (base - top) * 0.05);
    for (let i = 1; i < n; i++) {
      const bx = x + step * i;
      els.push(_bowBar(bx, top, base, i % 2 ? amp : -amp, o));
      if (tip >= 4) {
        els.push(..._forgeFinial('spear', bx, top, tip, step, o, i));
      }
    }
    if (band) {
      els.push(_lineT(x, mid, x + w, mid, o));
      const d = Math.min(step * 0.62, band * 0.7);
      const cy = (top + hr + mid) / 2;
      if (d >= 4) for (let i = 0; i < n; i++) {
        els.push(_circleT(x + step * (i + 0.5) - d / 2, cy - d / 2, d, d, o));
      }
    }
    if (plinth) {
      els.push(_rectT(x, base, w, plinth, o));
      els.push(_lineT(x, base + plinth * 0.45, x + w, base + plinth * 0.45, o));
    } else {
      const low = bot - (bot - top) * 0.18;
      if (low > top + hr + 3) els.push(_lineT(x, low, x + w, low, o));
    }
    return els;
  }

  // Variantes de verja sobre muro. Todas comparten marco y ritmo métrico,
  // pero no reutilizan adornos entre sí para que el selector cambie de verdad
  // la silueta y no sea una etiqueta cosmética.
  function _wallRailPanel(x, y, w, h, o, gap, type) {
    if (!type || type === 'spear') return _railPanel(x, y, w, h, o, gap);
    if (w < 10 || h < 12) return [];
    const top = y + Math.max(3, h * 0.08), bot = y + h;
    const n = _barCount(w, gap), step = w / n;
    const els = [_rectEl(x, top, w, Math.max(2, Math.min(6, h * 0.07)), o),
      _lineT(x, bot - 2, x + w, bot - 2, o)];

    // Defensa común a TODAS las variantes: puntas de lanza sobre el
    // pasamanos. El patrón inferior puede ser geométrico u ornamental, pero
    // la coronación nunca queda plana ni ofrece un apoyo fácil para trepar.
    const spearH = Math.max(4, Math.min(10, h * 0.13));
    for (let i = 1; i < n; i++) {
      const bx = x + step * i;
      els.push(..._forgeFinial(type, bx, top, spearH, step, o, i));
    }

    if (type === 'minimal') {
      for (let i = 1; i < n; i++) {
        const bx = x + step * i;
        els.push(_lineT(bx, top, bx, bot, o));
      }
      return els;
    }

    if (type === 'arches') {
      const springY = top + (bot - top) * 0.52;
      for (let i = 0; i < n; i++) {
        const x1 = x + step * i, x2 = x1 + step;
        els.push(_lineT(x1, top, x1, bot, o), {
          type: 'curveArrow', x1, y1: springY, x2, y2: springY,
          cx: (x1 + x2) / 2, cy: top + (springY - top) * 0.18,
          heads: 'none', color: o.color, lineWidth: _thinW(o),
        });
      }
      return els;
    }

    if (type === 'diamonds') {
      const y1 = top + 3, y2 = bot - 3;
      for (let i = 0; i < n; i++) {
        const x1 = x + step * i, x2 = x1 + step;
        els.push(_lineT(x1, y1, x2, y2, o), _lineT(x1, y2, x2, y1, o));
      }
      return els;
    }

    if (type === 'rings') {
      const d = Math.min(step * 0.76, (bot - top) * 0.38);
      const cy = top + (bot - top) * 0.45;
      for (let i = 0; i < n; i++) {
        const cx = x + step * (i + 0.5);
        els.push(_lineT(cx, top, cx, bot, o));
        if (d >= 4) els.push(_circleT(cx - d / 2, cy - d / 2, d, d, o));
      }
      return els;
    }

    if (type === 'scrolls') {
      const midY = top + (bot - top) * 0.5;
      for (let i = 0; i < n; i++) {
        const x1 = x + step * i, x2 = x1 + step;
        els.push({ type: 'curveArrow', x1, y1: midY, x2, y2: midY,
          cx: (x1 + x2) / 2, cy: i % 2 ? top + 2 : bot - 4,
          heads: 'none', color: o.color, lineWidth: _thinW(o) });
        if (i % 2 === 0) els.push(_lineT((x1 + x2) / 2, top, (x1 + x2) / 2, bot, o));
      }
      return els;
    }

    // Castilla: cuadradillo vertical con pequeños nudos torsionados. El giro
    // se abstrae como dos aspas sucesivas sobre cada barra, legibles incluso
    // en el icono del catálogo.
    if (type === 'castilian') {
      const node = Math.max(2, Math.min(4.5, step * 0.22));
      const ys = [top + (bot - top) * 0.38, top + (bot - top) * 0.68];
      for (let i = 0; i < n; i++) {
        const bx = x + step * (i + 0.5);
        els.push(_lineT(bx, top, bx, bot, o));
        ys.forEach((ny, j) => {
          const twist = (i + j) % 2 ? node : -node;
          els.push(_lineT(bx - node, ny - twist, bx + node, ny + twist, o),
            _lineT(bx - node, ny + twist, bx + node, ny - twist, o));
        });
      }
      return els;
    }

    // Renacimiento plateresco: medallones y palmetas simétricas organizados
    // como un friso de candelieri, sin cerrar el paño.
    if (type === 'plateresque') {
      const d = Math.max(5, Math.min(10, step * 0.7));
      const cy = top + (bot - top) * 0.58;
      for (let i = 0; i < n; i++) {
        const bx = x + step * (i + 0.5);
        els.push(_lineT(bx, top, bx, bot, o));
        if (i % 2 === 0) {
          els.push(_circleT(bx - d / 2, cy - d / 2, d, d, o),
            _lineT(bx, cy - d / 2, bx, cy - d * 1.45, o),
            _lineT(bx, cy - d * 1.05, bx - d * 0.75, cy - d * 1.55, o),
            _lineT(bx, cy - d * 1.05, bx + d * 0.75, cy - d * 1.55, o));
        }
      }
      return els;
    }

    // Herreriano: composición ortogonal, austera y muy modulada. Los nudos
    // cuadrados alternos sustituyen cualquier roleo o motivo vegetal.
    if (type === 'herrerian') {
      const y1 = top + (bot - top) * 0.36, y2 = top + (bot - top) * 0.7;
      els.push(_lineT(x, y1, x + w, y1, o), _lineT(x, y2, x + w, y2, o));
      const d = Math.max(3, Math.min(7, step * 0.42));
      for (let i = 0; i <= n; i++) {
        const bx = x + step * i;
        els.push(_lineT(bx, top, bx, bot, o));
        const ny = i % 2 ? y1 : y2;
        els.push(_rectT(bx - d / 2, ny - d / 2, d, d, o));
      }
      return els;
    }

    // Andalucía: ces y roleos en S enfrentados, con simetría dentro de cada
    // calle. Las barras pares actúan como ejes de la composición.
    if (type === 'andalusian') {
      const midY = top + (bot - top) * 0.54;
      for (let i = 0; i < n; i++) {
        const x1 = x + step * i, x2 = x1 + step, cx = (x1 + x2) / 2;
        if (i % 2 === 0) els.push(_lineT(cx, top, cx, bot, o));
        els.push(
          { type: 'curveArrow', x1, y1: midY, x2: cx, y2: midY,
            cx: x1 + step * 0.18, cy: top + 3,
            heads: 'none', color: o.color, lineWidth: _thinW(o) },
          { type: 'curveArrow', x1: cx, y1: midY, x2, y2: midY,
            cx: x1 + step * 0.82, cy: bot - 3,
            heads: 'none', color: o.color, lineWidth: _thinW(o) });
      }
      return els;
    }

    // Cataluña: espirales enlazadas mediante una S cúbica continua y rosetas
    // alternas, inspiradas en los repertorios históricos de hierro artístico.
    if (type === 'catalan') {
      const midY = top + (bot - top) * 0.52;
      const d = Math.max(4, Math.min(8, step * 0.55));
      for (let i = 0; i < n; i++) {
        const x1 = x + step * i, x2 = x1 + step;
        const up = i % 2 === 0;
        els.push({ type: 'curveArrow', x1, y1: midY, x2, y2: midY,
          cx: x1 + step * 0.25, cy: up ? top + 2 : bot - 3,
          cx2: x1 + step * 0.75, cy2: up ? bot - 3 : top + 2,
          heads: 'none', color: o.color, lineWidth: _thinW(o) });
        if (up) {
          const cx = (x1 + x2) / 2;
          els.push(_circleT(cx - d / 2, midY - d / 2, d, d, o),
            _lineT(cx, top, cx, bot, o));
        }
      }
      return els;
    }

    // Valencia barroca: cartelas ovales entre roleos quebrados y pequeños
    // abanicos de concha. La ligera asimetría de cada calle evoca la rocalla
    // rococó sin perder la repetición estructural de la verja.
    if (type === 'valencian') {
      const groups = Math.max(2, Math.min(6, Math.round(w / Math.max(26, gap * 2.5))));
      const groupW = w / groups;
      const cy = top + (bot - top) * 0.56;
      const d = Math.max(5, Math.min(11, Math.min(groupW * 0.32, (bot - top) * 0.18)));
      for (let g = 0; g < groups; g++) {
        const x1 = x + groupW * g, x2 = x1 + groupW;
        const gx = (x1 + x2) / 2;
        els.push(_lineT(x1, top, x1, bot, o),
          _circleT(gx - d * 0.8, cy - d * 0.46, d * 1.6, d * 0.92, o),
          { type: 'curveArrow', x1: gx, y1: cy, x2: x1 + groupW * 0.08, y2: cy + d * 0.2,
            cx: gx - groupW * 0.38, cy: cy - d * 1.5,
            heads: 'none', color: o.color, lineWidth: _thinW(o) },
          { type: 'curveArrow', x1: gx, y1: cy, x2: x2 - groupW * 0.08, y2: cy - d * 0.15,
            cx: gx + groupW * 0.34, cy: cy + d * 1.55,
            heads: 'none', color: o.color, lineWidth: _thinW(o) });
        const hubY = cy + d * 0.42;
        [-0.34, -0.17, 0, 0.17, 0.34].forEach(off => {
          els.push(_lineT(gx, hubY, gx + groupW * off, cy - d * 0.9, o));
        });
        if (g % 2 === 0) {
          els.push(_circleT(gx - d * 0.24, hubY - d * 0.24, d * 0.48, d * 0.48, o));
        }
      }
      els.push(_lineT(x + w, top, x + w, bot, o));
      return els;
    }

    // Abanicos: grupos de tres radios nacen de una sucesión de cubos bajos.
    const groups = Math.max(2, Math.min(7, Math.round(w / Math.max(22, gap * 2.4))));
    const groupW = w / groups;
    const hubY = bot - Math.max(5, (bot - top) * 0.18);
    for (let g = 0; g < groups; g++) {
      const gx = x + groupW * (g + 0.5);
      const d = Math.min(6, groupW * 0.2);
      els.push(_circleT(gx - d / 2, hubY - d / 2, d, d, o));
      [-0.38, 0, 0.38].forEach(off => {
        els.push(_lineT(gx, hubY, gx + groupW * off, top, o));
      });
    }
    return els;
  }

  /* ── verjas independientes (planta + alzado) ───────────────────────
     Comparte exactamente los trece paños de forja del Muro, pero sin fábrica
     debajo. En planta la ornamentación vertical no es visible: se representan
     pletinas y montantes con el ritmo propio de cada modelo. */
  function _fenceTool(b, o) {
    const cm = _fenceHeightCm(o);
    const ids = FORGE_TYPES.map(item => item.id);
    const type = ids.includes(o.fenceType) ? o.fenceType : 'spear';
    if (cm === 0) return [_line(b.x, b.y, b.x + b.w, b.y, o)];
    if (o.fenceView === 'plan') return _fencePlan(b, o, type, ids.indexOf(type));
    return _fenceElevation(b, o, type);
  }

  function _fenceElevation(b, o, type) {
    const gap = Math.max(9, Math.min(18, 10 + _fenceHeightCm(o) / 70));
    const els = _wallRailPanel(b.x, b.y, b.w, b.h, o, gap, type);
    if (!els.length) return [_line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, o)];
    // Montantes extremos estructurales: el paño ornamental queda contenido
    // entre ellos y se lee como una verja autónoma, no como una barandilla.
    const postW = Math.max(3, Math.min(8, b.w * 0.025));
    const top = b.y + Math.max(3, b.h * 0.08);
    els.push(_rectEl(b.x - postW / 2, top, postW, b.y + b.h - top, o),
      _rectEl(b.x + b.w - postW / 2, top, postW, b.y + b.h - top, o),
      _line(b.x - postW, b.y + b.h, b.x + b.w + postW, b.y + b.h, o));
    return els;
  }

  /* ── cancela independiente (planta + alzado) ────────────────────────
     Reutiliza las hojas y pilastras de la entrada del Muro, pero construye
     su propio vano: no crea fábrica lateral ni obliga a dibujar un muro. */
  function _gateTool(b, o) {
    const cm = _gateHeightCm(o);
    if (cm === 0) return [_line(b.x, b.y, b.x + b.w, b.y, o)];
    const type = GATE_TYPES.some(item => item.id === o.gateType)
      ? o.gateType : 'concave';
    const pw = Math.max(3, Math.min(14, b.w * 0.08));
    const gw = b.w - 2 * pw;
    if (gw < 16) return [_line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, o)];
    const gate = {
      gx: b.x + pw, gw, pw,
      x1: b.x, x2: b.x + b.w,
    };
    const opts = {
      ...o,
      wallGateType: type,
      wallGateHeight: cm / 100,
      standaloneGateHeightCm: cm,
    };
    if (o.gateView === 'plan') return _wallGatePlan(b, opts, gate);
    return [
      ..._wallGateElevation(b, opts, gate),
      _line(b.x - 8, b.y + b.h, b.x + b.w + 8, b.y + b.h, o),
    ];
  }

  function _fencePlan(b, o, type, typeIndex) {
    const cy = b.y + b.h / 2;
    const inset = Math.max(1.5, b.h * 0.22);
    const y1 = b.y + inset, y2 = b.y + b.h - inset;
    const els = [_line(b.x, y1, b.x + b.w, y1, o),
      _line(b.x, y2, b.x + b.w, y2, o)];
    const pitch = Math.max(14, Math.min(30, 16 + typeIndex * 2));
    const n = Math.max(2, Math.min(20, Math.round(b.w / pitch)));
    const step = b.w / n;
    const d = Math.max(3, Math.min(8, b.h * 0.62));
    for (let i = 0; i <= n; i++) {
      const x = b.x + step * i;
      if (type === 'rings' || type === 'scrolls' || type === 'fans') {
        els.push(_circleT(x - d / 2, cy - d / 2, d, d, o));
      } else {
        els.push(_rectT(x - d / 2, cy - d / 2, d, d, o));
      }
    }
    // Eje fino de implantación: facilita alinear varios tramos en planta.
    els.push(_lineT(b.x, cy, b.x + b.w, cy, o));
    return els;
  }

  // Verja de forja sobre el remate: el mismo panel de reja, partido en los dos
  // tramos que deja el paso —una verja cruzando por encima de la cancela sería
  // forja flotando en el aire— y apoyada sobre la albardilla. Alto y ritmo van
  // en metros, para que no crezcan con el arrastre.
  function _wallRailingTop(b, o, gate, trim) {
    const pxM = _wallPxPerM(b, o);
    const railH = Math.max(12, Math.min(140, _wallRailingH(o) * pxM));
    const gap = Math.max(9, Math.min(18, pxM * 0.17));
    const y = b.y - railH + (trim ? trim.cap * 0.4 : 0);
    const els = [];
    const type = o.wallRailingType || 'spear';
    _wallSpans(b, gate).forEach(s => els.push(..._wallRailPanel(
      s[0], y, s[1] - s[0], railH, o, gap, type,
    )));
    return els;
  }

  /**
   * Pilastra de portada: basa, fuste con despiece de sillería, cornisa
   * moldurada de dos vuelos y bola de remate sobre su cuello. Es la pieza que
   * más "antiguo" aporta, así que cada remate aparece solo si hay sitio; por
   * debajo se queda en fuste + cornisa.
   */
  function _wallPier(px, pTop, pw, ground, o, pxM) {
    const els = [_rectEl(px, pTop, pw, ground - pTop, o)];
    const baseH = Math.min(14, Math.max(4, pxM * 0.12));
    if (ground - pTop > baseH * 4) {
      els.push(_rectEl(px - pw * 0.18, ground - baseH, pw * 1.36, baseH, o));   // basa
      const course = Math.max(8, pxM * 0.32);                                   // despiece
      for (let y = pTop + course; y < ground - baseH - 4; y += course) {
        els.push(_lineT(px, y, px + pw, y, o));
      }
    }
    const capH = Math.min(9, Math.max(3, pxM * 0.09));
    els.push(_rectEl(px - pw * 0.16, pTop - capH, pw * 1.32, capH, o),          // cornisa
             _rectEl(px - pw * 0.36, pTop - capH * 2, pw * 1.72, capH, o));
    const d = Math.min(pw * 1.15, Math.max(4, pxM * 0.24));
    if (d >= 5) {
      const cy = pTop - capH * 2;
      els.push(_rectT(px + pw / 2 - d * 0.2, cy - d * 0.3, d * 0.4, d * 0.3, o),  // cuello
               _circleEl(px + pw / 2 - d / 2, cy - d * 0.3 - d, d, d, o));        // bola
    }
    return els;
  }

  // Machón de ladrillo visto para el portón ciego: aparejo regular, cornisa
  // de dos vuelos y albardilla inclinada. Sustituye la bola clásica por el
  // remate escalonado de la referencia.
  function _wallBrickPier(px, pTop, pw, ground, o, pxM) {
    const els = [_rectEl(px, pTop, pw, ground - pTop, o)];
    const rowH = Math.max(5, Math.min(11, pxM * 0.11));
    let row = 0;
    for (let y = pTop + rowH; y < ground - 3; y += rowH, row++) {
      els.push(_lineT(px, y, px + pw, y, o));
      const jx = px + (row % 2 ? pw * 0.38 : pw * 0.65);
      els.push(_lineT(jx, y - rowH, jx, y, o));
    }
    const capH = Math.max(3, Math.min(8, pxM * 0.08));
    els.push(_rectEl(px - pw * 0.18, pTop - capH, pw * 1.36, capH, o),
      _rectEl(px - pw * 0.34, pTop - capH * 2, pw * 1.68, capH, o));
    const roofY = pTop - capH * 2;
    els.push(_lineT(px - pw * 0.42, roofY, px + pw / 2, roofY - capH * 1.7, o),
      _lineT(px + pw / 2, roofY - capH * 1.7, px + pw * 1.42, roofY, o),
      _lineT(px - pw * 0.42, roofY, px + pw * 1.42, roofY, o));
    return els;
  }

  /**
   * Arco rebajado de la portada, con rosca de dovelas y clave: dos arcos
   * concéntricos y las juntas radiales entre ellos. Solo si el vano es lo
   * bastante ancho para que la rosca se lea; por debajo, la cancela va a dintel.
   */
  function _wallGateArch(gate, springY, o, pxM) {
    const s = gate.gw * 0.28;
    const t = Math.min(11, Math.max(3, pxM * 0.13));    // canto de la rosca
    if (gate.gw < 34 || s < 6) return [];
    // Sagitta NEGATIVA: con cuerda horizontal es la que comba hacia arriba.
    const inner = ArcMath.arcCtrls(gate.gx, springY, gate.gx + gate.gw, springY, -s);
    const outer = ArcMath.arcCtrls(gate.gx - t, springY, gate.gx + gate.gw + t, springY, -(s + t));
    if (!inner || !outer) return [];
    const arcEl = (a, x1, x2) => ({
      type: 'curveArrow', x1, y1: springY, x2, y2: springY,
      cx: a.cx, cy: a.cy, cx2: a.cx2, cy2: a.cy2,
      arc: true, heads: 'none', color: o.color, lineWidth: o.lineWidth,
    });
    const els = [arcEl(inner, gate.gx, gate.gx + gate.gw),
                 arcEl(outer, gate.gx - t, gate.gx + gate.gw + t)];
    // Dovelas radiales desde el centro real del arco, para que no se abran.
    const R = (gate.gw * gate.gw / 4 + s * s) / (2 * s);
    const cx = gate.gx + gate.gw / 2, cy = springY - s + R;
    const half = Math.asin(Math.min(1, gate.gw / 2 / R));
    const n = Math.max(2, Math.min(7, Math.round(gate.gw / 26)));
    for (let i = -n; i <= n; i++) {
      if (i === 0) continue;                       // el centro lo ocupa la clave
      const a = half * i / n, ux = Math.sin(a), uy = -Math.cos(a);
      els.push(_lineT(cx + R * ux, cy + R * uy, cx + (R + t) * ux, cy + (R + t) * uy, o));
    }
    const kw = Math.min(gate.gw * 0.16, t * 1.9);
    els.push(_rectEl(cx - kw / 2, springY - s - t * 1.15, kw, t * 1.9, o));   // clave
    return els;
  }

  // Hoja de forja con perfil en seno. La parábola tiene tangente casi
  // horizontal en el encuentro central: así la caída se lee serena, no como
  // dos diagonales. Cada barrote nace en la propia curva y conserva la base
  // recta; las puntas graduadas hacen visible el perfil incluso a escala de
  // miniatura.
  function _concaveLeaf(x, centerX, outerTop, centerTop, ground, o, gap, style, barBottom) {
    const left = x < centerX;
    const x1 = left ? x : centerX;
    const x2 = left ? centerX : x;
    const w = x2 - x1;
    if (w < 10) return [];
    const swan = style === 'concaveSwan';
    const lift = swan ? Math.max(4, (centerTop - outerTop) * 0.2) : 0;
    const meetingTop = centerTop - lift;
    const curve = swan ? {
      type: 'curveArrow', x1, y1: left ? outerTop : meetingTop,
      x2, y2: left ? meetingTop : outerTop,
      cx: left ? x1 + w * 0.44 : x1 + w * 0.22,
      cy: centerTop,
      cx2: left ? x1 + w * 0.78 : x1 + w * 0.56,
      cy2: centerTop + lift,
      heads: 'none', color: o.color, lineWidth: o.lineWidth,
    } : {
      type: 'curveArrow', x1, y1: left ? outerTop : centerTop,
      x2, y2: left ? centerTop : outerTop,
      cx: left ? x1 + w * 0.58 : x1 + w * 0.42,
      cy: centerTop, heads: 'none', color: o.color, lineWidth: o.lineWidth,
    };
    const els = [curve];
    if (style === 'concaveOrnate') {
      const inner = { ...curve, y1: curve.y1 + 6, y2: curve.y2 + 6,
        cy: curve.cy + 6, lineWidth: _thinW(o) };
      if (inner.cy2 !== undefined) inner.cy2 += 6;
      els.push(inner);
    }
    const n = _barCount(w, gap), step = w / n;
    const tip = Math.min(10, Math.max(4, (ground - outerTop) * 0.08));
    const bottom = barBottom || ground;
    const low = barBottom ? bottom : ground - Math.max(7, (ground - outerTop) * 0.12);
    els.push(_lineT(x1, low, x2, low, o));
    for (let i = 1; i < n; i++) {
      const bx = x1 + step * i;
      const t = (bx - x1) / w;
      const u = left ? t : 1 - t;
      let by;
      if (swan) {
        const v = 1 - u;
        by = v * v * v * outerTop + 3 * v * v * u * centerTop +
          3 * v * u * u * (centerTop + lift) + u * u * u * meetingTop;
      } else {
        by = outerTop + (centerTop - outerTop) * (1 - (1 - u) * (1 - u));
      }
      els.push(_lineT(bx, by, bx, bottom, o),
               _lineT(bx - step * 0.22, by, bx, by - tip, o),
               _lineT(bx + step * 0.22, by, bx, by - tip, o));
    }
    return els;
  }

  function _wallGateConcave(gate, top, ground, o, pxM) {
    const style = o.wallGateType;
    const centerX = gate.gx + gate.gw / 2;
    const drop = Math.min((ground - top) * 0.25, Math.max(10, gate.gw * 0.16));
    const centerTop = Math.min(ground - 20, top + drop);
    const meetingTop = style === 'concaveSwan'
      ? centerTop - Math.max(4, drop * 0.2) : centerTop;
    const gap = Math.max(8, Math.min(16, pxM * 0.15));
    const panelTop = style === 'concavePanel'
      ? ground - Math.max(16, Math.min(34, (ground - top) * 0.3)) : null;
    const els = [
      ..._concaveLeaf(gate.gx, centerX, top, centerTop, ground, o, gap, style, panelTop),
      ..._concaveLeaf(gate.gx + gate.gw, centerX, top, centerTop, ground, o, gap, style, panelTop),
      _line(centerX, meetingTop, centerX, ground, o),
    ];
    if (panelTop) {
      els.push(_rectT(gate.gx, panelTop, gate.gw, ground - panelTop, o),
        _lineT(gate.gx, panelTop, centerX, ground, o),
        _lineT(centerX, ground, gate.gx + gate.gw, panelTop, o));
    }
    // Rosetón partido en el cierre y dos roleos contrapuestos: además de
    // ornamentar, disimulan la junta vertical entre las hojas.
    const d = Math.min(16, Math.max(7, gate.gw * 0.11));
    const cy = meetingTop + Math.max(d, (ground - meetingTop) * 0.24);
    els.push(_circleT(centerX - d / 2, cy - d / 2, d, d, o));
    const scroll = Math.min(gate.gw * 0.16, 18);
    els.push({ type: 'curveArrow', x1: centerX, y1: cy, x2: centerX - scroll, y2: cy + d * 0.2,
      cx: centerX - scroll * 0.35, cy: cy - d, heads: 'none', color: o.color, lineWidth: _thinW(o) },
    { type: 'curveArrow', x1: centerX, y1: cy, x2: centerX + scroll, y2: cy + d * 0.2,
      cx: centerX + scroll * 0.35, cy: cy - d, heads: 'none', color: o.color, lineWidth: _thinW(o) });
    if (style === 'concaveOrnate') {
      const side = Math.min(22, gate.gw * 0.2);
      [gate.gx + gate.gw * 0.25, gate.gx + gate.gw * 0.75].forEach((sx, i) => {
        els.push(_circleT(sx - d * 0.32, cy + d * 0.9, d * 0.64, d * 0.64, o),
          { type: 'curveArrow', x1: sx, y1: cy + d, x2: sx + (i ? side : -side), y2: cy + d * 1.8,
            cx: sx + (i ? side : -side) * 0.55, cy: cy - d * 0.2,
            heads: 'none', color: o.color, lineWidth: _thinW(o) });
      });
    }
    if (style === 'concaveFan') {
      const hubY = cy + d * 1.5;
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const ex = centerX + i * gate.gw * 0.065;
        const ey = meetingTop + Math.abs(i) * d * 0.22;
        els.push(_lineT(centerX, hubY, ex, ey, o));
      }
      els.push(_circleT(centerX - d * 0.28, hubY - d * 0.28, d * 0.56, d * 0.56, o));
    }
    if (style === 'concaveLyre') {
      const lyreBottom = Math.min(ground - 8, cy + d * 2.7);
      const arm = Math.min(24, gate.gw * 0.2);
      els.push(
        { type: 'curveArrow', x1: centerX, y1: lyreBottom, x2: centerX - arm, y2: cy,
          cx: centerX - arm * 1.05, cy: cy + d * 1.35,
          heads: 'none', color: o.color, lineWidth: _thinW(o) },
        { type: 'curveArrow', x1: centerX, y1: lyreBottom, x2: centerX + arm, y2: cy,
          cx: centerX + arm * 1.05, cy: cy + d * 1.35,
          heads: 'none', color: o.color, lineWidth: _thinW(o) },
        _lineT(centerX, cy, centerX, lyreBottom, o),
        _lineT(centerX - arm, cy, centerX + arm, cy, o),
      );
    }
    if (style === 'concaveDiamond') {
      const y1 = cy + d * 0.8, y2 = Math.min(ground - 8, y1 + d * 2.2);
      const cells = 6, step = gate.gw / cells;
      for (let i = 0; i < cells; i++) {
        const ax = gate.gx + i * step, bx = ax + step;
        els.push(_lineT(ax, (i % 2 ? y2 : y1), bx, (i % 2 ? y1 : y2), o),
          _lineT(ax, (i % 2 ? y1 : y2), bx, (i % 2 ? y2 : y1), o));
      }
    }
    if (style === 'concaveRings') {
      const ringD = Math.min(13, Math.max(7, gate.gw / 9));
      const rings = Math.max(3, Math.min(7, Math.floor(gate.gw / (ringD * 1.25))));
      const ringY = Math.min(ground - ringD - 7, cy + d * 1.25);
      for (let i = 0; i < rings; i++) {
        const rx = gate.gx + gate.gw * (i + 0.5) / rings;
        els.push(_circleT(rx - ringD / 2, ringY, ringD, ringD, o));
      }
      els.push(_lineT(gate.gx, ringY + ringD / 2, gate.gx + gate.gw, ringY + ringD / 2, o));
    }
    if (style === 'concavePalmette') {
      const palY = Math.min(ground - d * 2.2, cy + d * 0.9);
      [0.25, 0.75].forEach(pos => {
        const px = gate.gx + gate.gw * pos;
        els.push(_lineT(px, palY, px, palY + d * 2, o),
          _lineT(px, palY + d * 0.45, px - d, palY - d * 0.35, o),
          _lineT(px, palY + d * 0.45, px + d, palY - d * 0.35, o),
          _lineT(px, palY + d * 0.85, px - d * 1.25, palY + d * 0.2, o),
          _lineT(px, palY + d * 0.85, px + d * 1.25, palY + d * 0.2, o),
          _circleT(px - d * 0.32, palY + d * 0.75, d * 0.64, d * 0.64, o));
      });
    }
    return els;
  }

  // Cancela monumental de perfil convexo inspirada en portadas urbanas de
  // hierro: barrotera muy tupida arriba, cenefa calada en el centro y zócalo
  // ciego de paneles moldurados. El punto más alto está en el encuentro de
  // las dos hojas, a diferencia del seno de las variantes cóncavas.
  function _wallGateConvexPanel(gate, top, ground, o, pxM) {
    const style = o.wallGateType;
    const centerX = gate.gx + gate.gw / 2;
    const totalH = ground - top;
    const rise = Math.min(totalH * 0.22, Math.max(10, gate.gw * 0.15));
    const edgeTop = top + rise;
    const panelRatio = style === 'convexBlind' ? 0.62 : 0.43;
    const panelTop = ground - Math.max(24, totalH * panelRatio);
    const bandH = Math.max(8, Math.min(15, totalH * 0.1));
    const bandTop = panelTop - bandH;
    const els = [];

    // Dos pletinas curvas, una por hoja, con tangente suave en la coronación.
    const profiles = [
      { x1: gate.gx, y1: edgeTop, x2: centerX, y2: top,
        cx: gate.gx + gate.gw * 0.34, cy: top },
      { x1: centerX, y1: top, x2: gate.gx + gate.gw, y2: edgeTop,
        cx: gate.gx + gate.gw * 0.66, cy: top },
    ];
    profiles.forEach(p => els.push({ type: 'curveArrow', ...p, heads: 'none',
      color: o.color, lineWidth: o.lineWidth }));

    // Barrotes densos: el perfil superior se evalúa como parábola para que
    // cada lanza nazca exactamente sobre la pletina curva.
    const barMax = style === 'convexBlind' ? 20 : 30;
    const bars = Math.max(12, Math.min(barMax, Math.round(gate.gw / Math.max(5, pxM * 0.075))));
    const step = gate.gw / bars;
    const tip = Math.max(4, Math.min(10, totalH * 0.06));
    for (let i = 1; i < bars; i++) {
      const x = gate.gx + step * i;
      const u = Math.abs(x - centerX) / (gate.gw / 2);
      const y = top + rise * u * u;
      els.push(_lineT(x, y, x, bandTop, o),
        _lineT(x - step * 0.24, y, x, y - tip, o),
        _lineT(x + step * 0.24, y, x, y - tip, o));
    }

    // Cenefa central: marco doble y sucesión de rombos con rosetas, como la
    // banda calada de la referencia.
    els.push(_rectEl(gate.gx, bandTop, gate.gw, bandH, o));
    const cells = 8, cellW = gate.gw / cells, midY = bandTop + bandH / 2;
    for (let i = 0; i < cells; i++) {
      const x1 = gate.gx + i * cellW, x2 = x1 + cellW;
      els.push(_lineT(x1, midY, (x1 + x2) / 2, bandTop + 1, o),
        _lineT((x1 + x2) / 2, bandTop + 1, x2, midY, o),
        _lineT(x2, midY, (x1 + x2) / 2, bandTop + bandH - 1, o),
        _lineT((x1 + x2) / 2, bandTop + bandH - 1, x1, midY, o));
      if (i % 2 === 0) {
        const d = Math.min(6, bandH * 0.42);
        els.push(_circleT((x1 + x2 - d) / 2, midY - d / 2, d, d, o));
      }
    }

    // Cuatro casetones inferiores, con doble moldura y pequeño florón.
    const leafW = gate.gw / 2;
    for (let leaf = 0; leaf < 2; leaf++) {
      const lx = gate.gx + leaf * leafW;
      const split = leafW * 0.28;
      const panels = leaf === 0
        ? [[lx + 3, split - 5], [lx + split + 2, leafW - split - 5]]
        : [[lx + 3, leafW - split - 5], [lx + leafW - split + 2, split - 5]];
      panels.forEach(([px, pw]) => {
        const py = panelTop + 4, ph = ground - py - 3;
        if (pw <= 8 || ph <= 10) return;
        els.push(_rectEl(px, py, pw, ph, o));
        const inset = Math.min(6, pw * 0.16, ph * 0.12);
        els.push(_rectT(px + inset, py + inset, pw - 2 * inset, ph - 2 * inset, o));
        const d = Math.min(9, pw * 0.24, ph * 0.16);
        const cx = px + pw / 2, cy = py + ph / 2;
        els.push(_circleT(cx - d / 2, cy - d / 2, d, d, o),
          _lineT(cx, cy - d * 1.25, cx, cy + d * 1.25, o),
          _lineT(cx - d * 0.75, cy, cx + d * 0.75, cy, o));
      });
    }

    if (style === 'convexFan') {
      // Abanico imperial superpuesto a la barrotera: un cubo central y radios
      // que se abren hacia la coronación, reforzando visualmente su cresta.
      const hubY = bandTop - Math.max(8, totalH * 0.08);
      const hubD = Math.min(14, gate.gw * 0.1);
      els.push(_circleT(centerX - hubD / 2, hubY - hubD / 2, hubD, hubD, o));
      for (let i = -5; i <= 5; i++) {
        if (i === 0) continue;
        const ex = centerX + i * gate.gw * 0.042;
        const u = Math.abs(ex - centerX) / (gate.gw / 2);
        const ey = top + rise * u * u + tip * 1.4;
        els.push(_lineT(centerX, hubY, ex, ey, o));
      }
    }

    if (style === 'convexMedallion') {
      // Segunda cenefa estrecha y grandes medallones en los paños principales.
      const secondH = Math.max(6, bandH * 0.65);
      els.push(_rectT(gate.gx, panelTop + 3, gate.gw, secondH, o));
      [0.25, 0.75].forEach(pos => {
        const cx = gate.gx + gate.gw * pos;
        const cy = panelTop + (ground - panelTop) * 0.58;
        const d = Math.min(24, gate.gw * 0.16, (ground - panelTop) * 0.42);
        els.push(_circleEl(cx - d / 2, cy - d / 2, d, d, o),
          _circleT(cx - d * 0.34, cy - d * 0.34, d * 0.68, d * 0.68, o),
          _lineT(cx - d * 0.72, cy, cx + d * 0.72, cy, o));
      });
    }

    if (style === 'convexBlind') {
      // Chapa alta acanalada: nervios verticales y zócalo continuo que dejan
      // solo el tercio superior abierto, una versión más privada y defensiva.
      const flutes = 12, fw = gate.gw / flutes;
      for (let i = 1; i < flutes; i++) {
        const x = gate.gx + fw * i;
        els.push(_lineT(x, panelTop + 3, x, ground - 3, o));
      }
      els.push(_rectT(gate.gx + 2, panelTop + 2, gate.gw - 4, ground - panelTop - 4, o));
    }
    els.push(_line(centerX, top, centerX, ground, o));
    return els;
  }

  // Portón recto de chapa ciega con montante superior abierto. Las hojas son
  // austeras y pesadas; la ornamentación se concentra en una banda de
  // remaches, los florones bajos y el pequeño pináculo del encuentro.
  function _wallGateSolidTransom(gate, top, ground, o, pxM) {
    const centerX = gate.gx + gate.gw / 2;
    const totalH = ground - top;
    const transomH = Math.max(18, Math.min(38, totalH * 0.25));
    const leafTop = top + transomH;
    const bandH = Math.max(7, Math.min(13, totalH * 0.08));
    const els = [_rectEl(gate.gx, top, gate.gw, transomH, o)];

    const bars = Math.max(8, Math.min(20, Math.round(gate.gw / Math.max(7, pxM * 0.1))));
    const step = gate.gw / bars;
    for (let i = 1; i < bars; i++) {
      const x = gate.gx + step * i;
      els.push(_lineT(x, top + 2, x, leafTop - 2, o));
    }

    // Banda claveteada bajo el montante.
    els.push(_rectT(gate.gx, leafTop - bandH, gate.gw, bandH, o));
    const rivets = Math.max(6, Math.min(16, Math.round(gate.gw / 11)));
    const rd = Math.max(2.5, Math.min(5, bandH * 0.38));
    for (let i = 0; i < rivets; i++) {
      const x = gate.gx + gate.gw * (i + 0.5) / rivets;
      els.push(_circleT(x - rd / 2, leafTop - bandH / 2 - rd / 2, rd, rd, o));
    }

    // Dos grandes hojas de chapa, con marco, bisagras y florón bajo.
    const leafW = gate.gw / 2;
    for (let leaf = 0; leaf < 2; leaf++) {
      const x = gate.gx + leaf * leafW;
      els.push(_rectEl(x, leafTop, leafW, ground - leafTop, o));
      const inset = Math.max(3, Math.min(8, leafW * 0.08));
      els.push(_rectT(x + inset, leafTop + inset, leafW - 2 * inset,
        ground - leafTop - 2 * inset, o));
      [0.28, 0.7].forEach(pos => {
        const hx = leaf === 0 ? x + inset * 0.8 : x + leafW - inset * 0.8;
        const hy = leafTop + (ground - leafTop) * pos;
        els.push(_circleT(hx - rd / 2, hy - rd / 2, rd, rd, o));
      });
      const fx = x + leafW / 2, fy = ground - Math.max(12, totalH * 0.13);
      const fr = Math.min(10, leafW * 0.14);
      els.push(_circleT(fx - fr * 0.35, fy - fr * 0.35, fr * 0.7, fr * 0.7, o));
      for (let a = 0; a < 8; a++) {
        const angle = Math.PI * a / 4;
        els.push(_lineT(fx + Math.cos(angle) * fr * 0.35, fy + Math.sin(angle) * fr * 0.35,
          fx + Math.cos(angle) * fr, fy + Math.sin(angle) * fr, o));
      }
    }
    els.push(_line(centerX, top, centerX, ground, o),
      _lineT(centerX - 5, top, centerX, top - 10, o),
      _lineT(centerX + 5, top, centerX, top - 10, o));
    return els;
  }

  // Dos portones completamente calados para la misma portada urbana del
  // portón ciego. En ambos, los barrotes recorren toda la hoja y terminan en
  // lanzas: no hay chapa ni casetones que oculten la vista. La variante
  // ornamental añade una cenefa de roleos, pero conserva el ritmo defensivo.
  function _wallGateOpen(gate, top, ground, o, pxM, style) {
    const centerX = gate.gx + gate.gw / 2;
    const totalH = ground - top;
    const tip = Math.max(6, Math.min(12, totalH * 0.1));
    const railTop = top + tip;
    const railH = Math.max(3, Math.min(7, totalH * 0.055));
    const gap = style === 'openScrolls'
      ? Math.max(10, Math.min(17, pxM * 0.16))
      : Math.max(8, Math.min(14, pxM * 0.13));
    const n = _barCount(gate.gw, gap), step = gate.gw / n;
    const els = [
      _rectEl(gate.gx, railTop, gate.gw, railH, o),
      _line(gate.gx, railTop, gate.gx, ground, o),
      _line(gate.gx + gate.gw, railTop, gate.gx + gate.gw, ground, o),
      _line(gate.gx, ground, gate.gx + gate.gw, ground, o),
      _line(centerX, top, centerX, ground, o),
    ];

    // Barrotera transparente a toda altura y punta de lanza sobre cada barra.
    for (let i = 1; i < n; i++) {
      const x = gate.gx + step * i;
      els.push(_lineT(x, railTop + railH, x, ground, o),
        _lineT(x - step * 0.22, railTop, x, top, o),
        _lineT(x + step * 0.22, railTop, x, top, o));
    }

    if (style === 'openBars') {
      // Dos travesaños rectos arriostran las hojas sin convertirlas en paños
      // ciegos; el resultado es el portón tradicional más sobrio.
      const y1 = railTop + (ground - railTop) * 0.42;
      const y2 = railTop + (ground - railTop) * 0.78;
      els.push(_lineT(gate.gx, y1, gate.gx + gate.gw, y1, o),
        _lineT(gate.gx, y2, gate.gx + gate.gw, y2, o));
      return els;
    }

    // Cenefa abierta de roleos contrapuestos y rosetas. Los adornos ocupan
    // solo una franja central y nunca forman una superficie continua.
    const bandY = railTop + (ground - railTop) * 0.48;
    const bandH = Math.max(11, Math.min(22, totalH * 0.15));
    els.push(_lineT(gate.gx, bandY - bandH / 2, gate.gx + gate.gw, bandY - bandH / 2, o),
      _lineT(gate.gx, bandY + bandH / 2, gate.gx + gate.gw, bandY + bandH / 2, o));
    const bays = Math.max(4, Math.min(8, Math.round(gate.gw / 24)));
    const bayW = gate.gw / bays;
    const rosette = Math.max(4, Math.min(9, bandH * 0.42));
    for (let i = 0; i < bays; i++) {
      const x1 = gate.gx + i * bayW, x2 = x1 + bayW;
      const cx = (x1 + x2) / 2;
      els.push(_circleT(cx - rosette / 2, bandY - rosette / 2, rosette, rosette, o),
        { type: 'curveArrow', x1: x1 + 1, y1: bandY, x2: cx, y2: bandY,
          cx: x1 + bayW * 0.28, cy: bandY - bandH * 0.72,
          heads: 'none', color: o.color, lineWidth: _thinW(o) },
        { type: 'curveArrow', x1: cx, y1: bandY, x2: x2 - 1, y2: bandY,
          cx: x1 + bayW * 0.72, cy: bandY + bandH * 0.72,
          heads: 'none', color: o.color, lineWidth: _thinW(o) });
    }
    return els;
  }

  /**
   * Cancela de portada: dos pilastras rematadas en cornisa y bola —lo que
   * convierte un hueco en una ENTRADA—, arco de dovelas sobre el vano y una o
   * dos hojas de reja con puntas. Su alto es un ajuste propio en metros
   * (`o.wallGateHeight`) medido sobre la misma escala que el muro, así que una
   * cancela de 2 m sobre un muro de 1 m asoma por encima con las pilastras
   * acompañándola.
   */
  function _wallGateElevation(b, o, gate) {
    const standalone = Number.isFinite(o.standaloneGateHeightCm);
    const pxM = standalone ? GATE_PX_PER_CM * 100 : _wallPxPerM(b, o);
    const ground = b.y + b.h;
    const gh = standalone
      ? b.h
      : Math.min(pxM * WALL_GATE_H_MAX, Math.max(14, _wallGateH(o) * pxM));
    const top = ground - gh;
    const solidTransom = o.wallGateType === 'solidTransom';
    const openPortal = ['openBars', 'openScrolls'].includes(o.wallGateType);
    const urbanPortal = solidTransom || openPortal;
    const convexPanel = ['convexPanel', 'convexFan', 'convexMedallion',
      'convexBlind'].includes(o.wallGateType);
    const concave = ['concave', 'concaveSwan', 'concavePanel',
      'concaveOrnate', 'concaveFan', 'concaveLyre', 'concaveDiamond',
      'concaveRings', 'concavePalmette'].includes(o.wallGateType);
    const arch = concave || convexPanel || urbanPortal ? [] : _wallGateArch(gate, top, o, pxM);
    const rise = Math.max(4, Math.min(30, pxM * 0.18));
    // El fuste sube hasta la clave del arco: una pilastra más baja que su
    // propio arco no sostiene nada.
    const pTop = Math.min(top - (arch.length ? gate.gw * 0.28 + rise * 0.5 : rise), b.y - 2);
    const els = [];
    [gate.x1, gate.gx + gate.gw].forEach(px => els.push(...(
      urbanPortal ? _wallBrickPier(px, pTop, gate.pw, ground, o, pxM)
        : _wallPier(px, pTop, gate.pw, ground, o, pxM)
    )));
    els.push(...arch);
    if (concave) {
      els.push(..._wallGateConcave(gate, top, ground, o, pxM));
      return els;
    }
    if (convexPanel) {
      els.push(..._wallGateConvexPanel(gate, top, ground, o, pxM));
      return els;
    }
    if (solidTransom) {
      els.push(..._wallGateSolidTransom(gate, top, ground, o, pxM));
      return els;
    }
    if (openPortal) {
      els.push(..._wallGateOpen(gate, top, ground, o, pxM, o.wallGateType));
      return els;
    }
    const leaves = o.wallGateType === 'double' ? 2 : 1;
    const leafW = gate.gw / leaves;
    const gap = Math.max(8, Math.min(16, pxM * 0.15));
    for (let i = 0; i < leaves; i++) {
      els.push(..._railPanel(gate.gx + i * leafW, top, leafW, gh, o, gap));
    }
    if (leaves === 2) els.push(_line(gate.gx + leafW, top, gate.gx + leafW, ground, o));
    return els;
  }

  /* ── Iluminación ──
     Siete modelos, todos dentro de la caja del arrastre. La geometría es
     RELATIVA a `b` y con un `Math.max` en cada detalle: el mismo código pinta
     el icono del catálogo a 56×48 px, y sin suelo mínimo las volutas y los
     barrotes se convierten allí en una mancha. */

  // Arco de detalle (volutas y tornapuntas de la forja): mismo recurso que
  // _balconyIron —un curveArrow sin puntas— con reserva a recta si el arco
  // degenera.
  const _arcT = (x1, y1, x2, y2, sag, o) => {
    const a = ArcMath.arcCtrls(x1, y1, x2, y2, sag);
    return a
      ? { type: 'curveArrow', x1, y1, x2, y2,
          cx: a.cx, cy: a.cy, cx2: a.cx2, cy2: a.cy2,
          arc: true, heads: 'none', color: o.color, lineWidth: _thinW(o) }
      : _lineT(x1, y1, x2, y2, o);
  };

  // Rotación en torno a un punto: la usa el proyector, que es la única pieza
  // de la sección que no está a escuadra (un foco apuntando al frente no se
  // lee como tal).
  const _rotAt = (cx, cy, ang) => (px, py) => {
    const dx = px - cx, dy = py - cy, c = Math.cos(ang), s = Math.sin(ang);
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  };

  const _lightMetrics = b => {
    const shaftW = Math.max(2, Math.min(b.w * 0.12, b.h * 0.035));
    return {
      cx: b.x + b.w / 2,
      ground: b.y + b.h,
      shaftW,
      baseH: Math.max(3, b.h * 0.05),
      baseW: Math.max(shaftW * 2.6, b.w * 0.3),
    };
  };

  /**
   * Farol: tronco de pirámide con la boca ancha ABAJO, capucha y perilla.
   * `top` es el remate y `h` incluye solo el cuerpo (la perilla sobresale por
   * arriba, igual que el vuelo del balcón sobresale a los lados).
   */
  function _lantern(cx, top, w, h, o) {
    const hb = w / 2, ht = w * 0.34;
    const els = _poly([[cx - ht, top], [cx + ht, top],
                       [cx + hb, top + h], [cx - hb, top + h]], o);
    const cap = Math.max(2, h * 0.16);
    els.push(_lineT(cx - ht * 1.4, top, cx + ht * 1.4, top, o));   // capucha
    els.push(_lineT(cx, top - cap, cx, top, o));                   // perilla
    if (h > 8) els.push(_lineT(cx, top, cx, top + h, o));          // montante
    return els;
  }

  // Fuste ligeramente troncocónico desde `yTop` hasta el dado, más el dado.
  function _lightShaft(m, o, yTop) {
    const wT = m.shaftW, wB = m.shaftW * 1.8, yB = m.ground - m.baseH;
    const els = _poly([[m.cx - wT / 2, yTop], [m.cx + wT / 2, yTop],
                       [m.cx + wB / 2, yB], [m.cx - wB / 2, yB]], o);
    els.push(_rectEl(m.cx - m.baseW / 2, yB, m.baseW, m.baseH, o));
    return els;
  }

  // Volutas simétricas bajo el farol: lo que distingue la forja de la lisa.
  function _lightScrolls(cx, y, span, drop, o) {
    const els = [];
    for (const s of [-1, 1]) {
      els.push(_arcT(cx, y + drop, cx + s * span, y, s * drop * 0.9, o));
    }
    return els;
  }

  // Despacho del botón Iluminación según o.lightType (elegido en el modal).
  function _lightTool(b, o) {
    switch (o.lightType) {
      case 'post2':  return _lightPost2(b, o);
      case 'forge':  return _lightForge(b, o);
      case 'forge2': return _lightForge2(b, o);
      case 'wall':   return _lightWall(b, o);
      case 'spot':   return _lightSpot(b, o);
      case 'tower':  return _lightTower(b, o);
      default:       return _lightPost(b, o);   // 'post'
    }
  }

  // Farola de pie: un farol sobre el fuste.
  function _lightPost(b, o) {
    const m = _lightMetrics(b);
    const lw = Math.max(6, Math.min(b.w * 0.72, b.h * 0.17));
    const lh = Math.max(6, Math.min(b.h * 0.2, lw * 1.3));
    const top = b.y + Math.max(2, b.h * 0.05);
    return [..._lantern(m.cx, top, lw, lh, o), ..._lightShaft(m, o, top + lh)];
  }

  // Doble foco: UN fuste con travesaño y dos faroles colgados de sus extremos
  // —no dos farolas—, que es lo que distingue el modelo.
  function _lightPost2(b, o) {
    const m = _lightMetrics(b);
    const lw = Math.max(5, Math.min(b.w * 0.36, b.h * 0.13));
    const lh = Math.max(5, Math.min(b.h * 0.16, lw * 1.3));
    const top = b.y + Math.max(2, b.h * 0.05);
    const arm = Math.max(lw * 0.8, b.w * 0.3);
    const armY = top + lh + Math.max(3, b.h * 0.035);
    const els = [];
    for (const s of [-1, 1]) {
      els.push(..._lantern(m.cx + s * arm, top, lw, lh, o));
      els.push(_lineT(m.cx + s * arm, top + lh, m.cx + s * arm, armY, o));
    }
    els.push(_line(m.cx - arm, armY, m.cx + arm, armY, o));
    return [...els, ..._lightShaft(m, o, armY)];
  }

  // Forja: mismo esqueleto que la lisa más volutas en el cuello y un anillo
  // en el fuste.
  function _lightForge(b, o) {
    const m = _lightMetrics(b);
    const lw = Math.max(6, Math.min(b.w * 0.66, b.h * 0.16));
    const lh = Math.max(6, Math.min(b.h * 0.19, lw * 1.3));
    const top = b.y + Math.max(3, b.h * 0.06);
    const neck = top + lh;
    const els = [..._lantern(m.cx, top, lw, lh, o)];
    els.push(..._lightScrolls(m.cx, neck, Math.max(4, lw * 0.6),
                              Math.max(4, b.h * 0.06), o));
    els.push(..._lightShaft(m, o, neck));
    const rh = Math.max(3, b.h * 0.022);
    const ry = m.ground - m.baseH - Math.max(6, b.h * 0.11);
    els.push(_circleT(m.cx - m.shaftW, ry, m.shaftW * 2, rh, o));
    return els;
  }

  // Forja de doble foco: los brazos son arcos, no un travesaño recto.
  function _lightForge2(b, o) {
    const m = _lightMetrics(b);
    const lw = Math.max(5, Math.min(b.w * 0.34, b.h * 0.12));
    const lh = Math.max(5, Math.min(b.h * 0.15, lw * 1.3));
    const top = b.y + Math.max(3, b.h * 0.06);
    const arm = Math.max(lw * 0.85, b.w * 0.3);
    const knot = top + lh + Math.max(6, b.h * 0.09);
    const els = [];
    for (const s of [-1, 1]) {
      els.push(..._lantern(m.cx + s * arm, top, lw, lh, o));
      els.push(_arcT(m.cx, knot, m.cx + s * arm, top + lh,
                     s * Math.max(4, arm * 0.35), o));
    }
    els.push(..._lightScrolls(m.cx, knot, Math.max(4, arm * 0.42),
                              Math.max(4, b.h * 0.05), o));
    return [...els, ..._lightShaft(m, o, knot)];
  }

  // De pared: no lleva fuste ni dado —va colgada—, así que su caja es la placa
  // de anclaje, el brazo y el farol. Mismo recurso que el balcón francés: los
  // anclajes al muro son lo que dice que esto no se sostiene solo.
  function _lightWall(b, o) {
    const pw = Math.max(3, b.w * 0.11), ph = Math.max(8, b.h * 0.36);
    const py = b.y + Math.max(2, b.h * 0.06);
    const lw = Math.max(6, Math.min(b.w * 0.5, b.h * 0.5));
    const lh = Math.max(6, Math.min(b.h * 0.42, lw * 1.3));
    const cx = b.x + b.w - lw / 2;
    const armY = py + Math.max(3, ph * 0.22);
    const hang = Math.max(3, b.h * 0.06);
    const els = [_rectEl(b.x, py, pw, ph, o)];                 // placa
    els.push(_line(b.x + pw, armY, cx, armY, o));              // brazo
    els.push(_arcT(b.x + pw, py + ph * 0.92,
                   b.x + pw + (cx - b.x - pw) * 0.55, armY,
                   Math.max(4, b.w * 0.16), o));               // tornapunta
    els.push(_lineT(cx, armY, cx, armY + hang, o));            // colgante
    els.push(..._lantern(cx, armY + hang, lw, lh, o));
    for (const ay of [py + ph * 0.14, py + ph * 0.86]) {       // anclajes
      els.push(_lineT(b.x - Math.max(3, pw), ay, b.x, ay, o));
    }
    return els;
  }

  // Foco: proyector troncocónico sobre rótula, horquilla y pletina. Es la
  // única pieza girada de la sección —un proyector a escuadra no se lee como
  // un foco, sino como una caja.
  function _lightSpot(b, o) {
    const cx = b.x + b.w / 2, ground = b.y + b.h;
    const baseW = Math.max(8, b.w * 0.52), baseH = Math.max(3, b.h * 0.08);
    const postH = Math.max(4, b.h * 0.16);
    const hy = ground - baseH - postH;
    const hw = Math.max(10, Math.min(b.w * 0.72, b.h * 0.5));
    const hh = Math.max(8, hw * 0.6);
    const p = _rotAt(cx, hy, -0.42);
    const at = (dx, dy) => p(cx + dx, hy + dy);
    const els = _poly([at(-hw * 0.44, -hh * 0.26), at(hw * 0.5, -hh * 0.5),
                       at(hw * 0.5, hh * 0.5), at(-hw * 0.44, hh * 0.26)], o);
    els.push(_lineT(...at(hw * 0.26, -hh * 0.43), ...at(hw * 0.26, hh * 0.43), o));
    const r = Math.max(4, b.w * 0.11);
    els.push(_circleT(cx - r / 2, hy - r / 2, r, r, o));        // rótula
    els.push(_line(cx, hy, cx, ground - baseH, o));             // horquilla
    els.push(_rectEl(cx - baseW / 2, ground - baseH, baseW, baseH, o));
    return els;
  }

  // Torre: mástil de celosía con cruces de San Andrés y corona de proyectores.
  function _lightTower(b, o) {
    const cx = b.x + b.w / 2, ground = b.y + b.h;
    const headH = Math.max(9, b.h * 0.14);
    const topY = b.y + headH, H = Math.max(1, ground - topY);
    const wT = Math.max(4, b.w * 0.22), wB = Math.max(wT + 4, b.w * 0.66);
    const half = t => (wT + (wB - wT) * t) / 2;
    const els = [_line(cx - half(0), topY, cx - half(1), ground, o),
                 _line(cx + half(0), topY, cx + half(1), ground, o)];
    const n = Math.max(2, Math.min(9, Math.round(H / Math.max(12, b.w * 0.34))));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const y0 = topY + H * t0, y1 = topY + H * t1;
      els.push(_lineT(cx - half(t0), y0, cx + half(t1), y1, o),
               _lineT(cx + half(t0), y0, cx - half(t1), y1, o));
      if (i) els.push(_lineT(cx - half(t0), y0, cx + half(t0), y0, o));
    }
    const cw = Math.max(wT * 1.8, b.w * 0.56);
    els.push(_line(cx - cw / 2, topY, cx + cw / 2, topY, o));   // pasarela
    const k = 3, pw = (cw / k) * 0.72, ph = Math.max(4, headH * 0.62);
    for (let i = 0; i < k; i++) {
      const x = cx - cw / 2 + cw * (i + 0.5) / k - pw / 2;
      els.push(_rectT(x, topY - ph, pw, ph, o));
    }
    return els;
  }

  return { elements, MIN_SPAN, ROOF_FRAC, FLOOR_H,
    WALL_GATE_H_MIN, WALL_GATE_H_MAX, WALL_RAIL_H_MIN, WALL_RAIL_H_MAX,
    FENCE_H_MIN_CM, FENCE_H_MAX_CM, GATE_H_MIN_CM, GATE_H_MAX_CM };
})();
