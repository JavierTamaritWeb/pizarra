# Changelog

Los cambios notables de Pizarra se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

## [1.8.0] — 2026-07-24

### Añadido
- **Rotación discreta de formas** desde el panel o con `Shift+R`: cada
  triángulo, rectángulo o rectángulo redondeado gira 90°, cada pentágono 36°
  y cada hexágono 30° alrededor de su propio centro. La acción admite
  multi-selección y un único paso de undo.
- La orientación de los polígonos se conserva en autoguardado, portapapeles,
  JSON, SVG, HTML, PNG y JPG; el giro de rectángulos se representa
  intercambiando sus dimensiones.
- 6 pruebas de pasos, centro, normalización, inmutabilidad y conservación de
  lados: la suite pasa de 186 a 192.

## [1.7.0] — 2026-07-24

### Añadido
- **Triángulo, pentágono y hexágono regulares** en la barra de Formas, con
  atajos `3`, `5` y `6`. El arrastre parte del centro y el redimensionado
  conserva un contenedor cuadrado para que todos los lados sigan siendo
  iguales.
- Los nuevos polígonos admiten relleno sólido/translúcido, detección por su
  silueta real, bordes ocultos y exportación PNG, JPG, SVG, HTML y JSON.
- 9 pruebas de geometría, renderizado, solapamiento, validación y exportación:
  la suite pasa de 177 a 186.
- **Flechas curvas encadenadas**: un click sin arrastrar inicia la cadena,
  cada click fija un nuevo tramo y `Ctrl`/`Cmd`+click confirma el último y
  coloca la punta final. `Retroceso`, `Esc` y `Enter` permiten corregir,
  cancelar o terminar la construcción.
- Edición de controles y puntos de unión, inversión de giro/dirección,
  anclaje de extremos y exportación completa a PNG, JPG, SVG, HTML y JSON
  para las cadenas.
- 8 pruebas nuevas de geometría, continuidad, renderizado, validación,
  exportación y round-trip JSON: la suite pasa de 169 a 177.

### Cambiado
- En pantallas de más de 1200 px, la barra lateral amplía su ancho y organiza
  todas las herramientas en dos columnas; hasta 1200 px conserva la
  disposición compacta de una columna.

## [1.6.0] — 2026-07-24

### Añadido
- **Relleno sólido o translúcido regulable** para círculo/elipse, rectángulo y
  rectángulo redondeado: el checkbox "Relleno translúcido" alterna el modo y
  un nuevo slider permite ajustar la opacidad del 0 al 100 % (40 % por
  defecto). Ambos siguen la semántica dual del panel: con selección editan
  las formas seleccionadas (un paso de undo por gesto); sin selección fijan
  los valores de las próximas formas.
- Los campos `fillTransparent` y `fillOpacity` se conservan en los cinco
  formatos de exportación (PNG/JPG vía render, SVG, HTML y JSON). Las formas
  translúcidas antiguas sin `fillOpacity` mantienen el 40 %, y las formas sin
  `fillTransparent` se ven igual que antes.
- **Dos modos globales de solapamiento**: "Normal" mantiene la mezcla actual y
  "Bordes ocultos" dibuja discontinuos solo los tramos del contorno inferior
  cubiertos por rectángulos, redondeados o círculos/elipses superiores. El
  cálculo usa la geometría real y el orden de capas, se actualiza en vivo y
  se conserva en autoguardado, JSON y los cinco formatos de exportación.
- 16 tests nuevos (render, geometría, z-order, export SVG/HTML, validación y
  round-trip): la suite pasa de 153 a 169.

## [1.5.0] — 2026-07-23

### Cambiado
- **La aplicación pasa a llamarse Pizarra también en la interfaz**: el
  wordmark de la barra superior y el `<title>` de la pestaña decían todavía
  "SketchWire", mientras que el README ya usaba Pizarra desde la 1.1.1.
