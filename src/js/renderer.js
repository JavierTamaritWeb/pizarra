/* ============================================================
   renderer.js — Canvas rendering for all element types
   ============================================================ */

const Renderer = (() => {
  /**
   * Tamaño real de un borrador. Los proyectos anteriores a v1.8.1 no
   * guardaban `size`: conservamos su aspecto histórico (lineWidth × 4).
   */
  function eraserSize(el) {
    return Number.isFinite(el.size) ? el.size : el.lineWidth * 4;
  }

  /* ── Estilo del texto: grosor y sombra (v2.16.0) ──────────────────────
     Los dos son opcionales y su AUSENCIA es el aspecto de siempre, así que
     los proyectos anteriores se dibujan exactamente igual. */

  /** `ctx.font` de un elemento de texto, con su grosor. Tres de las siete
      familias no tienen corte de negrita y el navegador la sintetiza; eso
      es cosa suya y aquí no se distingue. */
  function textFont(el) {
    return `${el.bold ? 'bold ' : ''}${el.fontSize}px ${sketchFont()}`;
  }

  /**
   * Configura la sombra del contexto para un elemento de texto (y la apaga si
   * no lleva). Las medidas de TEXT_SHADOWS están tomadas a SHADOW_REF_SIZE y
   * se escalan con la letra: si no, la sombra de un título de 60px sería la
   * misma manchita de 2px que la de una nota, y a tamaño grande no se vería.
   * Quien llama debe haber hecho save() — restore() la deja limpia.
   */
  function applyTextShadow(ctx, el) {
    const s = textShadowById(el.shadow);
    if (s.id === 'none') {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      return;
    }
    const k = (el.fontSize || SHADOW_REF_SIZE) / SHADOW_REF_SIZE;
    ctx.shadowColor = el.shadowColor || DEFAULT_SHADOW_COLOR;
    ctx.shadowBlur = s.blur * k;
    ctx.shadowOffsetX = s.dx * k;
    ctx.shadowOffsetY = s.dy * k;
  }

  /* ── Caché de imágenes (elementos type:image con src data-URL) ── */

  const _imgCache = new Map();
  let _onImageLoad = null;

  /** app.js registra aquí su redraw para repintar cuando cargue una imagen */
  function setImageLoadCallback(fn) {
    _onImageLoad = fn;
  }

  function _getImage(src) {
    let img = _imgCache.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => { if (_onImageLoad) _onImageLoad(); };
      // Un data-URL que no decodifica se queda dibujado como placeholder;
      // avisar igualmente deja el guion pintado sin esperar un load imposible.
      img.onerror = () => { if (_onImageLoad) _onImageLoad(); };
      img.src = src;
      _imgCache.set(src, img);
    }
    return img;
  }

  /**
   * Poda de la caché de imágenes: conserva solo los `src` del set recibido
   * (escena + historial de undo/redo, que app.js recopila en cada autosave).
   * Sin esto, cada imagen distinta de una sesión larga —data-URLs de
   * megabytes— quedaba retenida en memoria para siempre, aunque su elemento
   * se hubiera borrado.
   */
  function pruneImageCache(liveSrcs) {
    let evicted = 0;
    for (const src of [..._imgCache.keys()]) {
      if (!liveSrcs.has(src)) { _imgCache.delete(src); evicted++; }
    }
    return evicted; // cuántas expulsó: única observabilidad (la caché es privada)
  }

  function _image(ctx, el) {
    // En entornos sin Image (tests en Node) se dibuja solo el placeholder
    const img = (typeof Image !== 'undefined') ? _getImage(el.src) : null;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, el.x, el.y, el.w, el.h);
      return;
    }
    // Placeholder mientras carga (o si el src es irrecuperable)
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.lineWidth;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(el.x, el.y, el.w, el.h);
    ctx.setLineDash([]);
  }

  /* ── Etiqueta de flecha (arrow/curveArrow) ── */

  /**
   * Punto del trazo donde va la etiqueta: parámetro labelT (0.5 por defecto)
   * sobre la Bézier (cuadrática o cúbica) o el segmento de la flecha.
   */
  function _arrowMid(el) {
    const t = el.labelT !== undefined ? el.labelT : 0.5;
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      return CurvePath.pointAt(el, t);
    }
    const mt = 1 - t;
    if (el.type === 'curveArrow') {
      if (el.cx2 !== undefined) {
        return {
          x: mt * mt * mt * el.x1 + 3 * mt * mt * t * el.cx + 3 * mt * t * t * el.cx2 + t * t * t * el.x2,
          y: mt * mt * mt * el.y1 + 3 * mt * mt * t * el.cy + 3 * mt * t * t * el.cy2 + t * t * t * el.y2,
        };
      }
      return {
        x: mt * mt * el.x1 + 2 * mt * t * el.cx + t * t * el.x2,
        y: mt * mt * el.y1 + 2 * mt * t * el.cy + t * t * el.y2,
      };
    }
    return { x: mt * el.x1 + t * el.x2, y: mt * el.y1 + t * el.y2 };
  }

  /** Etiqueta 13px centrada sobre el trazo, con halo blanco de legibilidad */
  function _arrowLabel(ctx, el) {
    if (!el.label) return;
    const mid = _arrowMid(el);
    ctx.font = `13px ${sketchFont()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeText(el.label, mid.x, mid.y);
    ctx.fillStyle = el.color;
    ctx.fillText(el.label, mid.x, mid.y);
  }

  /**
   * Color de relleno de una forma: el explícito del elemento si lo tiene,
   * y si no el tinte translúcido del trazo — que es el aspecto clásico y
   * el de los proyectos guardados antes de que el relleno tuviera color
   * propio, así que `fillColor` ausente nunca cambia cómo se ven.
   */
  const DEFAULT_FILL_OPACITY = 0.4;

  function withOpacity(color, opacity) {
    const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
      .toString(16).padStart(2, '0');
    // `color` puede traer alfa propio; la opacidad regulada lo sustituye.
    return color.slice(0, 7) + alpha;
  }

  function fillStyle(el) {
    // Los proyectos anteriores no tienen fillOpacity: conservan el 40%.
    if (el.fillTransparent === true) {
      const opacity = el.fillOpacity !== undefined ? el.fillOpacity : DEFAULT_FILL_OPACITY;
      return withOpacity(el.fillColor || el.color, opacity);
    }
    // Sólido / clásico: color propio opaco, o el tinte 0x20 del trazo si no hay
    return el.fillColor || el.color.slice(0, 7) + '20';
  }

  /* ── Bordes ocultos de formas solapadas ── */

  const OVERLAP_SHAPE_TYPES = new Set([
    'rect', 'roundedRect', 'circle', 'square', 'trapezoid',
    'triangle', 'pentagon', 'hexagon', 'star5', 'star6',
  ]);
  const OUTLINE_STEP = 4;

  function isOverlapShape(el) {
    return !!el && OVERLAP_SHAPE_TYPES.has(el.type);
  }

  function _box(el) {
    const x2 = el.x + el.w, y2 = el.y + el.h;
    return {
      x: Math.min(el.x, x2),
      y: Math.min(el.y, y2),
      w: Math.abs(el.w),
      h: Math.abs(el.h),
    };
  }

  /** Punto dentro de la geometría real de una forma, no de su bounding box. */
  function pointInOverlapShape(point, el) {
    if (!isOverlapShape(el)) return false;
    const b = _box(el);
    if (point.x < b.x || point.x > b.x + b.w ||
        point.y < b.y || point.y > b.y + b.h) return false;
    if (el.type === 'rect') return true;
    if (RegularPolygon.isType(el.type)) return RegularPolygon.contains(point, el);
    if (el.type === 'trapezoid') return Trapezoid.contains(point, el);
    if (el.type === 'circle') {
      const rx = b.w / 2, ry = b.h / 2;
      if (!rx || !ry) return false;
      const dx = (point.x - (b.x + rx)) / rx;
      const dy = (point.y - (b.y + ry)) / ry;
      return dx * dx + dy * dy <= 1;
    }
    const r = Math.min(12, b.w / 2, b.h / 2);
    if (point.x >= b.x + r && point.x <= b.x + b.w - r) return true;
    if (point.y >= b.y + r && point.y <= b.y + b.h - r) return true;
    const cx = point.x < b.x + r ? b.x + r : b.x + b.w - r;
    const cy = point.y < b.y + r ? b.y + r : b.y + b.h - r;
    return (point.x - cx) ** 2 + (point.y - cy) ** 2 <= r * r;
  }

  function _pushLine(points, x1, y1, x2, y2) {
    const count = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / OUTLINE_STEP));
    for (let i = 0; i < count; i++) {
      const t = i / count;
      points.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
    }
  }

  function _pushArc(points, cx, cy, r, start, end) {
    const count = Math.max(2, Math.ceil(Math.abs(end - start) * r / OUTLINE_STEP));
    for (let i = 0; i < count; i++) {
      const a = start + (end - start) * i / count;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }

  function _outlinePoints(el) {
    const b = _box(el);
    const points = [];
    if (!b.w || !b.h) return points;
    if (RegularPolygon.isType(el.type)) {
      const vertices = RegularPolygon.vertices(el);
      vertices.forEach((vertex, index) => {
        const next = vertices[(index + 1) % vertices.length];
        _pushLine(points, vertex.x, vertex.y, next.x, next.y);
      });
      return points;
    }
    if (el.type === 'trapezoid') {
      const vertices = Trapezoid.vertices(el);
      vertices.forEach((vertex, index) => {
        const next = vertices[(index + 1) % vertices.length];
        _pushLine(points, vertex.x, vertex.y, next.x, next.y);
      });
      return points;
    }
    if (el.type === 'circle') {
      const rx = b.w / 2, ry = b.h / 2;
      const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      const count = Math.max(48, Math.ceil(circumference / OUTLINE_STEP));
      for (let i = 0; i < count; i++) {
        const a = Math.PI * 2 * i / count;
        points.push({ x: b.x + rx + Math.cos(a) * rx, y: b.y + ry + Math.sin(a) * ry });
      }
      return points;
    }
    if (el.type === 'rect') {
      _pushLine(points, b.x, b.y, b.x + b.w, b.y);
      _pushLine(points, b.x + b.w, b.y, b.x + b.w, b.y + b.h);
      _pushLine(points, b.x + b.w, b.y + b.h, b.x, b.y + b.h);
      _pushLine(points, b.x, b.y + b.h, b.x, b.y);
      return points;
    }
    const r = Math.min(12, b.w / 2, b.h / 2);
    _pushLine(points, b.x + r, b.y, b.x + b.w - r, b.y);
    _pushArc(points, b.x + b.w - r, b.y + r, r, -Math.PI / 2, 0);
    _pushLine(points, b.x + b.w, b.y + r, b.x + b.w, b.y + b.h - r);
    _pushArc(points, b.x + b.w - r, b.y + b.h - r, r, 0, Math.PI / 2);
    _pushLine(points, b.x + b.w - r, b.y + b.h, b.x + r, b.y + b.h);
    _pushArc(points, b.x + r, b.y + b.h - r, r, Math.PI / 2, Math.PI);
    _pushLine(points, b.x, b.y + b.h - r, b.x, b.y + r);
    _pushArc(points, b.x + r, b.y + r, r, Math.PI, Math.PI * 1.5);
    return points;
  }

  function _seedNoise(seed, index, axis) {
    const n = Math.sin((Number(seed) || 0) * 12.9898 + index * 78.233 + axis * 37.719) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  function _jitterOutline(points, seed) {
    return points.map((p, i) => ({
      x: p.x + _seedNoise(seed, i, 0) * 0.65,
      y: p.y + _seedNoise(seed, i, 1) * 0.65,
    }));
  }

  /**
   * Para cada segmento del contorno guarda el índice de la forma superior
   * que finalmente lo cubre. -1 significa que el segmento sigue visible.
   */
  function buildOverlapPlan(elements) {
    const plan = elements.map(el => {
      if (!isOverlapShape(el)) return null;
      const ideal = _outlinePoints(el);
      return {
        el,
        ideal,
        points: _jitterOutline(ideal, el.seed),
        targets: new Array(ideal.length).fill(-1),
      };
    });
    for (let i = 0; i < plan.length; i++) {
      const info = plan[i];
      if (!info || !info.ideal.length) continue;
      for (let s = 0; s < info.ideal.length; s++) {
        const a = info.ideal[s];
        const b = info.ideal[(s + 1) % info.ideal.length];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        for (let j = i + 1; j < elements.length; j++) {
          if (plan[j] && pointInOverlapShape(mid, elements[j])) info.targets[s] = j;
        }
      }
    }
    return plan;
  }

  function _distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2
      ? Math.max(0, Math.min(1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2))
      : 0;
    return Math.hypot(
      point.x - (a.x + dx * t),
      point.y - (a.y + dy * t),
    );
  }

  function _pointErased(point, erasers) {
    return erasers.some(eraser => {
      if (!eraser.points || eraser.points.length < 2) return false;
      const radius = eraserSize(eraser) / 2;
      for (let i = 1; i < eraser.points.length; i++) {
        if (_distanceToSegment(point, eraser.points[i - 1], eraser.points[i]) <= radius) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Devuelve subtrazos continuos del contorno asignados a un target.
   * `erasers` permite recortar trazos ocultos que, por su render diferido,
   * se dibujan después de un borrador aunque pertenezcan a una forma anterior.
   */
  function overlapRuns(info, target, erasers = []) {
    if (!info || !info.points.length) return [];
    const runs = [];
    let run = null;
    for (let i = 0; i < info.points.length; i++) {
      if (info.targets[i] !== target) {
        run = null;
        continue;
      }
      if (!run) {
        run = [info.points[i]];
        runs.push(run);
      }
      run.push(info.points[(i + 1) % info.points.length]);
    }
    if (!erasers.length) return runs;

    const visible = [];
    runs.forEach(source => {
      let current = null;
      for (let i = 1; i < source.length; i++) {
        const a = source[i - 1];
        const b = source[i];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (_pointErased(a, erasers) ||
            _pointErased(mid, erasers) ||
            _pointErased(b, erasers)) {
          current = null;
          continue;
        }
        if (!current) {
          current = [a, b];
          visible.push(current);
        } else {
          current.push(b);
        }
      }
    });
    return visible;
  }

  function _drawOverlapRuns(ctx, info, target, dashed, erasers = []) {
    const runs = overlapRuns(info, target, erasers);
    if (!runs.length) return;
    ctx.save();
    ctx.strokeStyle = info.el.color;
    ctx.lineWidth = info.el.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dashed ? [4 * info.el.lineWidth, 4 * info.el.lineWidth] : []);
    ctx.beginPath();
    runs.forEach(run => {
      ctx.moveTo(run[0].x, run[0].y);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ── UI component helpers ── */

  // Tinte por sufijo alfa: el color base puede traer alfa propio (#rrggbbaa,
  // que la validación de import acepta) y concatenar sobre él daría 10
  // dígitos — inválido, y el fillStyle anterior del contexto se quedaría.
  const _tint = (color, alpha) => String(color).slice(0, 7) + alpha;

  function _button(ctx, x, y, w, h, color, lw, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = _tint(color, '15');
    Sketchy.roundedRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.font = `${Math.min(16, h * 0.5)}px ${sketchFont()}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Botón', x + w / 2, y + h / 2);
  }

  function _input(ctx, x, y, w, h, color, lw, label) {
    ctx.strokeStyle = _tint(color, '80');
    ctx.lineWidth = lw;
    Sketchy.roundedRect(ctx, x, y, w, h, 4);
    ctx.font = `${Math.min(13, h * 0.45)}px ${sketchFont()}`;
    ctx.fillStyle = _tint(color, '60');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Escribe aquí...', x + 10, y + h / 2);
  }

  function _imagePlaceholder(ctx, x, y, w, h, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    Sketchy.rect(ctx, x, y, w, h);
    // Cross
    ctx.setLineDash([6, 4]);
    Sketchy.line(ctx, x, y, x + w, y + h);
    Sketchy.line(ctx, x + w, y, x, y + h);
    ctx.setLineDash([]);
    // Mountain icon
    const cx = x + w / 2;
    const cy = y + h / 2;
    const s = Math.min(w, h) * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.6);
    ctx.lineTo(cx - s * 0.3, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.6);
    ctx.lineTo(cx + s, cy + s * 0.6);
    ctx.closePath();
    ctx.stroke();
  }

  function _nav(ctx, x, y, w, h, color, lw, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = _tint(color, '0a');
    Sketchy.rect(ctx, x, y, w, h);
    ctx.fill();
    // Logo
    Sketchy.roundedRect(ctx, x + 10, y + (h - 20) / 2, 60, 20, 4);
    ctx.font = `12px ${sketchFont()}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Logo', x + 20, y + h / 2);
    // Links
    // En español desde la 2.10.0, como el resto de defaults («Botón», «Escribe
    // aquí...», «Título»); el exportador HTML lleva los mismos tres enlaces.
    const links = ['Inicio', 'Nosotros', 'Contacto'];
    // 70px por link (mismo paso que el bucle) + 40 de hueco para la hamburguesa
    const startX = x + w - 70 * links.length - 40;
    links.forEach((link, i) => {
      ctx.fillText(link, startX + i * 70, y + h / 2);
    });
    // Hamburger
    const hx = x + w - 30;
    const hy = y + h / 2 - 6;
    for (let i = 0; i < 3; i++) {
      Sketchy.line(ctx, hx, hy + i * 6, hx + 18, hy + i * 6, 0.5);
    }
  }

  function _card(ctx, x, y, w, h, color, lw, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = '#ffffff08';
    Sketchy.roundedRect(ctx, x, y, w, h, 10);
    ctx.fill();
    // Image area
    const imgH = h * 0.45;
    ctx.fillStyle = _tint(color, '10');
    ctx.fillRect(x + 4, y + 4, w - 8, imgH);
    Sketchy.line(ctx, x + 4, y + imgH + 4, x + w - 4, y + imgH + 4);
    // Title
    ctx.font = `bold 14px ${sketchFont()}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label || 'Título', x + 12, y + imgH + 14);
    // Description lines
    ctx.strokeStyle = _tint(color, '40');
    ctx.lineWidth = 1;
    const descY = y + imgH + 38;
    Sketchy.line(ctx, x + 12, descY, x + w - 20, descY, 0.5);
    Sketchy.line(ctx, x + 12, descY + 12, x + w * 0.7, descY + 12, 0.5);
  }

  function _polygonPath(ctx, vertices) {
    if (!vertices.length) return;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
  }

  function _regularPolygon(ctx, el, options) {
    const vertices = RegularPolygon.vertices(el);
    if (!vertices.length) return;
    if (el.fill && options.shapeFill !== false) {
      ctx.fillStyle = fillStyle(el);
      _polygonPath(ctx, vertices);
      ctx.fill();
    }
    if (options.shapeStroke !== false) {
      vertices.forEach((point, index) => {
        const next = vertices[(index + 1) % vertices.length];
        Sketchy.line(ctx, point.x, point.y, next.x, next.y);
      });
    }
  }

  function _trapezoid(ctx, el, options) {
    const vertices = Trapezoid.vertices(el);
    if (!vertices.length) return;
    if (el.fill && options.shapeFill !== false) {
      ctx.fillStyle = fillStyle(el);
      _polygonPath(ctx, vertices);
      ctx.fill();
    }
    if (options.shapeStroke !== false) {
      vertices.forEach((point, index) => {
        const next = vertices[(index + 1) % vertices.length];
        Sketchy.line(ctx, point.x, point.y, next.x, next.y);
      });
    }
  }

  /**
   * Polígono libre: la lista de puntos ES la geometría, sin caja ni rotación
   * que interpretar. `stroke: false` lo deja SIN contorno, que es como lo
   * emiten las caras laterales de un sólido 3D: sus aristas ya se dibujan
   * aparte, una a una, porque cada una necesita decidir por su cuenta si va
   * discontinua. La ausencia del campo es el aspecto normal, con contorno.
   */
  function _freePolygon(ctx, el, options) {
    const vertices = Array.isArray(el.points) ? el.points : [];
    if (vertices.length < 3) return;
    if (el.fill && options.shapeFill !== false) {
      ctx.fillStyle = fillStyle(el);
      _polygonPath(ctx, vertices);
      ctx.fill();
    }
    if (el.stroke === false || options.shapeStroke === false) return;
    vertices.forEach((point, index) => {
      const next = vertices[(index + 1) % vertices.length];
      Sketchy.line(ctx, point.x, point.y, next.x, next.y);
    });
  }

  /* ── Public: render a single element ── */

  function renderElement(ctx, el, options = {}) {
    ctx.save();
    // Jitter determinista: el mismo seed reproduce exactamente el mismo
    // trazo en cada redraw (sin seed, cae en Math.random y "tiembla")
    Sketchy.setSeed(el.seed);
    ctx.strokeStyle = el.color;
    ctx.lineWidth   = el.lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    switch (el.type) {

      case 'pencil': {
        if (el.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
        break;
      }

      // La nube del aerógrafo. No pasa por Sketchy: el temblor ya lo pone la
      // propia dispersión de las gotas, y su generación vive en airbrush.js
      // para que lienzo y exportaciones no puedan divergir.
      case 'airbrush': {
        ctx.fillStyle = el.color;
        if (el.opacity !== undefined) {
          // Translúcido: un fill POR GOTA, porque ahí la acumulación de alfa
          // es el efecto —dos pasadas cruzadas tienen que oscurecer el cruce.
          // El camino rápido de abajo compondría la unión una sola vez y esa
          // acumulación desaparecería.
          ctx.globalAlpha = el.opacity;
          Airbrush.forEachDot(el, (x, y, r) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          // Sólido: una sola ruta con todas las gotas y UN fill. Con círculos
          // opacos el resultado es idéntico (la unión) y varias veces más
          // rápido. El moveTo antes de cada arc es obligatorio: sin él, arc()
          // encadena una recta desde el punto anterior y la ruta sale cosida.
          ctx.beginPath();
          Airbrush.forEachDot(el, (x, y, r) => {
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          });
          ctx.fill();
        }
        break;
      }

      case 'line':
        if (el.dash) ctx.setLineDash([4 * el.lineWidth, 4 * el.lineWidth]);
        Sketchy.line(ctx, el.x1, el.y1, el.x2, el.y2);
        if (el.dash) ctx.setLineDash([]);
        break;

      case 'arrow': {
        // Cuerpo y puntas descompuestos (mismo orden de consumo del PRNG que
        // Sketchy.arrow) para que el dash aplique solo al cuerpo
        if (el.dash) ctx.setLineDash([4 * el.lineWidth, 4 * el.lineWidth]);
        Sketchy.line(ctx, el.x1, el.y1, el.x2, el.y2);
        if (el.dash) ctx.setLineDash([]);
        const headLen = 10 + 2 * el.lineWidth;
        const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        Sketchy.arrowHead(el.x2, el.y2, angle, headLen).forEach(sg => {
          Sketchy.line(ctx, sg.x1, sg.y1, sg.x2, sg.y2);
        });
        // Doble punta opcional (heads === 'both'): punta también en el inicio
        if (el.heads === 'both') {
          const backAngle = Math.atan2(el.y1 - el.y2, el.x1 - el.x2);
          Sketchy.arrowHead(el.x1, el.y1, backAngle, headLen).forEach(sg => {
            Sketchy.line(ctx, sg.x1, sg.y1, sg.x2, sg.y2);
          });
        }
        _arrowLabel(ctx, el);
        break;
      }

      case 'curveArrow': {
        const curveSegments = CurvePath.segments(el);
        if (el.dash) ctx.setLineDash([4 * el.lineWidth, 4 * el.lineWidth]);
        curveSegments.forEach(seg => {
          if (seg.cx2 !== undefined) {
            Sketchy.cubicCurve(ctx, seg.x1, seg.y1, seg.cx, seg.cy, seg.cx2, seg.cy2, seg.x2, seg.y2);
          } else {
            Sketchy.curve(ctx, seg.x1, seg.y1, seg.cx, seg.cy, seg.x2, seg.y2);
          }
        });
        if (el.dash) ctx.setLineDash([]);
        // Punta escalada con el grosor (10 + 2·lineWidth; 14px con el default)
        const headLen = 10 + 2 * el.lineWidth;
        const curveStart = CurvePath.start(el);
        const curveEnd = CurvePath.end(el);
        // heads:'none' (semicírculos): trazo sin punta en ningún extremo
        if (el.heads !== 'none') {
          // Punta orientada según la tangente del último tramo
          const tangent = CurvePath.endTangent(el);
          Sketchy.arrowHead(curveEnd.x, curveEnd.y, Math.atan2(tangent.dy, tangent.dx), headLen).forEach(sg => {
            Sketchy.line(ctx, sg.x1, sg.y1, sg.x2, sg.y2);
          });
        }
        // Doble punta opcional: tangente del primer tramo hacia el inicio
        if (el.heads === 'both') {
          const tangent = CurvePath.startTangent(el);
          Sketchy.arrowHead(curveStart.x, curveStart.y, Math.atan2(tangent.dy, tangent.dx), headLen).forEach(sg => {
            Sketchy.line(ctx, sg.x1, sg.y1, sg.x2, sg.y2);
          });
        }
        _arrowLabel(ctx, el);
        break;
      }

      case 'rect':
        if (el.fill && options.shapeFill !== false) {
          ctx.fillStyle = fillStyle(el);
          ctx.fillRect(el.x, el.y, el.w, el.h);
        }
        if (options.shapeStroke !== false) Sketchy.rect(ctx, el.x, el.y, el.w, el.h);
        break;

      case 'roundedRect':
        if (el.fill && options.shapeFill !== false) {
          ctx.fillStyle = fillStyle(el);
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.w, el.h, 12);
          ctx.fill();
        }
        if (options.shapeStroke !== false) Sketchy.roundedRect(ctx, el.x, el.y, el.w, el.h, 12);
        break;

      case 'circle': {
        const rx = Math.abs(el.w) / 2;
        const ry = Math.abs(el.h) / 2;
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        if (el.fill && options.shapeFill !== false) {
          ctx.fillStyle = fillStyle(el);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (options.shapeStroke !== false) Sketchy.ellipse(ctx, cx, cy, rx, ry);
        break;
      }

      case 'square':
      case 'triangle':
      case 'pentagon':
      case 'hexagon':
      case 'star5':
      case 'star6':
        _regularPolygon(ctx, el, options);
        break;

      case 'trapezoid':
        _trapezoid(ctx, el, options);
        break;

      case 'polygon':
        _freePolygon(ctx, el, options);
        break;

      case 'text':
        ctx.save();
        ctx.font = textFont(el);
        ctx.fillStyle = el.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        applyTextShadow(ctx, el);
        el.value.split('\n').forEach((ln, i) => {
          ctx.fillText(ln, el.x, el.y + i * (el.fontSize + 4));
        });
        ctx.restore();
        break;

      case 'eraser': {
        if (el.points.length < 2) break;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = eraserSize(el);
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
        break;
      }

      case 'button':           _button(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label); break;
      case 'input':            _input(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label); break;
      case 'imagePlaceholder': _imagePlaceholder(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth); break;
      case 'image':            _image(ctx, el); break;
      case 'nav':              _nav(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label); break;
      case 'card':             _card(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label); break;
    }

    Sketchy.setSeed(null);
    ctx.restore();
  }

  /**
   * Render coordinado de toda la escena. En modo hidden-dashed los fills se
   * mantienen en su z-order, los tramos visibles se dibujan sólidos y cada
   * tramo oculto se difiere hasta la forma superior que lo cubre.
   */
  function renderElements(ctx, elements, overlapMode = 'normal') {
    if (overlapMode !== 'hidden-dashed') {
      elements.forEach(el => renderElement(ctx, el));
      return;
    }
    const plan = buildOverlapPlan(elements);
    elements.forEach((el, index) => {
      const current = plan[index];
      if (!current) {
        renderElement(ctx, el);
        return;
      }
      renderElement(ctx, el, { shapeStroke: false });
      for (let lower = 0; lower < index; lower++) {
        if (plan[lower]) {
          const interveningErasers = elements
            .slice(lower + 1, index)
            .filter(candidate => candidate.type === 'eraser');
          _drawOverlapRuns(ctx, plan[lower], index, true, interveningErasers);
        }
      }
      if (current.targets.every(target => target === -1)) {
        // Una forma cuyo borde no queda oculto conserva exactamente el trazo
        // Sketchy tradicional; solo se sustituye el contorno al tener que
        // dividirlo en segmentos visibles/ocultos.
        renderElement(ctx, el, { shapeFill: false });
      } else {
        _drawOverlapRuns(ctx, current, -1, false);
      }
    });
  }

  /* ── Grid ── */

  function drawGrid(ctx, w, h, color = '#cdd3de') {
    ctx.save();
    const step = 20;
    ctx.strokeStyle = color;
    // Minor grid
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // Major grid
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 0.8;
    for (let x = 0; x < w; x += step * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Render completo con el fondo realmente detrás de los elementos.
   *
   * Es importante dibujar primero el contenido sobre transparencia y añadir
   * después cuadrícula/fondo con destination-over: así un elemento `eraser`
   * perfora los trazos anteriores, pero nunca el propio lienzo ni su rejilla.
   */
  function renderScene(ctx, elements, options = {}) {
    const width = options.width ?? CANVAS_W;
    const height = options.height ?? CANVAS_H;
    const background = options.background || '#ffffff';
    ctx.clearRect(0, 0, width, height);
    try {
      renderElements(ctx, elements, options.overlapMode);
    } finally {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      if (options.showGrid) {
        drawGrid(ctx, width, height, options.gridColor);
      }
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      // Explícito además del restore: facilita stubs y protege a llamadores
      // que reutilizan contextos con implementaciones parciales de save().
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ── Selection highlight ── */

  function drawSelection(ctx, bounds, withHandles = false) {
    ctx.save();
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
    ctx.setLineDash([]);
    if (withHandles) {
      // Handles de resize en las esquinas del marco (mismas posiciones que
      // usa el hit-test de handles en app.js)
      const HS = 8;
      ctx.fillStyle = '#ffffff';
      [
        [bounds.x - 4, bounds.y - 4],
        [bounds.x + bounds.w + 4, bounds.y - 4],
        [bounds.x - 4, bounds.y + bounds.h + 4],
        [bounds.x + bounds.w + 4, bounds.y + bounds.h + 4],
      ].forEach(([cx, cy]) => {
        ctx.fillRect(cx - HS / 2, cy - HS / 2, HS, HS);
        ctx.strokeRect(cx - HS / 2, cy - HS / 2, HS, HS);
      });
    }
    ctx.restore();
  }

  return {
    renderElement,
    renderElements,
    renderScene,
    eraserSize,
    textFont,
    applyTextShadow,
    buildOverlapPlan,
    overlapRuns,
    isOverlapShape,
    pointInOverlapShape,
    drawGrid,
    drawSelection,
    setImageLoadCallback,
    pruneImageCache,
  };
})();
