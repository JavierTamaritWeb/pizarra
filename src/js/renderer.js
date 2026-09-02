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

  /** ¿Está el `src` decodificado y listo para dibujarse? Lo pregunta el
      borrado por trama de app.js: rasterizar una imagen a medio cargar
      congelaría su marco punteado en lugar de la foto. Consultar calienta la
      caché, así que la siguiente pasada ya la encuentra lista. */
  function imageReady(src) {
    if (typeof Image === 'undefined') return false;
    const img = _getImage(src);
    return !!(img.complete && img.naturalWidth);
  }

  function _image(ctx, el) {
    // Trama viva (canvas), no `src`: la usa la previsualización del borrador
    // por trama, que no puede pagar un toDataURL por fotograma ni esperar a
    // que decodifique. Nunca entra en `state.elements` — un elemento guarda
    // datos planos, jamás una referencia al DOM.
    if (el.bitmap) { ctx.drawImage(el.bitmap, el.x, el.y, el.w, el.h); return; }
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
  /**
   * Dibuja la punta de una flecha con la FORMA que pida el elemento
   * (v3.11.0). Un solo sitio para los cuatro extremos posibles —flecha y
   * curva, punta y cola—, que es lo que impide que una salga distinta.
   *
   * El triángulo y el punto se RELLENAN con el color del trazo: son macizos
   * por definición, y trazar su contorno con Sketchy los dejaría huecos.
   */
  function _paintHead(ctx, el, x, y, angle, len, bend = 0) {
    const g = Sketchy.headGeometry(x, y, angle, len, el.headShape, bend);
    if (g.polygon) {
      ctx.beginPath();
      ctx.moveTo(g.polygon[0].x, g.polygon[0].y);
      for (let i = 1; i < g.polygon.length; i++) ctx.lineTo(g.polygon[i].x, g.polygon[i].y);
      ctx.closePath();
      ctx.fillStyle = el.color;
      ctx.fill();
      return;
    }
    if (g.circle) {
      ctx.beginPath();
      ctx.arc(g.circle.x, g.circle.y, g.circle.r, 0, Math.PI * 2);
      ctx.fillStyle = el.color;
      ctx.fill();
      return;
    }
    g.lines.forEach(sg => Sketchy.line(ctx, sg.x1, sg.y1, sg.x2, sg.y2));
  }

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

  /**
   * Color de la TRAMA (v3.11.0). No es el mismo que el del relleno plano, y
   * la diferencia es lo que la hace visible: el relleno clásico sin color
   * propio cae al tinte 0x20 del trazo —12 % de opacidad—, que como superficie
   * se lee bien pero en unas rayas de un píxel es invisible. La trama usa el
   * color entero, y respeta la opacidad solo en modo translúcido.
   */
  function hatchStyle(el) {
    const base = el.fillColor || el.color;
    if (el.fillTransparent === true) {
      return withOpacity(base, el.fillOpacity !== undefined ? el.fillOpacity : DEFAULT_FILL_OPACITY);
    }
    return String(base).slice(0, 7);
  }

  /**
   * Pinta el relleno de una forma: plano (el de siempre) o tramado. `path`
   * construye el trazado del relleno plano; la trama no lo necesita, porque
   * `Hatch` calcula su propio contorno — el mismo que dibuja el renderer.
   *
   * Punto ÚNICO para los seis tipos de forma: así no puede quedarse ninguno
   * sin trama, que es como fallaría (en silencio, y distinto en cada tipo).
   */
  function _paintFill(ctx, el, path) {
    if (typeof Hatch !== 'undefined' && Hatch.isPattern(el.fillPattern)) {
      const g = Hatch.geometry(el);
      ctx.save();
      ctx.strokeStyle = hatchStyle(el);
      // Más fina que el contorno: la trama es sombreado, no dibujo (el mismo
      // criterio que el detalle de los edificios).
      ctx.lineWidth = Math.max(0.8, (el.lineWidth || 2) * 0.6);
      ctx.lineCap = 'round';
      if (g.lines.length) {
        ctx.beginPath();
        for (const l of g.lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
        ctx.stroke();
      }
      if (g.dots.length) {
        // Una sola ruta con N arcos y un único fill, como la nube del
        // aerógrafo: un fill por punto multiplica el coste por nada.
        ctx.fillStyle = hatchStyle(el);
        ctx.beginPath();
        for (const d of g.dots) {
          ctx.moveTo(d.x + d.r, d.y);
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = fillStyle(el);
    path();
  }

  /* ── Bordes ocultos de formas solapadas ── */

  const OVERLAP_SHAPE_TYPES = new Set([
    'rect', 'roundedRect', 'circle', 'square', 'trapezoid',
    'freeTriangle', 'triangle', 'pentagon', 'hexagon', 'star5', 'star6',
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
    if (Trapezoid.isType(el.type)) return Trapezoid.contains(point, el);
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
    if (Trapezoid.isType(el.type)) {
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

  // Variantes (v3.23.0): la rama default ('primary') es el dibujo histórico,
  // porque un elemento guardado sin `variant` tiene que pintar idéntico.
  function _button(ctx, x, y, w, h, color, lw, label, variant) {
    const v = variant || 'primary';
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    if (v === 'icon') {
      // Botón de icono: caja casi cuadrada con un «+», sin rótulo.
      ctx.fillStyle = _tint(color, '15');
      Sketchy.roundedRect(ctx, x, y, w, h, 8);
      ctx.fill();
      const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.22;
      Sketchy.line(ctx, cx - s, cy, cx + s, cy, 0.5);
      Sketchy.line(ctx, cx, cy - s, cx, cy + s, 0.5);
      return;
    }
    if (v === 'primary') {
      ctx.fillStyle = _tint(color, '15');
      Sketchy.roundedRect(ctx, x, y, w, h, 8);
      ctx.fill();
    } else if (v === 'secondary') {
      Sketchy.roundedRect(ctx, x, y, w, h, 8);   // solo contorno
    }
    // 'ghost': ni caja ni borde — el rótulo es todo el botón.
    ctx.font = `${Math.min(16, h * 0.5)}px ${sketchFont()}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Botón', x + w / 2, y + h / 2);
  }

  // Rojo fijo de la variante 'error' del input, como los verdes de Jardín:
  // el estado de validación no debe cambiar con el color del trazo.
  const INPUT_ERROR_RED = '#d64545';

  function _input(ctx, x, y, w, h, color, lw, label, variant) {
    const v = variant || 'text';
    ctx.strokeStyle = v === 'error' ? INPUT_ERROR_RED : _tint(color, '80');
    ctx.lineWidth = lw;
    Sketchy.roundedRect(ctx, x, y, w, h, 4);
    ctx.font = `${Math.min(13, h * 0.45)}px ${sketchFont()}`;
    ctx.fillStyle = _tint(color, '60');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (v === 'textarea') {
      // Área de texto: el placeholder arriba, líneas simuladas debajo y la
      // esquina de redimensionado.
      ctx.fillText(label || 'Escribe aquí...', x + 10, y + Math.min(16, h * 0.3));
      _fakeText(ctx, color, x + 10, y + h * 0.55, x + w * 0.8);
      _fakeText(ctx, color, x + 10, y + h * 0.75, x + w * 0.55);
      ctx.strokeStyle = _tint(color, '60');
      ctx.lineWidth = 1;
      Sketchy.line(ctx, x + w - 10, y + h - 4, x + w - 4, y + h - 10, 0.5);
      Sketchy.line(ctx, x + w - 7, y + h - 4, x + w - 4, y + h - 7, 0.5);
      return;
    }
    if (v === 'search') {
      // Lupa a la izquierda y el placeholder corrido tras ella.
      const r = Math.min(5, h * 0.18), lx = x + 12 + r, ly = y + h / 2 - 1;
      ctx.strokeStyle = _tint(color, '80');
      ctx.lineWidth = 1;
      Sketchy.ellipse(ctx, lx, ly, r, r);
      Sketchy.line(ctx, lx + r * 0.7, ly + r * 0.7, lx + r * 1.8, ly + r * 1.8, 0.5);
      ctx.fillText(label || 'Buscar...', x + 12 + r * 3.2 + 6, y + h / 2);
      return;
    }
    ctx.fillText(label || 'Escribe aquí...', x + 10, y + h / 2);
    if (v === 'error') {
      // La rayita del mensaje, en el mismo rojo del borde.
      ctx.strokeStyle = INPUT_ERROR_RED + '99';
      ctx.lineWidth = 1;
      Sketchy.line(ctx, x + 2, y + h + 9, x + w * 0.55, y + h + 9, 0.5);
    }
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

  function _nav(ctx, x, y, w, h, color, lw, label, variant) {
    const v = variant || 'links';
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
    if (v === 'search') {
      // Caja de búsqueda centrada, con su lupa, en vez de los enlaces.
      const bw = Math.min(w * 0.34, 220), bx = x + (w - bw) / 2;
      const bh = Math.min(24, h * 0.55), by = y + (h - bh) / 2;
      ctx.strokeStyle = _tint(color, '80');
      Sketchy.roundedRect(ctx, bx, by, bw, bh, bh / 2);
      const r = 4, lx = bx + 12, ly = y + h / 2 - 1;
      ctx.lineWidth = 1;
      Sketchy.ellipse(ctx, lx, ly, r, r);
      Sketchy.line(ctx, lx + r * 0.7, ly + r * 0.7, lx + r * 1.8, ly + r * 1.8, 0.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
    } else {
      // Links
      // En español desde la 2.10.0, como el resto de defaults («Botón», «Escribe
      // aquí...», «Título»); el exportador HTML lleva los mismos tres enlaces.
      const links = ['Inicio', 'Nosotros', 'Contacto'];
      // 70px por link (mismo paso que el bucle) + 40 de hueco para el remate
      const startX = x + w - 70 * links.length - 40;
      links.forEach((link, i) => {
        ctx.fillText(link, startX + i * 70, y + h / 2);
      });
    }
    if (v === 'avatar') {
      // Avatar en el sitio de la hamburguesa: círculo con cabeza y hombros.
      const r = Math.min(11, h * 0.32), cx = x + w - 16 - r, cy = y + h / 2;
      Sketchy.ellipse(ctx, cx, cy, r, r);
      Sketchy.ellipse(ctx, cx, cy - r * 0.3, r * 0.34, r * 0.34);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.9, r * 0.62, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      // Hamburger
      const hx = x + w - 30;
      const hy = y + h / 2 - 6;
      for (let i = 0; i < 3; i++) {
        Sketchy.line(ctx, hx, hy + i * 6, hx + 18, hy + i * 6, 0.5);
      }
    }
  }

  function _card(ctx, x, y, w, h, color, lw, label, variant) {
    const v = variant || 'image';
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = '#ffffff08';
    Sketchy.roundedRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.font = `bold 14px ${sketchFont()}`;
    if (v === 'horizontal') {
      // Imagen a la izquierda, texto a la derecha.
      const imgW = w * 0.38;
      ctx.fillStyle = _tint(color, '10');
      ctx.fillRect(x + 4, y + 4, imgW, h - 8);
      Sketchy.line(ctx, x + imgW + 8, y + 4, x + imgW + 8, y + h - 4);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label || 'Título', x + imgW + 16, y + 14);
      const tx = x + imgW + 16;
      _fakeText(ctx, color, tx, y + 42, x + w - 14);
      _fakeText(ctx, color, tx, y + 54, x + w * 0.85);
      return;
    }
    if (v === 'text') {
      // Solo texto: el título arriba y tres líneas de descripción.
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label || 'Título', x + 12, y + 14);
      _fakeText(ctx, color, x + 12, y + 44, x + w - 20);
      _fakeText(ctx, color, x + 12, y + 56, x + w - 20);
      _fakeText(ctx, color, x + 12, y + 68, x + w * 0.7);
      return;
    }
    // Image area ('image', el dibujo histórico)
    const imgH = h * 0.45;
    ctx.fillStyle = _tint(color, '10');
    ctx.fillRect(x + 4, y + 4, w - 8, imgH);
    Sketchy.line(ctx, x + 4, y + imgH + 4, x + w - 4, y + imgH + 4);
    // Title
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

  /* ── Piezas de formulario y datos (v3.22.0) ──
     Mismo contrato que _button/_card: (ctx, x, y, w, h, color, lw, label) y,
     en las tres con catálogo, `variant` al final — su ausencia es la primera
     entrada del catálogo, que es lo que valida el import. El texto simulado
     son trazos de Sketchy, como las líneas de descripción de la tarjeta. */

  // Trazo que simula una línea de texto, con el alfa de la tarjeta.
  function _fakeText(ctx, color, x1, y, x2) {
    ctx.strokeStyle = _tint(color, '40');
    ctx.lineWidth = 1;
    Sketchy.line(ctx, x1, y, x2, y, 0.5);
  }

  function _formControl(ctx, x, y, w, h, color, lw, label, variant) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const v = variant || 'checkbox';
    const s = Math.min(h * 0.85, w * 0.4);
    const ty = y + h / 2;
    const font = `${Math.min(14, h * 0.6)}px ${sketchFont()}`;
    if (v === 'select') {
      ctx.strokeStyle = _tint(color, '80');
      Sketchy.roundedRect(ctx, x, y, w, h, 4);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label || 'Opción', x + 10, ty);
      const cx = x + w - h * 0.65;             // chevrón del desplegable
      ctx.strokeStyle = color;
      Sketchy.line(ctx, cx - 5, ty - 3, cx, ty + 3, 0.5);
      Sketchy.line(ctx, cx, ty + 3, cx + 5, ty - 3, 0.5);
      return;
    }
    if (v === 'slider') {
      const kx = x + w * 0.6, r = Math.min(h * 0.45, 9);
      ctx.strokeStyle = _tint(color, '60');
      Sketchy.line(ctx, x, ty, x + w, ty);
      ctx.strokeStyle = color;
      Sketchy.line(ctx, x, ty, kx, ty);        // tramo recorrido, más marcado
      ctx.fillStyle = _tint(color, '15');
      Sketchy.ellipse(ctx, kx, ty, r, r);
      ctx.fill();
      return;
    }
    // Casilla, radio e interruptor: el mando a la izquierda, el rótulo al lado.
    if (v === 'radio') {
      Sketchy.ellipse(ctx, x + s / 2, ty, s / 2, s / 2);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + s / 2, ty, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (v === 'switch') {
      const pw = s * 1.8;
      ctx.fillStyle = _tint(color, '15');
      Sketchy.roundedRect(ctx, x, ty - s / 2, pw, s, s / 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + pw - s / 2, ty, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else {                                   // 'checkbox'
      Sketchy.roundedRect(ctx, x, ty - s / 2, s, s, 3);
      Sketchy.line(ctx, x + s * 0.22, ty, x + s * 0.45, ty + s * 0.22, 0.5);
      Sketchy.line(ctx, x + s * 0.45, ty + s * 0.22, x + s * 0.8, ty - s * 0.28, 0.5);
    }
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Opción', x + (v === 'switch' ? s * 1.8 : s) + 10, ty);
  }

  function _uiTable(ctx, x, y, w, h, color, lw, label, variant) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const v = variant || 'grid';
    Sketchy.rect(ctx, x, y, w, h);
    // 'pager' reserva la banda inferior para la paginación; el resto de la
    // caja se reparte en filas como siempre.
    const ph = v === 'pager' ? Math.min(30, h * 0.2) : 0;
    const rows = Math.max(3, Math.min(6, Math.round((h - ph) / 36)));
    const rh = (h - ph) / rows;
    if (v === 'grid') {
      ctx.fillStyle = _tint(color, '10');      // banda de cabecera
      ctx.fillRect(x + 1, y + 1, w - 2, rh - 2);
    }
    for (let r = 1; r < rows; r++) {
      ctx.strokeStyle = _tint(color, '60');
      ctx.lineWidth = 1;
      Sketchy.line(ctx, x, y + rh * r, x + w, y + rh * r, 0.5);
    }
    if (v === 'grid') {
      for (const t of [0.4, 0.72]) {           // separadores de columna
        ctx.strokeStyle = _tint(color, '60');
        Sketchy.line(ctx, x + w * t, y, x + w * t, y + h, 0.5);
      }
      for (let r = 0; r < rows; r++) {
        const cy = y + rh * (r + 0.5);
        _fakeText(ctx, color, x + 8, cy, x + w * 0.4 - 10);
        _fakeText(ctx, color, x + w * 0.4 + 8, cy, x + w * 0.72 - 10);
        _fakeText(ctx, color, x + w * 0.72 + 8, cy, x + w - 10);
      }
    } else {
      for (let r = 0; r < rows; r++) {
        const cy = y + rh * (r + 0.5);
        if (v === 'avatars') {
          const ar = Math.min(rh * 0.32, 11);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          Sketchy.ellipse(ctx, x + 10 + ar, cy, ar, ar);
          _fakeText(ctx, color, x + 10 + ar * 2 + 8, cy - 4, x + w * 0.7);
          _fakeText(ctx, color, x + 10 + ar * 2 + 8, cy + 6, x + w * 0.5);
        } else if (v === 'checks') {
          // Casilla por fila, con su línea de texto al lado.
          const cs = Math.min(rh * 0.4, 12);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          Sketchy.roundedRect(ctx, x + 10, cy - cs / 2, cs, cs, 2);
          if (r === 1) {                        // una marcada, para que se lea
            Sketchy.line(ctx, x + 10 + cs * 0.22, cy, x + 10 + cs * 0.45, cy + cs * 0.22, 0.5);
            Sketchy.line(ctx, x + 10 + cs * 0.45, cy + cs * 0.22, x + 10 + cs * 0.8, cy - cs * 0.28, 0.5);
          }
          _fakeText(ctx, color, x + 10 + cs + 10, cy, x + w * (r % 2 ? 0.6 : 0.8));
        } else {
          _fakeText(ctx, color, x + 10, cy, x + w * (r % 2 ? 0.6 : 0.8));
        }
      }
    }
    if (v === 'pager') {
      // La banda: separador y «‹ 1 2 3 ›» con la página actual rellena.
      ctx.strokeStyle = _tint(color, '60');
      ctx.lineWidth = 1;
      Sketchy.line(ctx, x, y + h - ph, x + w, y + h - ph, 0.5);
      const bs = Math.min(ph * 0.6, 16), by = y + h - ph / 2 - bs / 2;
      const cx0 = x + w / 2 - bs * 2.2;
      for (let i = 0; i < 3; i++) {
        const bx = cx0 + i * bs * 1.5;
        ctx.strokeStyle = color;
        if (i === 0) {
          ctx.fillStyle = _tint(color, '15');
          Sketchy.roundedRect(ctx, bx, by, bs, bs, 3);
          ctx.fill();
        } else {
          Sketchy.roundedRect(ctx, bx, by, bs, bs, 3);
        }
      }
      const my = y + h - ph / 2;                // chevrones ‹ ›
      Sketchy.line(ctx, cx0 - bs, my - 3, cx0 - bs - 4, my, 0.5);
      Sketchy.line(ctx, cx0 - bs - 4, my, cx0 - bs, my + 3, 0.5);
      const rx = cx0 + 3 * bs * 1.5 + bs * 0.4;
      Sketchy.line(ctx, rx, my - 3, rx + 4, my, 0.5);
      Sketchy.line(ctx, rx + 4, my, rx, my + 3, 0.5);
    }
  }

  function _chart(ctx, x, y, w, h, color, lw, label, variant) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const v = variant || 'bars';
    if (v === 'pie') {
      const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 - 2;
      Sketchy.ellipse(ctx, cx, cy, r, r);
      ctx.fillStyle = _tint(color, '15');      // un sector destacado
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 0.1);
      ctx.closePath();
      ctx.fill();
      Sketchy.line(ctx, cx, cy, cx, cy - r, 0.5);
      Sketchy.line(ctx, cx, cy, cx + r * Math.cos(Math.PI * 0.1), cy + r * Math.sin(Math.PI * 0.1), 0.5);
      Sketchy.line(ctx, cx, cy, cx - r * 0.85, cy + r * 0.5, 0.5);
      return;
    }
    if (v === 'donut') {
      // Anillo: la tarta con agujero — dos aros y el tramo destacado grueso.
      const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 - 2;
      const ri = r * 0.55;
      Sketchy.ellipse(ctx, cx, cy, r, r);
      Sketchy.ellipse(ctx, cx, cy, ri, ri);
      ctx.beginPath();
      ctx.lineWidth = Math.max(2, r - ri - 2);
      ctx.strokeStyle = _tint(color, '60');
      ctx.arc(cx, cy, (r + ri) / 2, -Math.PI / 2, Math.PI * 0.1);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      return;
    }
    if (v === 'gauge') {
      const cx = x + w / 2, cy = y + h * 0.92, r = Math.min(w / 2, h * 0.85) - 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);          // el dial
      ctx.stroke();
      ctx.beginPath();                          // el arco recorrido, marcado
      ctx.lineWidth = lw + 2;
      ctx.strokeStyle = _tint(color, '60');
      ctx.arc(cx, cy, r, Math.PI, Math.PI * 1.62);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      Sketchy.line(ctx, cx, cy, cx + r * 0.72 * Math.cos(Math.PI * 1.62),
        cy + r * 0.72 * Math.sin(Math.PI * 1.62), 0.5);   // aguja
      Sketchy.line(ctx, cx - r, cy, cx + r, cy, 0.5);
      return;
    }
    // Barras, líneas y área comparten los ejes.
    Sketchy.line(ctx, x, y, x, y + h);
    Sketchy.line(ctx, x, y + h, x + w, y + h);
    const vals = [0.45, 0.75, 0.35, 0.9, 0.6];
    if (v === 'area') {
      // Área: la poligonal de líneas con el suelo relleno.
      ctx.fillStyle = _tint(color, '15');
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, y + h);
      vals.forEach((val, i) => {
        ctx.lineTo(x + w * (0.08 + i * 0.21), y + h * (1 - val));
      });
      ctx.lineTo(x + w * (0.08 + (vals.length - 1) * 0.21), y + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      for (let i = 1; i < vals.length; i++) {
        Sketchy.line(ctx, x + w * (0.08 + (i - 1) * 0.21), y + h * (1 - vals[i - 1]),
          x + w * (0.08 + i * 0.21), y + h * (1 - vals[i]), 0.5);
      }
      return;
    }
    if (v === 'lines') {
      ctx.strokeStyle = color;
      for (let i = 1; i < vals.length; i++) {
        Sketchy.line(ctx, x + w * (0.08 + (i - 1) * 0.21), y + h * (1 - vals[i - 1]),
          x + w * (0.08 + i * 0.21), y + h * (1 - vals[i]), 0.5);
      }
      ctx.fillStyle = color;
      vals.forEach((val, i) => {
        ctx.beginPath();
        ctx.arc(x + w * (0.08 + i * 0.21), y + h * (1 - val), 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {                                   // 'bars'
      ctx.fillStyle = _tint(color, '15');
      const bw = w * 0.14;
      vals.slice(0, 4).forEach((val, i) => {
        const bx = x + w * (0.1 + i * 0.22), bh = h * val;
        Sketchy.rect(ctx, bx, y + h - bh, bw, bh);
        ctx.fillRect(bx + 1, y + h - bh + 1, bw - 2, bh - 2);
      });
    }
  }

  function _dialog(ctx, x, y, w, h, color, lw, label, variant) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = '#ffffff08';
    Sketchy.roundedRect(ctx, x, y, w, h, 8);
    ctx.fill();
    const barH = Math.min(34, h * 0.2);
    Sketchy.line(ctx, x, y + barH, x + w, y + barH);      // barra de título
    ctx.font = `bold ${Math.min(14, barH * 0.5)}px ${sketchFont()}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Diálogo', x + 12, y + barH / 2);
    const cx = x + w - barH / 2, cy = y + barH / 2, cs = barH * 0.18; // aspa
    Sketchy.line(ctx, cx - cs, cy - cs, cx + cs, cy + cs, 0.5);
    Sketchy.line(ctx, cx + cs, cy - cs, cx - cs, cy + cs, 0.5);
    _fakeText(ctx, color, x + 12, y + barH + 20, x + w - 20);
    _fakeText(ctx, color, x + 12, y + barH + 34, x + w * 0.72);
    // Fila de botones, alineada abajo a la derecha. La variante 'alert'
    // (v3.23.0) lleva UN solo botón, centrado: no hay nada que cancelar.
    const bw = Math.min(86, w * 0.3), bh = Math.min(30, h * 0.16);
    const by = y + h - bh - 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = _tint(color, '15');
    if ((variant || 'confirm') === 'alert') {
      Sketchy.roundedRect(ctx, x + (w - bw) / 2, by, bw, bh, 6);
      ctx.fill();
      return;
    }
    Sketchy.roundedRect(ctx, x + w - bw * 2 - 22, by, bw, bh, 6);
    Sketchy.roundedRect(ctx, x + w - bw - 12, by, bw, bh, 6);   // el primario
    ctx.fill();
  }

  function _tabs(ctx, x, y, w, h, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const tw = Math.min(w / 3.4, 110);
    // La activa: pestaña con relleno y sin borde inferior…
    ctx.fillStyle = _tint(color, '15');
    Sketchy.roundedRect(ctx, x, y, tw, h, 6);
    ctx.fill();
    // …y la línea base pasa por debajo de las demás.
    Sketchy.line(ctx, x + tw, y + h, x + w, y + h);
    for (let i = 1; i < 3; i++) {
      const tx = x + (tw + 8) * i;
      ctx.strokeStyle = _tint(color, '60');
      Sketchy.line(ctx, tx, y + h, tx, y + h * 0.25, 0.5);
      Sketchy.line(ctx, tx, y + h * 0.25, tx + tw, y + h * 0.25, 0.5);
      Sketchy.line(ctx, tx + tw, y + h * 0.25, tx + tw, y + h, 0.5);
      _fakeText(ctx, color, tx + 12, y + h * 0.62, tx + tw - 12);
    }
    _fakeText(ctx, color, x + 12, y + h * 0.55, x + tw - 12);
  }

  function _sidebar(ctx, x, y, w, h, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.fillStyle = _tint(color, '0a');
    Sketchy.rect(ctx, x, y, w, h);
    ctx.fill();
    Sketchy.roundedRect(ctx, x + 12, y + 12, Math.min(w * 0.5, 70), 20, 4); // logo
    Sketchy.line(ctx, x, y + 44, x + w, y + 44);
    const items = 5, ih = Math.min(36, (h - 56) / items);
    for (let i = 0; i < items; i++) {
      const iy = y + 52 + ih * i;
      if (i === 1) {                            // el ítem activo
        ctx.fillStyle = _tint(color, '15');
        ctx.fillRect(x + 6, iy, w - 12, ih - 6);
      }
      _fakeText(ctx, color, x + 16, iy + ih / 2 - 3, x + w * (i % 2 ? 0.62 : 0.78));
    }
  }

  /** «Piezas» (v3.23.0): las menores de UI en un solo tipo. Cada variante es
      un dibujo independiente; la caja por defecto de cada una vive en
      UI_PIECE_DEFAULTS (config.js). Sin rótulo: todo el texto es simulado. */
  function _uiPiece(ctx, x, y, w, h, color, lw, variant) {
    const v = variant || 'avatar';
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    if (v === 'progress') {
      const r = Math.min(h / 2, 8);
      Sketchy.roundedRect(ctx, x, y, w, h, r);
      ctx.fillStyle = _tint(color, '40');      // el 60% recorrido
      ctx.fillRect(x + 2, y + 2, (w - 4) * 0.6, h - 4);
      return;
    }
    if (v === 'breadcrumbs') {
      // Tres migas separadas por barras. Con el grosor del elemento, no el de
      // _fakeText: a escala de icono el trazo de 1px desaparecía.
      const cy = y + h / 2;
      const seg = w / 3.4;
      ctx.strokeStyle = _tint(color, '60');
      Sketchy.line(ctx, x, cy, x + seg * 0.8, cy, 0.5);
      Sketchy.line(ctx, x + seg * 1.15, cy, x + seg * 1.95, cy, 0.5);
      ctx.strokeStyle = color;                 // la actual, más marcada
      Sketchy.line(ctx, x + seg * 2.3, cy, x + seg * 2.85, cy, 0.5);
      ctx.strokeStyle = _tint(color, '60');
      for (const t of [0.95, 2.1]) {           // las barras «/»
        Sketchy.line(ctx, x + seg * t + 4, cy - 6, x + seg * t - 2, cy + 6, 0.5);
      }
      return;
    }
    if (v === 'tooltip') {
      // Globo: caja redondeada con pico abajo y dos líneas de texto.
      const tipH = Math.min(10, h * 0.2), bh = h - tipH;
      Sketchy.roundedRect(ctx, x, y, w, bh, 6);
      const cx = x + w / 2;
      Sketchy.line(ctx, cx - 6, y + bh, cx, y + h, 0.5);
      Sketchy.line(ctx, cx, y + h, cx + 6, y + bh, 0.5);
      _fakeText(ctx, color, x + 10, y + bh * 0.4, x + w - 12);
      _fakeText(ctx, color, x + 10, y + bh * 0.68, x + w * 0.7);
      return;
    }
    if (v === 'badge') {
      // Insignia: píldora rellena con su rayita dentro.
      ctx.fillStyle = _tint(color, '15');
      Sketchy.roundedRect(ctx, x, y, w, h, h / 2);
      ctx.fill();
      _fakeText(ctx, color, x + w * 0.25, y + h / 2, x + w * 0.75);
      return;
    }
    if (v === 'pagination') {
      // «‹ 1 2 3 ›» con la página actual rellena, como la banda de la tabla.
      const bs = Math.min(h * 0.8, 22), by = y + (h - bs) / 2, cy = y + h / 2;
      const cx0 = x + w / 2 - bs * 2.2;
      for (let i = 0; i < 3; i++) {
        const bx = cx0 + i * bs * 1.5;
        ctx.strokeStyle = color;
        if (i === 0) {
          ctx.fillStyle = _tint(color, '15');
          Sketchy.roundedRect(ctx, bx, by, bs, bs, 3);
          ctx.fill();
        } else {
          Sketchy.roundedRect(ctx, bx, by, bs, bs, 3);
        }
      }
      Sketchy.line(ctx, cx0 - bs, cy - 4, cx0 - bs - 5, cy, 0.5);
      Sketchy.line(ctx, cx0 - bs - 5, cy, cx0 - bs, cy + 4, 0.5);
      const rx = cx0 + 3 * bs * 1.5 + bs * 0.4;
      Sketchy.line(ctx, rx, cy - 4, rx + 5, cy, 0.5);
      Sketchy.line(ctx, rx + 5, cy, rx, cy + 4, 0.5);
      return;
    }
    // 'avatar': círculo con cabeza y hombros.
    const r = Math.min(w, h) / 2 - 1, cx = x + w / 2, cy = y + h / 2;
    Sketchy.ellipse(ctx, cx, cy, r, r);
    Sketchy.ellipse(ctx, cx, cy - r * 0.32, r * 0.34, r * 0.34);
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.95, r * 0.65, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
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
      _paintFill(ctx, el, () => { _polygonPath(ctx, vertices); ctx.fill(); });
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
      _paintFill(ctx, el, () => { _polygonPath(ctx, vertices); ctx.fill(); });
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
      _paintFill(ctx, el, () => { _polygonPath(ctx, vertices); ctx.fill(); });
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
    // Nivel de temblor por elemento (v3.11.0). La ausencia del campo es el
    // temblor de siempre, así que un proyecto anterior se dibuja igual.
    Sketchy.setRoughness(el.rough);
    ctx.strokeStyle = el.color;
    ctx.lineWidth   = el.lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    switch (el.type) {

      case 'pencil': {
        if (el.points.length < 2) break;
        // Presión simulada (v2.37.0): el contorno de Freehand se RELLENA con
        // el color del trazo en vez de trazar la polilínea. No pasa por
        // Sketchy: el temblor ya viene en los propios puntos del gesto.
        if (el.taper) {
          const poly = Freehand.outline(el.points, el.lineWidth);
          if (poly.length < 3) break;
          ctx.fillStyle = el.color;
          ctx.beginPath();
          ctx.moveTo(poly[0].x, poly[0].y);
          for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
          ctx.closePath();
          ctx.fill();
          break;
        }
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
        _paintHead(ctx, el, el.x2, el.y2, angle, headLen);
        // Doble punta opcional (heads === 'both'): punta también en el inicio
        if (el.heads === 'both') {
          const backAngle = Math.atan2(el.y1 - el.y2, el.x1 - el.x2);
          _paintHead(ctx, el, el.x1, el.y1, backAngle, headLen);
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
          // Punta orientada según la tangente del último tramo; el lado de la
          // comba (punta Media) sale de CurvePath, la misma cuenta que el SVG.
          const tangent = CurvePath.endTangent(el);
          _paintHead(ctx, el, curveEnd.x, curveEnd.y,
            Math.atan2(tangent.dy, tangent.dx), headLen, CurvePath.endBend(el));
        }
        // Doble punta opcional: tangente del primer tramo hacia el inicio
        if (el.heads === 'both') {
          const tangent = CurvePath.startTangent(el);
          _paintHead(ctx, el, curveStart.x, curveStart.y,
            Math.atan2(tangent.dy, tangent.dx), headLen, CurvePath.startBend(el));
        }
        _arrowLabel(ctx, el);
        break;
      }

      case 'rect':
        if (el.fill && options.shapeFill !== false) {
          _paintFill(ctx, el, () => ctx.fillRect(el.x, el.y, el.w, el.h));
        }
        if (options.shapeStroke !== false) Sketchy.rect(ctx, el.x, el.y, el.w, el.h);
        break;

      case 'roundedRect':
        if (el.fill && options.shapeFill !== false) {
          _paintFill(ctx, el, () => {
            ctx.beginPath();
            ctx.roundRect(el.x, el.y, el.w, el.h, 12);
            ctx.fill();
          });
        }
        if (options.shapeStroke !== false) Sketchy.roundedRect(ctx, el.x, el.y, el.w, el.h, 12);
        break;

      case 'circle': {
        const rx = Math.abs(el.w) / 2;
        const ry = Math.abs(el.h) / 2;
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        if (el.fill && options.shapeFill !== false) {
          _paintFill(ctx, el, () => {
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        if (options.shapeStroke !== false) Sketchy.ellipse(ctx, cx, cy, rx, ry);
        break;
      }

      // Marco (v3.12.0): el contenedor de un wireframe. Se dibuja con líneas
      // RECTAS y finas, sin pasar por Sketchy: es una guía de trabajo, no un
      // trazo del dibujo, y temblando competiría con lo que contiene.
      case 'frame': {
        const b = _box(el);
        ctx.save();
        ctx.strokeStyle = _tint(el.color, '99');
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
        // El rótulo va ENCIMA del borde superior, fuera de la caja: dentro
        // taparía justo la esquina donde se suele empezar a componer.
        const texto = el.label || 'Marco';
        ctx.font = `12px ${sketchFont()}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = _tint(el.color, '99');
        ctx.fillText(texto, b.x, b.y - 5);
        ctx.restore();
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
      case 'freeTriangle':
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

      case 'button':           _button(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'input':            _input(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'imagePlaceholder': _imagePlaceholder(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth); break;
      case 'image':            _image(ctx, el); break;
      case 'nav':              _nav(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'card':             _card(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'formControl':      _formControl(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'uiTable':          _uiTable(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'chart':            _chart(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'dialog':           _dialog(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.label, el.variant); break;
      case 'tabs':             _tabs(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth); break;
      case 'sidebar':          _sidebar(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth); break;
      case 'uiPiece':          _uiPiece(ctx, el.x, el.y, el.w, el.h, el.color, el.lineWidth, el.variant); break;
    }

    Sketchy.setSeed(null);
    Sketchy.setRoughness(1);
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
    // `null` explícito = sin papel: lo pide la exportación con fondo
    // transparente. Cualquier otro valor falsy sigue cayendo al blanco de
    // siempre, así que ningún llamador anterior cambia de aspecto.
    const background = options.background === null ? null : (options.background || '#ffffff');
    ctx.clearRect(0, 0, width, height);
    try {
      renderElements(ctx, elements, options.overlapMode);
    } finally {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      if (options.showGrid) {
        drawGrid(ctx, width, height, options.gridColor);
      }
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
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
    imageReady,
    hatchStyle,
  };
})();