- Las claves de `localStorage` (`sketchwire.autosave`, `sketchwire.prefs`) y
  el marcador del portapapeles (`sketchwire/elements`) **conservan el nombre
  antiguo a propósito**: renombrarlas dejaría huérfanos el lienzo y las
  preferencias ya guardados de cada usuario. Queda anotado en el código y en
  `CLAUDE.md`.

### Cambiado
- **"Limpiar todo" devuelve también el zoom al 100 %** (además de vaciar el
  lienzo y restaurar los colores). El 100 % se mantiene aunque después se
  redimensione la ventana: la limpieza cuenta como una elección explícita de
  zoom, así que el auto-ajuste no vuelve a agrandarlo por su cuenta.

### Corregido
- **La herramienta Texto no creaba nada.** Al hacer click en el lienzo, el
  editor se abría y se cerraba en el mismo instante (el `focus()` síncrono se
  perdía por el cambio de foco por defecto del `pointerdown`, y el `blur`
  disparaba el commit en vacío), así que era imposible escribir texto nuevo;
  editar un texto existente con doble click sí funcionaba y ocultaba el
  problema. Ver `BUGS.md`.
- **Correcciones de una auditoría de errores** (detalladas en `BUGS.md`):
  - Colocar un texto y hacer click para poner otro **ya no descarta el
    primero** ni deja el editor nuevo cerrado.
  - Tras usar un control del panel (trazo, zoom, color, checkbox), los atajos
    y `Ctrl+Z`/`C`/`V` **vuelven a funcionar** sin tener que hacer click en el
    lienzo: el control suelta el foco al terminar de ajustarlo.
  - Con un **modal abierto**, las teclas de herramienta, `Supr` y los atajos
    ya no tocan el lienzo de detrás.
  - Los botones **"Duplicar/Eliminar selección"** vuelven a ocultarse cuando
    no hay selección (una regla CSS los mostraba siempre).
  - En ventanas **≤1100px** el panel derecho ya no desaparece: pasa a ser un
    **cajón deslizable** (botón `⚙ Panel`), así color/trazo/zoom/relleno
    siguen accesibles.
  - Anclar **los dos extremos de una flecha al mismo elemento** ya no la
    colapsa a longitud cero.
  - **Importar JSON** limpia la selección; el **nudge con la tecla mantenida**
    es un único paso de undo; **soltar un archivo fuera del lienzo** ya no
    saca de la app; y el validador de import rechaza los pseudo-tipos
    `arc`/`emoji`.
  - **Gestos de puntero robustos**: `pointercancel` cierra cualquier gesto a
    medias (resize/marquee incluidos), un segundo dedo en táctil se ignora en
    vez de corromper el trazo, y los atajos de teclado se ignoran mientras
    hay un gesto en curso (borrar/deshacer a mitad de un resize ya no corrompe
    el estado).
  - Confirmar una **edición de texto sin cambios** ya no consume un paso de
    undo ni vacía el redo, y **hacer click en el padding de un modal** ya no
    lo cierra (solo el click fuera del cuadro).

### Añadido
- **Pestaña de Ayuda**: nuevo botón `❔ Ayuda` en la barra superior (y tecla
  `?`) que abre un panel con todos los atajos y trucos, agrupados por tema
  (general, selección y portapapeles, formas y relleno, emoji, flechas y
  curvas, semicírculos) y con las teclas resaltadas. Sustituye a la lista
  apretada del pie del panel derecho, que quedaba recortada y era ilegible;
  ahí queda solo un recordatorio de que `?` abre la ayuda.
- **Insertar emoji**: nueva herramienta `🙂 Emoji` (tecla `J`) en el grupo UI.
  Al elegirla se abre un catálogo de 60 emoji agrupados en cinco categorías
  (caras, estado, flechas, objetos y datos); tras escoger uno, cada click en
  el lienzo lo estampa centrado en el punto pulsado. Volver a pulsar la
  herramienta permite cambiar de emoji.
- El emoji se inserta como un elemento **`text` normal** (su `value` es el
  carácter), así que selección, movimiento, redimensionado, duplicado,
  undo, autoguardado y los cinco formatos de exportación funcionan sin
  código específico. También puede editarse con doble click como cualquier
  texto, lo que permite escribir cualquier emoji fuera del catálogo.
