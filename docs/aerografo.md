### Aerógrafo (v2.22.0)

La herramienta que aplica **tono** en vez de trazo. La geometría vive en
`src/js/airbrush.js` (reglas arriba); lo que hay que saber del resto de la app:

- **`CREATION_ONLY_TOOLS` (exporter.js) NO se toca.** Es el reflejo automático al
  añadir una herramienta y aquí sería justo el error: `airbrush` **sí** es un tipo
  de elemento, así que meterlo en esa lista lo sacaría de `ELEMENT_TYPES` y
  ninguna mancha sobreviviría a un export→import. Guardado por un round-trip.
- **Dos caminos de pintado, y el motivo de que sean dos.** En **sólido**, una sola
  ruta con N `arc()` y **un único `fill()`** (idéntico con círculos opacos: la
  unión, y mucho más rápido). En **translúcido**, `globalAlpha` + `fill()` **por
  gota**, porque ahí la acumulación de alfa *es* el efecto. Cada `arc()` necesita
  su `moveTo(x+r, y)` delante o la ruta sale cosida con rectas. En SVG lo mismo:
  `<g fill="…" fill-opacity="…">` con un `<circle>` por gota — **`fill-opacity`,
  jamás `opacity`**, que aplanaría el grupo antes de componer y mataría la
  acumulación (la divergencia lienzo↔export más fácil de colar). Agrupar además
  parte por la mitad el peso del `.svg`. Las tres cosas tienen guarda.
- **La ausencia del campo es el aspecto por defecto**, como con `bold`/`shadow`
  del texto: `opacity` solo se guarda si es < 1 (el mando al 100 % lo **borra**, y
  `isValidElement` rechaza `opacity: 1` igual que rechaza `dash: false`), y `clip`
  solo si hay área. Una mancha corriente serializa exactamente lo mismo que
  serializaría sin esta funcionalidad.
- **El área es un rectángulo, y su marco es overlay puro** (precedente:
  `drawPathAngle`): se limpia cada fotograma, no es elemento, no cuenta en
  «Elementos», no entra en undo, autoguardado ni exportación. El elemento sí
  guarda una **copia** (`{...state.airbrushArea}`, nunca la referencia: los
  elementos son planos y compartirla haría que mover una mancha moviera el área
  de la herramienta), y `moveElement`/`scaleElement` la llevan con él.
- **Armar el área CIERRA el modal**, y no es comodidad: un `<dialog showModal>`
  deja inerte todo lo de detrás, así que pedir un arrastre en el lienzo sin
  cerrarlo deja al usuario mirando una app que no responde — el síntoma exacto de
  la v2.16.2. Lo mismo vale para `#modal-airbrush` en `SETTINGS_MODALS` de
  `e2e/helpers.js`. Un arrastre por debajo de `MIN_AREA` **no cambia nada y sigue
  armado**: un clic torpe no debe perder el modo ni pintar una mancha que nadie
  pidió. Marcar el área **no lleva `saveUndo`** — es un ajuste de herramienta,
  como `state.eraserSize`.
- **Una mancha cuyas gotas caen todas fuera del área no se crea** (`isEmpty` en
  `onMouseUp`): sería un elemento invisible que cuenta en «Elementos» y viaja en
  el JSON.
- **El seed se fija en el `mousedown`** (`state.airbrushSeed`), no al soltar: la
  previsualización dibuja la nube de verdad con `Renderer.renderElement`, y con un
  seed nuevo por fotograma herviría. `drawPiecesPreview` **no** se toca: es de
  Edificios/Jardín.
- **El puntero es el círculo de la boquilla** (`cursor: none` + arco en
  `paintOverlay`, igual que el Borrador), y rodea la superficie **exacta**: las
  gotas se recortan en tamaño —`r = min(r, R - rho)`— para que la tinta acabe
  justo en `radius`. Se recorta el TAMAÑO y no la posición del centro a
  propósito: acotar el centro a `R - grano` daría el mismo borde, pero como el
  grano no escala con el dibujo la banda efectiva dejaría de ser proporcional y
  **las gotas se recolocarían al redimensionar** (lo probé: rompe la guarda del
  escalado afín). `onMouseMove` actualiza `lastPos` también en reposo para esta
  herramienta, como para el borrador, o el círculo se queda clavado.
- **La paleta vive en dos sitios** (`COLOR_GRIDS`): el panel y estos ajustes.
  `updateColorActive` consulta por **clase**, no por id, así que resalta el
  color activo en las dos sin saber que hay dos — pero cualquier test o spec que
  busque una muestra por `data-color` tiene que **acotar la rejilla**
  (`#color-grid .panel__color-swatch[...]`), o encuentra dos y falla en modo
  estricto. Ya mordió a `e2e/panel.spec.js` al añadir la segunda.
- **Los cuatro deslizadores no pueden ir por `applyStrokeWidth`** aunque el grano
  acabe en `lineWidth`: sin selección esa función escribe `state.lineWidth`, que
  es el grosor de los trazos, no el grano del espray. Comparten un cuerpo propio
  (`applyAirbrush`) con el mismo contrato de siempre: snapshot al primer `input`,
  commit en `change` **y** `pointerup`/`pointercancel`, `savePrefs` en el commit.

