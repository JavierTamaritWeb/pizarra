# Changelog

Los cambios notables de Pizarra se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

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