- Se inserta al tamaño del texto con un mínimo de 32 px (`EMOJI_MIN_SIZE`)
  para que se lea como icono; el slider "Texto" lo controla por encima de
  ese mínimo.
- 8 tests nuevos (catálogo sin duplicados, atajos de herramienta únicos,
  validación y export SVG/HTML/JSON del emoji): la suite pasa de 144 a 152.

## [1.4.0] — 2026-07-23

### Añadido
- **Rellenar formas con color**: las formas geométricas (rectángulo,
  redondeado y círculo) admiten un color de relleno propio (`fillColor`),
  elegible desde la nueva sección "Relleno" del panel. Hasta ahora el
  relleno solo podía decidirse **antes** de dibujar y siempre era un tinte
  translúcido del color del trazo; ahora se puede rellenar una forma **ya
  creada** seleccionándola y eligiendo el color.
- El relleno se conserva en los cinco formatos de exportación (PNG/JPG vía
  el render, SVG, HTML y JSON) y `fillColor` se valida como hex en el
  import, igual que `color`, por ser un valor que se interpola en los
  exports SVG/HTML.

### Cambiado
- El **zoom llega hasta el 300 %** (antes 200 %). Los límites viven ahora en
  `ZOOM_MIN`/`ZOOM_MAX` en app.js, que acotan `applyZoom` y el auto-ajuste,
  en lugar de estar repetidos a mano.

### Corregido
- **Con zoom > 100 % ya se puede llegar a todo el lienzo.** El desbordamiento
  por la izquierda y por arriba quedaba fuera del área scrollable (un
  `transform: scale` no cambia la caja de layout), así que al 200 % había
  ~960 px inalcanzables y al 300 % más de 2000. Ahora un `.canvas-area__sizer`
  ocupa en layout el tamaño ya escalado y el lienzo se ancla arriba a la
  izquierda, de modo que el scroll cubre el lienzo entero. Ver `BUGS.md`.
- El checkbox **"Rellenar formas"** pasa a tener la semántica dual del resto
  de controles del panel: **con selección** rellena o vacía las formas
  seleccionadas (un único paso de undo); **sin selección** fija el default
  de creación, como antes. Vaciar una forma conserva su color de relleno,
  así que volver a marcarla lo recupera en vez de perderlo.
- Elegir un color de relleno activa el relleno automáticamente (el checkbox
  sigue siendo la forma de quitarlo).
- **Compatibilidad**: una forma sin `fillColor` se sigue pintando con el
  tinte translúcido del trazo, así que los proyectos guardados antes de esta
  versión se ven exactamente igual.
- 9 tests nuevos (render, export SVG/HTML, validación y round-trip JSON del
  relleno con color): la suite pasa de 134 a 144.

## [1.3.0] — 2026-07-23

### Añadido
- **Colores personalizables del lienzo**: nueva sección "Lienzo" en el panel
  derecho con selectores de color para el **fondo** y la **cuadrícula**.
  `Renderer.drawGrid` acepta ahora un color base (antes fijo), con la línea
  menor y la mayor distinguidas por opacidad en vez de por un segundo color
  fijo. Las preferencias se guardan en `localStorage` y sobreviven a recargar
  la página.
- El botón **"Limpiar todo"** devuelve el fondo y la cuadrícula a su color
  original (además de vaciar el lienzo), y borra la preferencia guardada.

### Cambiado
- **Lienzo más grande y aprovechamiento de pantalla**: el padding alrededor
  del lienzo baja de 24 a 12 px, y el zoom se auto-ajusta al cargar la página
  (y al redimensionar la ventana) al mayor valor que quepa en el espacio
  disponible, sin bajar nunca del 100 % — en pantallas estrechas se comporta
  igual que antes (scroll si hace falta) y en pantallas anchas crece solo.
  Tocar el slider de zoom a mano desactiva este auto-ajuste.
- 1 test nuevo (color de cuadrícula personalizado) y el test de `drawGrid`
  actualizado al nuevo esquema de color único + opacidad: la suite pasa de
  133 a 134.

