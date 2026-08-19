/* ============================================================
   exporter.js — Multi-format export & JSON import
   ============================================================ */

const Exporter = (() => {

  /** Helper: trigger a file download */
  function _download(filename, url) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    // Revocar en el siguiente tick, no en línea: click() solo ENCOLA la
    // descarga, y revocar el blob antes de que arranque es el patrón
    // históricamente frágil (fallaba en navegadores antiguos y aún depende
    // de que el click sea síncrono).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function _downloadBlob(filename, blob) {
    _download(filename, URL.createObjectURL(blob));
  }

  /**
   * Render elements to a temp canvas (no grid) and return its data URL.
   */
  function _renderClean(elements, format, quality, options = {}) {
    const c = document.createElement('canvas');
    c.width = CANVAS_W;
    c.height = CANVAS_H;
    const ctx = c.getContext('2d');
    Renderer.renderScene(ctx, elements, {
      background: '#ffffff',
      overlapMode: options.overlapMode,
    });
    return c.toDataURL(format, quality);
  }

  /* ── Public exports ── */

  function png(elements, options = {}) {
    const url = _renderClean(elements, 'image/png', undefined, options);
    const a = document.createElement('a');
    a.download = 'wireframe.png';
    a.href = url;
    a.click();
  }

  function jpg(elements, options = {}) {
    const url = _renderClean(elements, 'image/jpeg', 0.95, options);
    const a = document.createElement('a');
    a.download = 'wireframe.jpg';
    a.href = url;
    a.click();
  }

  function svg(elements, options = {}) {
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">\n`;
    out += `<rect width="100%" height="100%" fill="white"/>\n`;
    const fontUrl = FONT_URL();
    if (fontUrl) out += `<style>@import url('${fontUrl.replace(/&/g, '&amp;')}');</style>\n`;

    out += _svgScene(elements, options.overlapMode);

    out += '</svg>';
    _downloadBlob('wireframe.svg', new Blob([out], { type: 'image/svg+xml' }));
  }

  // La familia manuscrita EN USO (sketchFont(), config.js) pero sin comillas:
  // va en atributos XML font-family="..." del SVG exportado, donde una comilla
  // (simple del fallback o doble de --font-sketch) malformaría el atributo;
  // <, > y & malformarían el propio XML.
  // Son funciones y no constantes desde la v2.13.0: la letra del lienzo se
  // puede cambiar en caliente, y calculadas al cargar el módulo el archivo
  // exportado habría salido siempre con la de arranque.
  const FONT_FALLBACK = () => sketchFont().replace(/["'<>&]/g, '');
  // Y para el <style> del HTML exportado: sin '<' no se puede cerrar la
  // etiqueta, y sin llaves ni ';' no se inyectan reglas/declaraciones ajenas.
  const FONT_CSS = () => sketchFont().replace(/[<>{};]/g, '');
  /* Los exportados SIGUEN pidiendo la fuente a Google Fonts, y es deliberado:
     la app ya no lo hace —las tipografías viajan en fonts/—, pero un .svg o un
     .html exportado es un archivo suelto que se manda por correo o se sube a
     un sitio, sin la carpeta fonts/ al lado, así que una ruta relativa se
     rompería en cuanto saliera de aquí. La URL se arma con la familia activa y
     sin conexión el archivo cae a su pila de resguardos.

     Devuelve null para las familias que NO están en Google Fonts —OpenDyslexic
     es la de la propia app—: pedirla por esa URL daría un 404 mudo, y el
     exportado se queda mejor con sus resguardos que con un enlace roto. Los
     dos exportadores omiten el <link>/@import cuando es null. */
  const FONT_URL = () => {
    const family = sketchFont().split(',')[0].replace(/['"]/g, '').trim();
    const entry = SKETCH_FONTS.find(f => f.name === family);
    if (entry && !entry.google) return null;
    return 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(family).replace(/%20/g, '+') + '&display=swap';
  };
  const DEFAULT_FILL_OPACITY = 0.4;

  /** Tipos sin representación HTML propia: van en un <svg> incrustado.
      (Sin 'eraser': html() desvía a _svgScene toda escena que los tenga.) */
  const VECTOR_TYPES = [
    'pencil', 'airbrush', 'line', 'arrow', 'curveArrow', 'circle',
    'square', 'trapezoid', 'triangle', 'pentagon', 'hexagon',
    'star5', 'star6', 'polygon',
  ];

  function _alphaHex(opacity) {
    return Math.round(Math.min(1, Math.max(0, opacity)) * 255)
      .toString(16).padStart(2, '0');
  }

  /** Mismo criterio de relleno que Renderer.fillStyle. */
  function _fillColor(el) {
    const stroke = String(el.color);
    const own = el.fillColor ? String(el.fillColor) : null;
    if (el.fillTransparent) {
      const opacity = el.fillOpacity !== undefined ? el.fillOpacity : DEFAULT_FILL_OPACITY;
      return (own || stroke).slice(0, 7) + _alphaHex(opacity);
    }
    return own || stroke.slice(0, 7) + '20';
  }

  /**
   * Etiqueta de flecha en SVG: <text> centrado en el punto medio del trazo
   * con halo blanco (paint-order:stroke), misma técnica que el canvas.
   */
  function _svgArrowLabel(el, color) {
    if (!el.label) return '';
    const t = el.labelT !== undefined ? el.labelT : 0.5;
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      const p = CurvePath.pointAt(el, t);
      return `<text x="${p.x}" y="${p.y}" fill="${color}" stroke="#ffffff" stroke-width="4" paint-order="stroke" font-family="${FONT_FALLBACK()}" font-size="13" text-anchor="middle" dominant-baseline="middle">${_escapeXml(el.label)}</text>\n`;
    }
    const mt = 1 - t;
    let mx, my;
    if (el.type === 'curveArrow') {
      if (el.cx2 !== undefined) {
        mx = mt * mt * mt * el.x1 + 3 * mt * mt * t * el.cx + 3 * mt * t * t * el.cx2 + t * t * t * el.x2;
        my = mt * mt * mt * el.y1 + 3 * mt * mt * t * el.cy + 3 * mt * t * t * el.cy2 + t * t * t * el.y2;
      } else {
        mx = mt * mt * el.x1 + 2 * mt * t * el.cx + t * t * el.x2;
        my = mt * mt * el.y1 + 2 * mt * t * el.cy + t * t * el.y2;
      }
    } else {
      mx = mt * el.x1 + t * el.x2;
      my = mt * el.y1 + t * el.y2;
    }
    return `<text x="${mx}" y="${my}" fill="${color}" stroke="#ffffff" stroke-width="4" paint-order="stroke" font-family="${FONT_FALLBACK()}" font-size="13" text-anchor="middle" dominant-baseline="middle">${_escapeXml(el.label)}</text>\n`;
  }

  /**
   * Sombra de un texto en SVG: `feDropShadow` hace las tres variantes con solo
   * cambiar desplazamiento y desenfoque, igual que el canvas hace con
   * shadowOffset/shadowBlur, así que las dos salidas no pueden divergir.
   * Devuelve el <filter> y el atributo que lo aplica ('' si no hay sombra).
   */
  function _svgTextShadow(el) {
    const s = textShadowById(el.shadow);
    if (s.id === 'none') return { def: '', attr: '' };
    const k = (el.fontSize || SHADOW_REF_SIZE) / SHADOW_REF_SIZE;
    const dx = _round(s.dx * k), dy = _round(s.dy * k);
    // stdDeviation es la desviación típica del desenfoque, la mitad del radio
    // que usa el canvas: con el mismo número la sombra del SVG saldría del
    // doble de difusa que en pantalla.
    const sd = _round((s.blur * k) / 2);
    const color = _escapeXml(String(el.shadowColor || DEFAULT_SHADOW_COLOR));
    const id = `sh-${s.id}-${String(dx).replace('.', '_')}-${String(dy).replace('.', '_')}-${String(sd).replace('.', '_')}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
    const def = `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
      `<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${sd}" flood-color="${color}"/></filter>\n`;
    return { def, attr: ` filter="url(#${id})"` };
  }

  /** Sombra de un texto como declaración CSS `text-shadow` (o '' si no lleva).
      Mismas medidas escaladas que el canvas y el SVG. */
  function _htmlTextShadow(el) {
    const s = textShadowById(el.shadow);
    if (s.id === 'none') return '';
    const k = (el.fontSize || SHADOW_REF_SIZE) / SHADOW_REF_SIZE;
    // Sin ';' ni '<' el valor no puede cerrar la declaración ni la etiqueta.
    const color = String(el.shadowColor || DEFAULT_SHADOW_COLOR).replace(/[<>{};"']/g, '');
    return `text-shadow:${_round(s.dx * k)}px ${_round(s.dy * k)}px ${_round(s.blur * k)}px ${color};`;
  }

  /** Redondeo a 2 decimales, para no llenar el SVG de ruido flotante. */
  function _round(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Las 2 <line> de una punta de flecha (solo valores numéricos calculados;
   * `s` ya viene con color/grosor escapados). Geometría de Sketchy.arrowHead.
   */
  function _svgArrowHead(x, y, angle, len, s) {
    return Sketchy.arrowHead(x, y, angle, len)
      .map(sg => `<line x1="${sg.x1}" y1="${sg.y1}" x2="${sg.x2}" y2="${sg.y2}" ${s}/>\n`)
      .join('');
  }

  /**
   * Markup SVG de un elemento. Compartido por el export SVG y el
   * <svg> incrustado del export HTML (tipos vectoriales).
   */
  function _svgElement(el) {
    const color = _escapeXml(String(el.color));
    // Tinte por sufijo alfa: el color base puede ser #rrggbbaa (la validación
    // de import lo acepta) y concatenar sobre él da 10 dígitos — inválido en
    // SVG, donde fill por defecto es negro y stroke desaparece.
    const tint = a => _escapeXml(String(el.color).slice(0, 7)) + a;
    const lw = _escapeXml(String(el.lineWidth));
    const fillCol = _escapeXml(_fillColor(el));
    const s = `stroke="${color}" stroke-width="${lw}" fill="none" stroke-linecap="round"`;
    const sf = `stroke="${color}" stroke-width="${lw}" stroke-linecap="round" fill="${el.fill ? fillCol : 'none'}"`;
    // Cuerpo con trazo discontinuo opcional (las puntas siempre usan `s`, sólidas)
    const sBody = el.dash ? `${s} stroke-dasharray="${4 * el.lineWidth} ${4 * el.lineWidth}"` : s;
    let out = '';

    switch (el.type) {
        case 'pencil':
          if (el.points.length > 1) {
            // Presión simulada: el mismo polígono que rellena el renderer,
            // como <path> cerrado con fill — un stroke aquí divergiría del
            // lienzo justo en el rasgo que define al modo.
            if (el.taper) {
              const poly = Freehand.outline(el.points, el.lineWidth);
              if (poly.length > 2) {
                const dt = poly.map((p, i) =>
                  `${i === 0 ? 'M' : 'L'}${_round(p.x)} ${_round(p.y)}`).join(' ');
                out += `<path d="${dt} Z" fill="${color}" stroke="none"/>\n`;
              }
              break;
            }
            const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
            out += `<path d="${d}" ${s}/>\n`;
          }
          break;

        // La nube del aerógrafo: un <circle> por gota, agrupados bajo un
        // único <g> que lleva el color. Agrupar parte por la mitad el peso
        // del .svg (hasta 3000 gotas por mancha).
        case 'airbrush': {
          const nube = Airbrush.dots(el);
          if (nube.length) {
            // fill-opacity y JAMÁS opacity: `opacity` en el grupo lo aplana
            // ANTES de componer, así que las gotas dejarían de sumarse entre
            // sí y el SVG saldría distinto del lienzo justo en lo que define
            // al modo translúcido. `fill-opacity` se hereda y se aplica por
            // figura, que es lo que hace el globalAlpha del canvas.
            const alpha = el.opacity !== undefined
              ? ` fill-opacity="${_round(el.opacity)}"` : '';
            out += `<g fill="${tint('')}"${alpha}>`;
            for (const d of nube) {
              out += `<circle cx="${_round(d.x)}" cy="${_round(d.y)}" r="${_round(d.r)}"/>`;
            }
            out += '</g>\n';
          }
          break;
        }

        // (Los `eraser` heredados nunca llegan aquí: _svgScene los convierte
        // en máscaras antes de llamar a _svgElement, y html() desvía a
        // _svgScene cualquier escena que los contenga.)

        case 'line':
          out += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" ${sBody}/>\n`;
          break;

        case 'arrow': {
          out += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" ${sBody}/>\n`;
          // Punta escalada con el grosor (10 + 2·lineWidth; 14 con el default)
          const hl = 10 + 2 * el.lineWidth;
          const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
          out += _svgArrowHead(el.x2, el.y2, a, hl, s);
          if (el.heads === 'both') {
            out += _svgArrowHead(el.x1, el.y1, Math.atan2(el.y1 - el.y2, el.x1 - el.x2), hl, s);
          }
          out += _svgArrowLabel(el, color);
          break;
        }

        case 'curveArrow': {
          const curveSegments = CurvePath.segments(el);
          const first = curveSegments[0];
          const curveD = curveSegments.map((seg, index) => {
            const move = index === 0 ? `M${first.x1} ${first.y1} ` : '';
            return seg.cx2 !== undefined
              ? `${move}C${seg.cx} ${seg.cy} ${seg.cx2} ${seg.cy2} ${seg.x2} ${seg.y2}`
              : `${move}Q${seg.cx} ${seg.cy} ${seg.x2} ${seg.y2}`;
          }).join(' ');
          out += `<path d="${curveD}" ${sBody}/>\n`;
          const chl = 10 + 2 * el.lineWidth;
          const curveStart = CurvePath.start(el);
          const curveEnd = CurvePath.end(el);
          // heads:'none' (semicírculos): sin punta en ningún extremo
          if (el.heads !== 'none') {
            const tangent = CurvePath.endTangent(el);
            out += _svgArrowHead(curveEnd.x, curveEnd.y, Math.atan2(tangent.dy, tangent.dx), chl, s);
          }
          // Doble punta opcional: tangente en el inicio (control → inicio)
          if (el.heads === 'both') {
            const tangent = CurvePath.startTangent(el);
            out += _svgArrowHead(curveStart.x, curveStart.y, Math.atan2(tangent.dy, tangent.dx), chl, s);
          }
          out += _svgArrowLabel(el, color);
          break;
        }

        case 'image':
          out += `<image x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" href="${_escapeXml(el.src)}" preserveAspectRatio="none"/>\n`;
          break;

        case 'rect':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" ${sf}/>\n`;
          break;

        case 'roundedRect':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="12" ${sf}/>\n`;
          break;

        case 'circle':
          out += `<ellipse cx="${el.x + el.w / 2}" cy="${el.y + el.h / 2}" rx="${Math.abs(el.w) / 2}" ry="${Math.abs(el.h) / 2}" ${sf}/>\n`;
          break;

        case 'square':
        case 'triangle':
        case 'pentagon':
        case 'hexagon':
        case 'star5':
        case 'star6': {
          const points = RegularPolygon.vertices(el).map(p => `${p.x},${p.y}`).join(' ');
          out += `<polygon points="${points}" ${sf}/>\n`;
          break;
        }

        case 'trapezoid': {
          const points = Trapezoid.vertices(el).map(p => `${p.x},${p.y}`).join(' ');
          out += `<polygon points="${points}" ${sf}/>\n`;
          break;
        }

        case 'polygon': {
          const points = el.points.map(p => `${p.x},${p.y}`).join(' ');
          // `stroke: false` es una cara sin contorno (las aristas del sólido se
          // dibujan aparte, una a una, con su propio discontinuo). Sin este
          // caso el SVG llevaría el contorno duplicado sobre cada arista.
          const attrs = el.stroke === false
            ? `stroke="none" fill="${el.fill ? fillCol : 'none'}"`
            : sf;
          out += `<polygon points="${points}" ${attrs}/>\n`;
          break;
        }

        case 'text': {
          // Multilínea: un <tspan> por línea con el mismo interlineado que el canvas
          const lines = String(el.value).split('\n');
          const weight = el.bold ? ' font-weight="bold"' : '';
          // La sombra va como <filter> propio, declarado justo antes del
          // <text> que lo usa: así el markup de un elemento sigue siendo
          // autocontenido (lo comparten el export SVG y el <svg> incrustado
          // del HTML, que se ensamblan por separado). El id lleva las medidas,
          // de modo que dos textos con la misma sombra generan filtros
          // idénticos y equivalentes, nunca uno pisando al otro.
          const sh = _svgTextShadow(el);
          out += sh.def;
          out += `<text x="${el.x}" y="${el.y + el.fontSize}" fill="${color}" font-family="${FONT_FALLBACK()}" font-size="${el.fontSize}"${weight}${sh.attr}>`;
          lines.forEach((ln, i) => {
            out += `<tspan x="${el.x}" dy="${i === 0 ? 0 : el.fontSize + 4}">${_escapeXml(ln)}</tspan>`;
          });
          out += `</text>\n`;
          break;
        }

        // UI components → simple rects with labels in SVG
        case 'button':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="8" stroke="${color}" stroke-width="${lw}" stroke-linecap="round" fill="${tint('15')}"/>\n`;
          out += `<text x="${el.x + el.w / 2}" y="${el.y + el.h / 2 + 5}" fill="${color}" font-family="${FONT_FALLBACK()}" font-size="14" text-anchor="middle">${_escapeXml(el.label || 'Botón')}</text>\n`;
          break;

        case 'input':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="4" stroke="${tint('80')}" stroke-width="${lw}" fill="none"/>\n`;
          out += `<text x="${el.x + 10}" y="${el.y + el.h / 2 + 4}" fill="${tint('60')}" font-family="${FONT_FALLBACK()}" font-size="13">${_escapeXml(el.label || 'Escribe aquí...')}</text>\n`;
          break;

        case 'imagePlaceholder':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" ${s}/>\n`;
          out += `<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" ${s} stroke-dasharray="6 4"/>\n`;
          out += `<line x1="${el.x + el.w}" y1="${el.y}" x2="${el.x}" y2="${el.y + el.h}" ${s} stroke-dasharray="6 4"/>\n`;
          break;

        case 'nav':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" stroke="${color}" stroke-width="${lw}" stroke-linecap="round" fill="${tint('0a')}"/>\n`;
          out += `<text x="${el.x + 20}" y="${el.y + el.h / 2 + 4}" fill="${color}" font-family="${FONT_FALLBACK()}" font-size="12">${_escapeXml(el.label || 'Logo')}</text>\n`;
          // Los mismos tres enlaces que pintan el canvas (renderer._nav) y el
          // export HTML, en las mismas posiciones (paso de 70px, hueco de 40
          // para la hamburguesa). El SVG simplifica FORMAS a propósito, pero un
          // texto que los otros dos formatos enseñan no puede faltar aquí.
          ['Inicio', 'Nosotros', 'Contacto'].forEach((link, i) => {
            out += `<text x="${el.x + el.w - 250 + i * 70}" y="${el.y + el.h / 2 + 4}" fill="${color}" font-family="${FONT_FALLBACK()}" font-size="12">${link}</text>\n`;
          });
          break;

        case 'card':
          out += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="10" ${s}/>\n`;
          out += `<line x1="${el.x + 4}" y1="${el.y + el.h * 0.45 + 4}" x2="${el.x + el.w - 4}" y2="${el.y + el.h * 0.45 + 4}" ${s}/>\n`;
          out += `<text x="${el.x + 12}" y="${el.y + el.h * 0.45 + 24}" fill="${color}" font-family="${FONT_FALLBACK()}" font-size="14" font-weight="bold">${_escapeXml(el.label || 'Título')}</text>\n`;
          break;
    }

    return out;
  }

  function _svgShapeFill(el) {
    if (!el.fill) return '';
    const fill = _escapeXml(_fillColor(el));
    if (el.type === 'circle') {
      return `<ellipse cx="${el.x + el.w / 2}" cy="${el.y + el.h / 2}" rx="${Math.abs(el.w) / 2}" ry="${Math.abs(el.h) / 2}" fill="${fill}" stroke="none"/>\n`;
    }
    if (RegularPolygon.isType(el.type)) {
      const points = RegularPolygon.vertices(el).map(p => `${p.x},${p.y}`).join(' ');
      return `<polygon points="${points}" fill="${fill}" stroke="none"/>\n`;
    }
    if (el.type === 'trapezoid') {
      const points = Trapezoid.vertices(el).map(p => `${p.x},${p.y}`).join(' ');
      return `<polygon points="${points}" fill="${fill}" stroke="none"/>\n`;
    }
    return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}"${el.type === 'roundedRect' ? ' rx="12"' : ''} fill="${fill}" stroke="none"/>\n`;
  }

  function _svgOverlapRuns(info, target, dashed, erasers = []) {
    const runs = Renderer.overlapRuns(info, target, erasers);
    if (!runs.length) return '';
    const d = runs.map(run => run.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')).join(' ');
    const color = _escapeXml(String(info.el.color));
    const lw = _escapeXml(String(info.el.lineWidth));
    const dash = dashed ? ` stroke-dasharray="${4 * info.el.lineWidth} ${4 * info.el.lineWidth}"` : '';
    return `<path d="${d}" stroke="${color}" stroke-width="${lw}" fill="none" stroke-linecap="round" stroke-linejoin="round"${dash}/>\n`;
  }

  /** Escena SVG coordinada para conservar orden y bordes ocultos parciales. */
  function _svgScene(elements, overlapMode = 'normal') {
    const hiddenDashed = overlapMode === 'hidden-dashed';
    const plan = hiddenDashed ? Renderer.buildOverlapPlan(elements) : [];
    const masks = [];
    let out = '';
    elements.forEach((el, index) => {
      if (el.type === 'eraser') {
        if (el.points.length < 2 || !out) return;
        const id = `pizarra-eraser-${masks.length}`;
        const d = el.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
          .join(' ');
        masks.push(
          `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}">` +
          `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="white"/>` +
          `<path d="${d}" stroke="black" stroke-width="${Renderer.eraserSize(el)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
          `</mask>`,
        );
        out = `<g mask="url(#${id})">\n${out}</g>\n`;
        return;
      }
      if (!hiddenDashed) {
        out += _svgElement(el);
        return;
      }
      const current = plan[index];
      if (!current) {
        out += _svgElement(el);
        return;
      }
      out += _svgShapeFill(el);
      for (let lower = 0; lower < index; lower++) {
        if (plan[lower]) {
          const interveningErasers = elements
            .slice(lower + 1, index)
            .filter(candidate => candidate.type === 'eraser');
          out += _svgOverlapRuns(plan[lower], index, true, interveningErasers);
        }
      }
      out += _svgOverlapRuns(current, -1, false);
    });
    return masks.length ? `<defs>${masks.join('')}</defs>\n${out}` : out;
  }

  function html(elements, options = {}) {
    let out = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wireframe Export</title>
${FONT_URL() ? `<link href="${FONT_URL()}" rel="stylesheet">` : '<!-- letra propia de la app: sin fuente web que pedir -->'}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: ${FONT_CSS()}; background: #fff; }
.wireframe { position: relative; width: ${CANVAS_W}px; height: ${CANVAS_H}px; margin: 20px auto; border: 1px solid #ccc; }
.wireframe > * { position: absolute; }
</style>
</head>
<body>
<div class="wireframe">
`;

    const hasEraser = elements.some(el => el.type === 'eraser');
    if (options.overlapMode === 'hidden-dashed' || hasEraser) {
      // El recorte parcial de contornos requiere SVG; en este modo la escena
      // completa se conserva en un único lienzo vectorial con su z-order.
      out += `  <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" style="left:0;top:0;pointer-events:none;">\n`;
      out += _svgScene(elements, options.overlapMode).split('\n').filter(Boolean).map(line => `    ${line}\n`).join('');
      out += `  </svg>\n`;
    } else {
      // Tipos sin representación HTML (lápiz, líneas, flechas, círculos): se
      // incrustan como <svg> superpuestos — uno por TRAMO contiguo, en el
      // orden del lienzo. Con un único <svg> inicial, todo vector quedaba
      // debajo de todos los componentes (los absolutos posteriores pintan
      // encima) y una flecha dibujada sobre un card desaparecía tras él.
      let svgRun = '';
      const flushVectors = () => {
        if (!svgRun) return;
        out += `  <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" style="left:0;top:0;pointer-events:none;">\n`;
        out += svgRun;
        out += `  </svg>\n`;
        svgRun = '';
      };

      elements.forEach(el => {
      if (VECTOR_TYPES.includes(el.type)) {
        svgRun += '    ' + _svgElement(el);
        return;
      }
      flushVectors();
      const color = _escapeHtml(String(el.color));
      // Mismo motivo que en _svgElement: nunca concatenar alfa sobre un
      // color que puede traer alfa propio (#rrggbbaa)
      const tint = a => _escapeHtml(String(el.color).slice(0, 7)) + a;
      const lw = _escapeHtml(String(el.lineWidth));
      switch (el.type) {
        case 'rect':
        case 'roundedRect': {
          const bg = _escapeHtml(_fillColor(el));
          out += `  <div style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:${lw}px solid ${color};${el.type === 'roundedRect' ? 'border-radius:12px;' : ''}${el.fill ? `background:${bg};` : ''}"></div>\n`;
          break;
        }
        case 'text':
          out += `  <p style="left:${el.x}px;top:${el.y}px;color:${color};font-size:${el.fontSize}px;white-space:pre-wrap;line-height:${el.fontSize + 4}px;${el.bold ? 'font-weight:bold;' : ''}${_htmlTextShadow(el)}">${_escapeHtml(el.value)}</p>\n`;
          break;
        case 'button':
          out += `  <button style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:${lw}px solid ${color};border-radius:8px;background:${tint('15')};color:${color};font-family:inherit;cursor:pointer;">${_escapeHtml(el.label || 'Botón')}</button>\n`;
          break;
        case 'input':
          out += `  <input placeholder="${_escapeHtml(el.label || 'Escribe aquí...')}" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:${lw}px solid ${tint('80')};border-radius:4px;padding:0 10px;font-family:inherit;"/>\n`;
          break;
        case 'imagePlaceholder':
          out += `  <div style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:${lw}px solid ${color};display:flex;align-items:center;justify-content:center;color:${tint('80')};font-size:14px;">Imagen</div>\n`;
          break;
        case 'image':
          out += `  <img src="${_escapeHtml(el.src)}" alt="" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;object-fit:fill;"/>\n`;
          break;
        case 'nav':
          out += `  <nav style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:${lw}px solid ${color};display:flex;align-items:center;justify-content:space-between;padding:0 20px;"><span>${_escapeHtml(el.label || 'Logo')}</span><div style="display:flex;gap:20px;"><a href="#">Inicio</a><a href="#">Nosotros</a><a href="#">Contacto</a></div></nav>\n`;
          break;
        case 'card':
          out += `  <div style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:${lw}px solid ${color};border-radius:10px;overflow:hidden;"><div style="height:45%;background:${tint('10')};border-bottom:1px solid ${tint('30')};"></div><div style="padding:12px;"><h3 style="color:${color};">${_escapeHtml(el.label || 'Título')}</h3><p style="color:${tint('60')};margin-top:6px;">Texto de ejemplo</p></div></div>\n`;
          break;
      }
      });
      flushVectors();
    }

    out += `</div>\n</body>\n</html>`;
    _downloadBlob('wireframe.html', new Blob([out], { type: 'text/html' }));
  }

  function json(elements, options = {}) {
    const data = {
      version: 1,
      canvasSize: { w: CANVAS_W, h: CANVAS_H },
      settings: {
        overlapMode: options.overlapMode === 'hidden-dashed' ? 'hidden-dashed' : 'normal',
      },
      elements,
    };
    // El ASPECTO del lienzo (papel, color de rejilla y si se ve) viaja SOLO en
    // el JSON, y esto no contradice la regla de que ninguna exportación lo
    // lleva: PNG, JPG, SVG y HTML son dibujos terminados —lo que se imprime
    // sale sobre blanco limpio— y el JSON es el proyecto, el único formato que
    // se vuelve a abrir. Un dibujo hecho sobre «Pizarra» con tinta clara
    // reaparecía sobre el papel de quien lo abre, que puede ser blanco: el
    // trazo se volvía invisible sin que nada explicase por qué.
    // Solo se escribe lo que es válido: un ajuste con basura dentro es peor
    // que su ausencia, que ya significa «respeta el aspecto que tengas».
    if (HEX_COLOR.test(String(options.canvasBg || ''))) data.settings.canvasBg = options.canvasBg;
    if (HEX_COLOR.test(String(options.gridColor || ''))) data.settings.gridColor = options.gridColor;
    if (typeof options.showGrid === 'boolean') data.settings.showGrid = options.showGrid;
    _downloadBlob('wireframe.json', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  }

  /* ── Validación de import ── */

  const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
  // Solo data-URLs base64 de PNG/JPEG/WebP: evita javascript:/http: inyectados
  // por un JSON manipulado en los exports SVG/HTML. WebP entró en v2.35.0: es
  // lo que emite el borrado por trama al morder una foto (PNG sin pérdida
  // multiplicaba su peso ×5-7 y reventaba la cuota de localStorage).
  const IMAGE_SRC = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
  // TOOLS.SELECT, ARC y EMOJI son ids de herramienta que NO son tipos de
  // elemento: SELECT no crea nada; ARC crea un `curveArrow` y EMOJI un `text`.
  // Sin excluirlos, un JSON importado con type:'arc'/'emoji' pasaría la
  // validación y se colaría un elemento fantasma (el renderer no tiene caso
  // para ellos: invisible pero seleccionable).
  // Las herramientas de "Edificios" (BUILDING_TOOLS) también son solo de
  // creación: producen rect/line, nunca un el.type propio. Excluirlas evita
  // que un JSON con type:'planta'/'alzado'/… pase isValidElement y cuele un
  // elemento fantasma (invisible pero seleccionable).
  // Lo mismo vale para "Jardín" (GARDEN_TOOLS): producen rect/line/circle/
  // curveArrow/text, nunca un el.type propio.
  // AIRBRUSH **no** entra aquí, y es el reflejo equivocado al añadir una
  // herramienta: el aerógrafo SÍ es un tipo de elemento, así que meterlo en
  // esta lista lo sacaría de ELEMENT_TYPES y ninguna mancha sobreviviría a un
  // export→import.
  // Y lo mismo con "3D" (SOLID_TOOLS): un sólido son la forma 2D de su cara
  // frontal más line/curveArrow, nunca un `type:'prisma'`.
  // INK sí entra: el bote de pintura no es un tipo, lo que crea es un
  // `polygon` con `ink: true`. Es la diferencia exacta con el aerógrafo.
  const CREATION_ONLY_TOOLS = [TOOLS.SELECT, TOOLS.ARC, TOOLS.EMOJI, TOOLS.INK,
    ...BUILDING_TOOLS, ...GARDEN_TOOLS, ...SOLID_TOOLS];
  const ELEMENT_TYPES = Object.values(TOOLS).filter(t => !CREATION_ONLY_TOOLS.includes(t));

  function _isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /**
   * Valida un elemento importado: type conocido, color hex y campos
   * numéricos requeridos según el tipo. Un elemento inválido rompería
   * redraw() y con ello toda la app.
   */
  function isValidElement(el) {
    if (!el || typeof el !== 'object') return false;
    if (!ELEMENT_TYPES.includes(el.type)) return false;
    if (typeof el.color !== 'string' || !HEX_COLOR.test(el.color)) return false;
    if (!_isNum(el.lineWidth)) return false;
    // Campos opcionales comunes: DEBEN validarse aquí, antes de los return
    // tempranos por tipo (colocarlos más abajo los deja en zona muerta)
    // heads (puntas): whitelist estricta; undefined ≡ 'end'; 'none' = sin
    // puntas (semicírculos)
    if (el.heads !== undefined && el.heads !== 'end' && el.heads !== 'both' &&
        el.heads !== 'none') return false;
    // dash (trazo discontinuo): solo se serializa `true`
    if (el.dash !== undefined && el.dash !== true) return false;
    // taper (lápiz con presión simulada, v2.37.0): atado a su tipo y solo en
    // `true` — la ausencia es el lápiz clásico, igual que `ink` con el bote.
    if (el.taper !== undefined &&
        !(el.type === 'pencil' && el.taper === true)) return false;
    // fill (relleno de formas): booleano — `false` también se serializa, así
    // que ambos valores son válidos
    if (el.fill !== undefined && typeof el.fill !== 'boolean') return false;
    // fillTransparent (relleno translúcido): booleano
    if (el.fillTransparent !== undefined && typeof el.fillTransparent !== 'boolean') return false;
    // fillOpacity: opacidad del relleno translúcido, inclusiva entre 0 y 1
    if (el.fillOpacity !== undefined &&
        !(_isNum(el.fillOpacity) && el.fillOpacity >= 0 && el.fillOpacity <= 1)) return false;
    // fillColor (color de relleno propio): se interpola en los exports
    // SVG/HTML, así que se valida como hex igual que `color`
    if (el.fillColor !== undefined &&
        !(typeof el.fillColor === 'string' && HEX_COLOR.test(el.fillColor))) return false;
    // ink: marca la mancha del bote de pintura. Atada a su tipo y con la
    // ausencia como valor normal, igual que `dash`. No es decorativa: es lo
    // que hace que una mancha NO sea barrera al repintar (si lo fuera, no se
    // le podría cambiar el color) y lo que la distingue de una cara de sólido,
    // que también es un `polygon` sin contorno y sí debe frenar la pintura.
    if (el.ink !== undefined &&
        !(el.type === 'polygon' && el.ink === true)) return false;
    // locked (v3.8.0): el candado. Solo `true` — la ausencia es el estado
    // normal, patrón de `ink`/`taper` — y en cualquier tipo: proteger un
    // texto o una foto vale tanto como proteger una forma.
    if (el.locked !== undefined && el.locked !== true) return false;
    // size: ancho real del borrador nuevo (v1.8.1). Si falta, se conserva la
    // compatibilidad histórica usando lineWidth × 4.
    if (el.size !== undefined &&
        !(el.type === 'eraser' && _isNum(el.size) && el.size >= 4 && el.size <= 100)) return false;
    // Campos del aerógrafo, todos atados a su tipo (como `size` al borrador):
    // sueltos en otro elemento no significan nada y son basura serializada.
    // opacity: solo se guarda cuando NO es sólido — un 1 explícito se rechaza
    // igual que `dash: false`, porque la ausencia del campo ES el sólido.
    if (el.opacity !== undefined &&
        !(el.type === 'airbrush' && _isNum(el.opacity) &&
          el.opacity > 0 && el.opacity < 1)) return false;
    // radius (boquilla) y density: sin ellos no hay nube que regenerar.
    if (el.radius !== undefined &&
        !(el.type === 'airbrush' && _isNum(el.radius) &&
          el.radius >= Airbrush.R_MIN && el.radius <= Airbrush.R_MAX)) return false;
    if (el.density !== undefined &&
        !(el.type === 'airbrush' && _isNum(el.density) &&
          el.density >= Airbrush.DENSITY_MIN && el.density <= Airbrush.DENSITY_MAX)) return false;
    // clip (área a la que se recorta la pintura): objeto plano con EXACTAMENTE
    // x/y/w/h finitos, con el mismo rigor que los puntos de gardenMeta.
    if (el.clip !== undefined) {
      const c = el.clip;
      if (!(el.type === 'airbrush' && c && typeof c === 'object' && !Array.isArray(c))) return false;
      const keys = Object.keys(c);
      if (keys.length !== 4 || !keys.every(k => ['x', 'y', 'w', 'h'].includes(k))) return false;
      if (!_isNum(c.x) || !_isNum(c.y) || !(_isNum(c.w) && c.w > 0) || !(_isNum(c.h) && c.h > 0)) return false;
    }
    // rotation: orientación opcional y normalizada de polígonos. El trapecio
    // solo admite cuartos de vuelta; los rectángulos siguen serializando el
    // giro directamente en sus dimensiones.
    if (el.rotation !== undefined) {
      if (!(_isNum(el.rotation) && el.rotation >= 0 && el.rotation < 360)) return false;
      if (!(RegularPolygon.isType(el.type) ||
            (el.type === 'trapezoid' && el.rotation % 90 === 0))) return false;
    }
    // label (etiqueta de componentes y flechas)
    if (el.label !== undefined && typeof el.label !== 'string') return false;
    // labelT (posición de la etiqueta sobre el trazo): número en (0,1) abierto
    if (el.labelT !== undefined && !(_isNum(el.labelT) && el.labelT > 0 && el.labelT < 1)) return false;
    // id (destino de anclaje) y anchors de conector: no se interpolan en
    // exports, pero se validan igualmente
    const ID_RE = /^[a-z0-9]{1,32}$/i;
    if (el.id !== undefined && !(typeof el.id === 'string' && ID_RE.test(el.id))) return false;
    // buildingGroupId: id compartido por las piezas de un mismo edificio (agrupación)
    if (el.buildingGroupId !== undefined && !(typeof el.buildingGroupId === 'string' && ID_RE.test(el.buildingGroupId))) return false;
    // solidMeta: remate y proyección de una figura 3D, lo único que no se puede
    // deducir de sus piezas (la sección, la caja y el giro salen de la cara
    // frontal). Vuelve a alimentar geometría al regenerar el sólido, así que se
    // valida con el mismo rigor que gardenMeta: whitelist cerrada y rangos.
    if (el.solidMeta !== undefined) {
      const m = el.solidMeta;
      const allowed = ['version', 'tool', 'depth', 'angle', 'foreshorten', 'taper'];
      // La pirámide de pie no tiene cara frontal de la que reconstruir el
      // gesto, así que lo guarda; y con él, la sección y el giro que la cara
      // habría dicho. Sólo esa combinación: los cuatro campos extra van juntos
      // o no van, para que no entre un meta a medias que regenere cualquier cosa.
      const dePie = ['apex', 'section', 'rotation', 'gesture'];
      const conGesto = dePie.some(k => m && m[k] !== undefined);
      const inRange = (v, lo, hi) => _isNum(v) && v >= lo && v <= hi;
      if (conGesto) {
        const g = m.gesture;
        if (!(m.apex === 'upright' && Solid.supportsApex(m.tool) &&
              SOLID_SECTIONS.includes(m.section) &&
              inRange(m.rotation, 0, 359) &&
              g && typeof g === 'object' && !Array.isArray(g) &&
              Object.keys(g).length === 4 &&
              [g.x1, g.y1, g.x2, g.y2].every(_isNum))) return false;
        allowed.push(...dePie);
        // Dos campos opcionales, sólo de pie, y su ausencia es el default:
        // `turns` acumula los cuartos de vuelta pendientes de la figura (girar
        // el gesto no puede representar una figura tumbada — regenerateSolid
        // los re-aplica), y `fillColor` conserva el color de relleno cuando el
        // relleno está apagado, porque de pie no queda cara que lo guarde.
        if (m.turns !== undefined) {
          if (!(Number.isInteger(m.turns) && m.turns >= 1 && m.turns <= 3)) return false;
          allowed.push('turns');
        }
        if (m.fillColor !== undefined) {
          if (!(typeof m.fillColor === 'string' && HEX_COLOR.test(m.fillColor))) return false;
          allowed.push('fillColor');
        }
      }
      if (!(m && typeof m === 'object' && !Array.isArray(m) &&
            Object.keys(m).length === allowed.length &&
            Object.keys(m).every(k => allowed.includes(k)) &&
            (m.version === 1 || m.version === 2) && SOLID_TOOLS.includes(m.tool) &&
            inRange(m.depth, Solid.DEPTH_MIN, Solid.DEPTH_MAX) &&
            inRange(m.angle, Solid.ANGLE_MIN, Solid.ANGLE_MAX) &&
            inRange(m.foreshorten, Solid.FORESHORTEN_MIN, Solid.FORESHORTEN_MAX) &&
            inRange(m.taper, Solid.TAPER_MIN, Solid.TAPER_MAX))) return false;
    }
    // gardenMeta: intención botánica del grupo (permite reabrir y regenerar la
    // planta tras exportar/importar). Whitelist estricta: estas cotas vuelven a
    // alimentar geometría, por lo que no se aceptan strings ni valores libres.
    if (el.gardenMeta !== undefined) {
      const m = el.gardenMeta;
      const catalogs = {
        [TOOLS.GARDEN_TREE]: TREE_TYPES,
        [TOOLS.GARDEN_SHRUB]: SHRUB_TYPES,
        [TOOLS.GARDEN_FLOWER]: FLOWER_TYPES,
        [TOOLS.GARDEN_HERB]: HERB_TYPES,
        [TOOLS.GARDEN_CLIMBER]: CLIMBER_TYPES,
      };
      const allowed = ['version', 'tool', 'variant', 'p1', 'p2', 'color', 'lineWidth', 'plantView',
        'plantStage', 'plantScalePct', 'plantPxPerM', 'plantColorMode',
        'gardenLabelMode', 'labels'];
      const point = p => p && typeof p === 'object' && !Array.isArray(p) &&
        Object.keys(p).length === 2 && _isNum(p.x) && _isNum(p.y);
      if (!(m && typeof m === 'object' && !Array.isArray(m) &&
            Object.keys(m).length === allowed.length &&
            Object.keys(m).every(key => allowed.includes(key)) &&
            m.version === 1 && catalogs[m.tool] &&
            typeof m.variant === 'string' && catalogs[m.tool].some(v => v.id === m.variant) &&
            point(m.p1) && point(m.p2) &&
            typeof m.color === 'string' && HEX_COLOR.test(m.color) &&
            _isNum(m.lineWidth) && m.lineWidth >= 1 && m.lineWidth <= 8 &&
            GARDEN_PLANT_VIEWS.some(v => v.id === m.plantView) &&
            GARDEN_STAGES.some(v => v.id === m.plantStage) &&
            _isNum(m.plantScalePct) && m.plantScalePct >= 50 && m.plantScalePct <= 150 &&
            _isNum(m.plantPxPerM) && m.plantPxPerM >= 8 && m.plantPxPerM <= 50 &&
            (m.plantColorMode === 'natural' || m.plantColorMode === 'ink') &&
            GARDEN_LABEL_MODES.some(v => v.id === m.gardenLabelMode) &&
            typeof m.labels === 'boolean')) return false;
    }
    const validAnchor = a => a === undefined ||
      (a !== null && typeof a === 'object' && !Array.isArray(a) &&
       typeof a.id === 'string' && ID_RE.test(a.id));
    if (!validAnchor(el.startAnchor) || !validAnchor(el.endAnchor)) return false;
    // Polígono libre: la lista de puntos ES la geometría. Se exige un triángulo
    // como mínimo —con menos no hay cara— y `stroke` sólo se serializa en
    // `false`, porque la ausencia del campo es el aspecto normal (con
    // contorno), igual que `dash` sólo se serializa en `true`.
    if (el.type === 'polygon') {
      if (el.stroke !== undefined && el.stroke !== false) return false;
      return Array.isArray(el.points) && el.points.length >= 3 &&
             el.points.every(p => p && _isNum(p.x) && _isNum(p.y));
    }
    if (el.type === 'pencil' || el.type === 'eraser') {
      return Array.isArray(el.points) && el.points.length > 0 &&
             el.points.every(p => p && _isNum(p.x) && _isNum(p.y));
    }
    // El aerógrafo guarda el EJE, no la nube: sin radius y density no hay nada
    // que regenerar, así que aquí sí son obligatorios (arriba solo se comprobó
    // que, de venir, estén en rango y en el tipo correcto).
    if (el.type === 'airbrush') {
      return Array.isArray(el.points) && el.points.length > 0 &&
             el.points.every(p => p && _isNum(p.x) && _isNum(p.y)) &&
             el.radius !== undefined && el.density !== undefined;
    }
    if (el.type === 'line' || el.type === 'arrow') {
      return _isNum(el.x1) && _isNum(el.y1) && _isNum(el.x2) && _isNum(el.y2);
    }
    if (el.type === 'curveArrow') {
      if (el.segments !== undefined) {
        if (!CurvePath.isValidSegments(el.segments, _isNum)) return false;
        if (el.arc !== undefined || el.cx2 !== undefined || el.cy2 !== undefined) return false;
        const first = el.segments[0];
        const last = el.segments[el.segments.length - 1];
        return el.x1 === first.x1 && el.y1 === first.y1 &&
               el.x2 === last.x2 && el.y2 === last.y2;
      }
      // Segundo control (curva en S): opcional, pero en pareja y numérico
      if ((el.cx2 !== undefined || el.cy2 !== undefined) &&
          !(_isNum(el.cx2) && _isNum(el.cy2))) return false;
      // arc (arco circular): whitelist estricta de `true` y exige cúbica
      if (el.arc !== undefined && (el.arc !== true || el.cx2 === undefined)) return false;
      return _isNum(el.x1) && _isNum(el.y1) && _isNum(el.x2) && _isNum(el.y2) &&
             _isNum(el.cx) && _isNum(el.cy);
    }
    if (el.type === 'image') {
      return _isNum(el.x) && _isNum(el.y) && _isNum(el.w) && _isNum(el.h) &&
             el.w > 0 && el.h > 0 &&
             typeof el.src === 'string' && IMAGE_SRC.test(el.src);
    }
    if (el.type === 'text') {
      // fontSize > 0: con uno negativo el canvas ignora la asignación de font
      // (el texto sale con la fuente que quedara) y el SVG no lo renderiza.
      // bold/shadow/shadowColor son opcionales y su AUSENCIA es el aspecto de
      // siempre; se validan porque acaban en el markup exportado: una sombra
      // inventada colaría un id de filtro arbitrario en el SVG y un color no
      // hexadecimal, texto libre dentro de un atributo de estilo.
      if (el.bold !== undefined && typeof el.bold !== 'boolean') return false;
      if (el.shadow !== undefined &&
          !TEXT_SHADOWS.some(s => s.id === el.shadow)) return false;
      if (el.shadowColor !== undefined &&
          !(typeof el.shadowColor === 'string' && HEX_COLOR.test(el.shadowColor))) return false;
      return _isNum(el.x) && _isNum(el.y) && typeof el.value === 'string' &&
             _isNum(el.fontSize) && el.fontSize > 0;
    }
    if (RegularPolygon.isType(el.type)) {
      return _isNum(el.x) && _isNum(el.y) && _isNum(el.w) && _isNum(el.h) &&
             el.w > 0 && el.h > 0 && Math.abs(el.w - el.h) < 1e-6;
    }
    if (el.type === 'trapezoid') {
      return _isNum(el.x) && _isNum(el.y) && _isNum(el.w) && _isNum(el.h) &&
             el.w > 0 && el.h > 0;
    }
    // w/h > 0 también aquí (rect, circle, componentes UI…): con dimensiones
    // negativas el canvas aún dibuja algo pero <rect width="-100"> es un
    // error SVG y CSS descarta width negativos — el elemento "desaparece"
    // solo en los exports. La app nunca los crea (creación y resize
    // normalizan), así que solo puede venir de un JSON manipulado.
    return _isNum(el.x) && _isNum(el.y) && _isNum(el.w) && _isNum(el.h) &&
           el.w > 0 && el.h > 0;
  }

  /**
   * Import JSON — returns a Promise resolving to the element array, or null.
   * Los elementos inválidos se descartan avisando al usuario.
   */
  function importJSON() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data || !Array.isArray(data.elements)) {
              alert('Archivo JSON inválido: falta el array "elements"');
              return resolve(null);
            }
            const valid = data.elements.filter(isValidElement);
            const discarded = data.elements.length - valid.length;
            if (discarded > 0) {
              alert(`Se descartaron ${discarded} elemento(s) inválido(s) del archivo`);
            }
            const s = data.settings || {};
            Object.defineProperty(valid, 'overlapMode', {
              value: s.overlapMode === 'hidden-dashed' ? 'hidden-dashed' : 'normal',
              enumerable: false,
            });
            // El aspecto del lienzo, si el archivo lo trae. `undefined` cuando
            // falta o no es válido —un JSON anterior a la v3.1.0, o manipulado—
            // y el llamador entiende esa ausencia como «no toques el aspecto»,
            // que es lo que hacía la app antes de esto. No enumerables, como
            // `overlapMode`: `valid` sigue siendo el array de elementos y nada
            // de esto puede colarse en un `JSON.stringify` ni en un recorrido.
            const aspecto = {
              canvasBg:  HEX_COLOR.test(String(s.canvasBg || '')) ? s.canvasBg : undefined,
              gridColor: HEX_COLOR.test(String(s.gridColor || '')) ? s.gridColor : undefined,
              showGrid:  typeof s.showGrid === 'boolean' ? s.showGrid : undefined,
            };
            for (const k of Object.keys(aspecto)) {
              Object.defineProperty(valid, k, { value: aspecto[k], enumerable: false });
            }
            resolve(valid);
          } catch {
            alert('Archivo JSON inválido');
            resolve(null);
          }
        };
        // Sin onerror la promesa no se resolvía nunca: un fallo de lectura
        // dejaba el `await` del llamador colgado en silencio.
        reader.onerror = () => {
          alert('No se pudo leer el archivo');
          resolve(null);
        };
        reader.readAsText(file);
      };
      if (input.addEventListener) {
        input.addEventListener('cancel', () => resolve(null));
      }
      input.click();
    });
  }

  /* ── Utilities ── */

  function _escapeXml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { png, jpg, svg, html, json, importJSON, isValidElement };
})();