## [1.2.1] — 2026-07-23

### Cambiado
- **Mover la multi-selección en grupo desde cualquier punto de su marco**:
  con varios elementos seleccionados, el arrastre puede empezar también en
  el espacio vacío dentro del recuadro combinado (antes había que acertar
  sobre un trazo y, si no, la selección se perdía). Shift+click conserva el
  toggle, el click fuera del marco sigue deseleccionando/iniciando marquee,
  y el movimiento en grupo sigue siendo un único paso de undo con snap a
  cuadrícula al soltar.

## [1.2.0] — 2026-07-23

### Añadido
- **Copiar y pegar la selección** con `Ctrl/Cmd+C` y `Ctrl/Cmd+V`: funciona
  con uno o varios elementos (Shift+click, marquee o `Ctrl/Cmd+A`), pega con
  desplazamiento de 20 px, activa la herramienta Mover y deja lo pegado
  seleccionado para encadenar pegados o arrastrar.
- El payload viaja por el portapapeles del sistema, así que el pegado
  funciona **entre pestañas** y tras recargar. Al pegar se regeneran ids y
  semillas, y las flechas ancladas se re-vinculan a los clones si su destino
  también se copió (misma lógica que "Duplicar", ahora compartida en
  `insertClones`).
- Lo pegado pasa por el mismo validador que el import JSON; un portapapeles
  manipulado no puede inyectar elementos inválidos.

### Cambiado
- El pegado de imágenes PNG/JPG con `Ctrl/Cmd+V` se mantiene: los elementos
  propios tienen prioridad y, si no los hay, se intenta la imagen. Dentro de
  campos de texto, copiar/pegar siguen siendo los nativos del navegador.

## [1.1.1] — 2026-07-23

### Cambiado
- El proyecto pasa a presentarse como **Pizarra** en el README.
- Se amplía la documentación con instrucciones de clonación y ejecución, un
  flujo básico de uso, detalles del autoguardado y atajos multiplataforma.
- La versión visible en la aplicación y la insignia del README quedan
  sincronizadas en `1.1.1`.

## [1.1.0] — 2026-07-23

### Añadido
- **Herramienta Semicírculo** (`◠`, tecla `G`): dibuja arcos de 180° exactos
  y sin puntas de flecha. El arrastre fija el diámetro, así que cada trazo
  puede tener un radio distinto.
- Ajuste de **radio** de un semicírculo seleccionado con `+`/`−` (paso de
  5 px; `Shift`: 1 px) o arrastrando su handle turquesa — siempre conservando
  la media circunferencia perfecta (el centro del diámetro no se mueve).
- Tecla **`Q`**: convierte una flecha curva seleccionada en semicírculo
  (pierde la punta) y viceversa (la recupera).
- `js/arc.js` (`ArcMath`): geometría pura de arcos circulares — ajusta una
  Bézier cúbica al arco (error radial ≤ 1,7 % del radio, invisible bajo el
  trazo sketchy). Los semicírculos son elementos `curveArrow` normales con
  `arc: true`, por lo que exportación (PNG/JPG/SVG/HTML/JSON), selección,
  undo y conectores funcionan sin código específico.
- `heads: 'none'` en flechas: trazo sin punta en ningún extremo (usado por
  los semicírculos y validado en el import JSON).
- 10 tests nuevos (geometría de arcos, validación y export sin puntas):
  la suite pasa de 123 a 133.

### Cambiado
- La punta de las flechas curvas al desactivar un semicírculo con `Q` se
  restaura al valor por defecto (una punta).
- El checkbox "Doble punta" ignora los semicírculos (nunca llevan punta).

## [1.0.0] — 2026-07-22

Estado inicial versionado: dibujo sketchy determinista, componentes UI,
flechas curvas (cuadráticas y en S) con conectores anclados, etiquetas sobre
el trazo, plantillas, undo/redo, autoguardado, exportación PNG/JPG/SVG/HTML/
JSON con import validado y suite de 123 tests sin dependencias.
