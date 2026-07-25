# Changelog

Los cambios notables de Pizarra se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

## [1.15.0] — 2026-07-25

### Añadido
- **Sección «Jardín»** en el sidebar, después de Edificios: cinco herramientas
  que dibujan **en vista de planta** (cenital, como un plano de paisajismo).
  Como las de Edificios, son **solo de creación** —producen `rect`/`line`/
  `circle`/`curveArrow`/`text` corrientes, ningún tipo de elemento nuevo—, así
  que render, exportación, undo, JSON y bounds funcionan sin código específico.
  - **Jardín** (`8`): parcela rectangular, redonda, en L u orgánica, con
    textura de césped en trazo fino.
  - **Árbol** (`9`): frondoso, conífera, palmera, olivo, frutal y ciprés.
  - **Arbusto** (`H`): mata redonda, seto, macizo y topiario.
  - **Flor** (`X`): margarita, rosa, tulipán, parterre y girasol.
  - **Decoración** (`Z`): maceta, pozo, regadera, piedra, banco, fuente,
    estanque y camino.
- **Etiqueta de texto** en cada pieza con el nombre de su tipo, dentro del mismo
  grupo (se mueve, duplica y borra con ella). Se apaga con la casilla
  «Etiquetas» de la sección **Jardín** del panel, y la elección se recuerda.
- Los **iconos de los catálogos son el dibujo real**: los pinta la propia
  geometría de `js/garden.js` sobre un `<canvas>`, con el mismo par
  (`Garden.elements` + el pintor de previsualización) que usa el arrastre. No
  pueden desincronizarse de lo que crea la herramienta.
- Cada pieza nace con el **tamaño propio de su tipo**: un seto y un camino
  salen alargados, una flor suelta menuda.

### Corregido
- **La previsualización del arrastre no dibujaba las curvas encadenadas.**
  `drawBuildingPreview` leía `cx`/`cy` de nivel superior, que una curva
  encadenada no tiene, y `quadraticCurveTo(undefined, …)` no hace nada ni avisa.
  Ninguna herramienta de Edificios las emite, así que nunca se había visto; las
  siluetas orgánicas del jardín sí. Ahora recorre `CurvePath.segments`, dibuja
  también los elementos `text` —delegando en el renderer de verdad, para no
  tener una segunda copia de la fuente y el interlineado— y se llama
  `drawPiecesPreview`, que es lo que hace.
- `pickVariant` (arnés de tests) resolvía mal el id del modal, así que elegir
  una variante desde un test no hacía nada. No lo usaba ningún test todavía.

### Corregido tras probarlo en el navegador
Tres cosas que **pasaban todos los tests** y solo se ven usando la aplicación:
- **«Frondoso» y «Olivo» se dibujaban igual.** Cada variante se comprobaba por
  separado y ninguna prueba comparaba una con sus hermanas. El olivo motea
  ahora el follaje en vez de marcar ramas, y un test nuevo compara la firma de
  todas las variantes de un mismo catálogo.
- **El césped se leía como flechas «↓».** Tres briznas que salen del mismo
  punto con la central más larga forman una punta de flecha. Ahora cada brizna
  arranca de su sitio, y el número de matas se deduce del área (una parcela
  grande salía con cuatro matas en fila).
- **El arbusto «Macizo» salía como un rombo.** Su tabla de lóbulos alternaba
  radio alto y bajo en ocho puntos: eso es simetría de orden 4.

### Notas
- Los atajos del jardín son `8 9 H X Z`, las cinco teclas sueltas que quedaban
  libres. Un test nuevo impide que una herramienta reutilice `F`, `Q`, `D` o `S`:
  esas ya actúan sobre las flechas curvas y se comprueban antes, así que la
  colisión sería intermitente y muda.

## [1.14.1] — 2026-07-25

Ajustes salidos de probar la aplicación en un navegador real.

### Corregido
- **Pulsar `1` para abrir Fachada cambiaba «Plantas» a 1.** El atajo de
  herramienta no cancelaba la tecla, así que seguía viva y la recibía el primer
  control que el diálogo enfoca: el `<select>` de Plantas la interpretaba como
  su type-ahead. Ahora el atajo hace `preventDefault` y el foco va al botón de
  la vista activa —que además es la acción principal: Enter la confirma— en vez
  de a un campo del formulario.
- **El borrador se llevaba figuras enteras al barrer por su hueco.** Usaba la
  caja del elemento, así que una sola pasada por el centro de una fachada
  borraba el muro completo. Ahora **se borra lo que se ve**: en formas sin
  relleno solo cuenta su contorno (el rectángulo vacío se borra por el borde, no
  por el hueco; el círculo por el aro, no por la esquina de su caja). Si la
  forma está rellena, el interior también es tinta y sigue contando; el texto,
  las imágenes y los componentes de UI se borran por su caja, porque ahí la caja
  sí es el dibujo.

## [1.14.0] — 2026-07-25

### Cambiado
- **El borrador elimina de verdad.** Hasta ahora no borraba: añadía al lienzo una
  *máscara* que tapaba lo que había debajo. Como la máscara se queda fija en su
  sitio, al mover el dibujo lo "borrado" salía de debajo y **reaparecía**; además
  seguía viajando dentro del JSON exportado. Ahora la pasada quita los elementos
  que toca y no deja nada en la escena. El criterio de alcance es el mismo del
  clic de selección ampliado por el radio: **si un clic ahí seleccionaría el
  elemento, el borrador ahí lo elimina**. Los elementos desaparecen ya mientras
  barres, así que lo que ves durante el gesto es el resultado; cada pasada sigue
  siendo un único paso de deshacer, y una que no toca nada no ensucia el
  historial.
- **Compatibilidad:** los proyectos guardados antes de esta versión conservan sus
  máscaras y se ven exactamente igual — se siguen renderizando y exportando como
  siempre, y el borrador nuevo no las retira (quitarlas haría reaparecer justo lo
  que ocultan). Lo que cambia es que la herramienta ya no crea ninguna.

### Interno
- Nuevo `js/eraser.js` (`Eraser`): geometría pura de "qué toca el trazo", con
  distancia segmento-segmento y detección de cruce. Recibe por inyección lo que
  vive fuera (bounds, muestreo de curvas, vértices de polígonos y trapecios), así
  que es testeable sin DOM. Suite de **253 → 273** pruebas.

## [1.13.1] — 2026-07-25

### Corregido
- **Lo dibujado sobre un edificio quedaba inalcanzable.** Con un edificio
  seleccionado, su marco combinado cubre todo su interior y se tragaba cualquier
  clic dentro: la puerta o la ventana que pusieras encima no se podían
  seleccionar, **arrastrarlas movía el edificio entero** dejándolas quietas, y
  **Supr borraba el edificio** en lugar del elemento pulsado (por lo que lo que
  creías haber borrado seguía apareciendo). Ahora, si el punto cae sobre un
  elemento ajeno a la selección, gana ese elemento; arrastrar el grupo desde un
  hueco de su marco y **Alt+clic** para aislar una pieza siguen funcionando.
- **El tipo de puerta y de ventana no se podía elegir al crear una fachada.**
  La fachada ya los respetaba, pero solo se fijaban desde las herramientas
  Puerta y Ventana, que cambian de herramienta y sacan del flujo. El modal de
  Fachada incorpora ahora ambos selectores, junto a la miniatura, que se repinta
  al cambiarlos. El de puerta se atenúa en la vista *De lado*, que no lleva.

### Interno
- **`js/app.js` pasa a ser testeable.** Nuevo arnés (`tests/helpers/dom-stub.js`
  + `load-app.js`) que construye el DOM desde el `index.html` real y ejecuta la
  app entera bajo `node:vm`; los tests lanzan gestos de verdad (pointer, teclado,
  clics de modal) y leen el resultado del autosave, sin ningún hook de test en
  producción. Cierra el hueco que `PLAN.md §6` daba por inevitable. Suite de
  **245 → 253** pruebas, con `tests/app-interaction.test.js` cubriendo los dos
  fallos anteriores y la sincronización panel ↔ modal.

## [1.13.0] — 2026-07-25

### Añadido
- **Miniatura en vivo en el modal de Fachada**: se repinta con cada ajuste, así
  que ya no hay que dibujar-deshacer-repetir para ver el efecto. No es un dibujo
  aparte: usa la misma geometría que la previsualización del arrastre, de modo
  que no puede divergir de lo que se acaba dibujando.
- **Los ajustes de Edificios, junto a la elección de vista**: plantas, ventanas
  por planta, pendiente y cubierta están ahora también **dentro** del modal de
  Fachada, sincronizados en ambos sentidos con el panel lateral (que sigue
  existiendo). Antes vivían solo en el panel, que en pantallas ≤1100 px es un
  cajón oculto.
- **Previsualización al pasar el puntero**: señalar una vista la muestra en la
  miniatura sin elegirla; al salir vuelve la seleccionada.
- Los ajustes que la vista elegida **ignora se atenúan** (la fachada plana no
  tiene cubierta ni pendiente; el perfil lleva siempre la suya trapezoidal).

### Cambiado
- Las tres vistas de Fachada pasan a **lenguaje llano** —*De frente*, *Con
  tejado*, *De lado*— con el término de arquitecto (*Fachada plana*, *Alzado*,
  *Perfil*) como subtítulo: quien no es arquitecto no sabía cuál elegir.
- **Todas** las variantes de Edificios se recuerdan entre sesiones. Antes solo
  persistían plantas, vanos, pendiente y cubierta: la huella de Planta, la vista
  de Fachada, la forma de Tejado y el tipo de Puerta y Ventana se reseteaban al
  recargar, así que media configuración sobrevivía y media no.

### Corregido
- El botón **«Alzado (2 aguas)» dibujaba otra cubierta**: la forma real la fija
  `roofType`, así que con *Cuatro aguas* o *Mansarda* la etiqueta mentía. El
  nombre ya no promete una forma y el icono dibuja el faldón realmente activo.
- La vista de **Perfil dibujaba la puerta principal centrada**, repitiendo los
  huecos de la fachada frontal. Un canto lateral no tiene el acceso principal:
  ahora va sin puerta y con las plantas acompasadas.

### Interno
- `buildOpts()` centraliza los opts de `Building.elements` para sus tres
  consumidores (preview del arrastre, commit y miniatura), que antes los
  duplicaban; `syncBuildControls()` es el único punto que reparte el estado a
  los dos juegos de controles. Suite de **241 → 245** pruebas, con guardias
  nuevas para el perfil sin puerta, los textos del catálogo y la coherencia
  entre los controles gemelos del panel y el modal.

## [1.12.0] — 2026-07-24

### Añadido
- **Fachadas ricas**: Fachada, Alzado y Perfil dibujan sus huecos con el **tipo de
  Puerta y Ventana elegido** en los modales (antes siempre usaban los básicos).
  Elige *Óculo* o *Ventana de arco* y la fachada los coloca; igual con la puerta
  (arco, doble, paneles, garaje).
- **Panel de opciones de Edificios**: controla el **nº de plantas**, las
  **ventanas por planta**, la **pendiente** y la **cubierta del alzado** en vez de
  deducirlo solo del arrastre. Son defaults de creación y se recuerdan entre
  sesiones.
- **Sidebar de Edificios más compacto**: **Fachada/Alzado/Perfil** se unifican en
  un botón **Fachada** (modal con 3 vistas: plana, alzado frontal, perfil lateral)
  y los **tejados** en un botón **Tejado** (modal), igual que Puerta/Ventana — de
  9 botones a 5. Dos tejados nuevos: **cuatro aguas** y **mansarda**, disponibles
  también como cubierta del Alzado.
- **Agrupación de edificios**: cada edificio se crea como una **unidad** — un clic
  lo selecciona entero y se mueve, duplica o borra de una vez; **Alt+clic** aísla
  una pieza. El clon de un edificio es un grupo independiente.

### Corregido
- La **previsualización del óculo** no mostraba el círculo al arrastrar; ahora sí,
  y la preview respeta el trazo fino del detalle.
- **Cancelar** (Cerrar/Escape/clic-exterior) un modal de Planta/Puerta/Ventana sin
  elegir variante **restaura la herramienta anterior** (antes quedaba "a medias").
- Los **modales** ya no desbordan en pantallas estrechas (~320 px) y hacen scroll.
- El icono de **Perfil** se distingue del de Alzado; la **cornisa** deja de
  solaparse con el tejado en Alzado/Perfil.

### Interno
- Unificado el arco de puerta/ventana (`_arched`) y extraído el alféizar (`_sill`)
  en `js/building.js`; nuevo campo `buildingGroupId` validado en `isValidElement`
  y preservado en el round-trip JSON. Suite de **231 → 241** pruebas.

## [1.11.0] — 2026-07-24

### Añadido
- Más **tipos de puerta** en el modal (de 4 a **8**): además de *Puerta*,
  *Puerta de arco*, *Marco* y *Marco de arco*, ahora **Puerta doble** (dos hojas
  con montante central y tiradores), **Puerta de paneles** (dos paneles
  rehundidos), **Puerta de garaje** (lamas horizontales) y **Marco doble**
  (marco con montante central, sin hoja).
- Más **tipos de ventana** en el modal (de 4 a **8**): además de *Ventana*,
  *Ventana de arco*, *Marco* y *Marco de arco*, ahora **Ventana de 2 hojas**
  (montante central + travesaño), **Ventana cuadrícula** (parteluces adaptativos),
  **Óculo** (ventana redonda con cruz) y **Marco redondo** (solo el aro).
- Todos son herramientas SOLO de creación: reutilizan tipos ya existentes
  (`rect`/`line`/`circle`/`curveArrow`), por lo que render, exportación
  (PNG/JPG/SVG/HTML), undo y JSON siguen funcionando sin código específico.
  El óculo usa el tipo `circle`; el detalle (paneles, lamas, parteluces) va a
  trazo fino (`_lineT`/`_rectT`).

### Interno
- Iconos SVG nuevos en `doorIcon`/`windowIcon` (app.js) para las tarjetas del
  modal, construidos con `createElementNS` (nunca `innerHTML`).
- La guardia de regresión `tests/building.test.js` gana 6 pruebas de geometría
  para los tipos nuevos y sus bucles de render recorren `DOOR_TYPES`/`WINDOW_TYPES`
  automáticamente: la suite pasa de 225 a **231** pruebas.

## [1.10.0] — 2026-07-24

### Añadido
- Nueva sección de barra lateral **Edificios** para bocetar el exterior de un
  edificio: **Planta** (`w`) con selector de huella en modal (rectangular, en L,
  en U con jardín, claustro); **Fachada** (`1`), **Alzado** (`x`) y **Perfil**
  (`h`) son fachadas multiplanta con **ventanas por planta y puerta en la baja**
  (el número de plantas se deduce de la altura del arrastre); y tejados a
  **dos aguas** (`2`), a **un agua** (`8`) y **plano** (`9`).
  Son herramientas SOLO de creación —como Semicírculo y Emoji—: producen
  elementos de tipos ya existentes (`line`, `rect`), sin introducir ningún tipo
  nuevo, por lo que render, selección, exportación (PNG/JPG/SVG/HTML), undo y
  JSON funcionan sin código específico.
- Fachadas con **ventanas verticales** (montante en cruz + alféizar) y **puerta**
  con dintel en la planta baja, **cornisa** e impostas; **Alzado** con cubierta a
  dos aguas (alero volado, tejas, cumbrera y chimenea) y **Perfil** con cubierta
  trapezoidal de cumbrera horizontal (silueta distinta); **tejas** en todos los
  tejados. Diseño basado en un estudio de alzado (plano de arquitecto); el detalle
  se dibuja a trazo fino y el contorno al trazo del usuario.
- Botón **Puerta** (`0`) con **modal de tipo** (como el de Planta): *Puerta*
  (dintel de abanico + junta), *Puerta de arco* (**arco de medio punto** —un
  `curveArrow` de arco que comba hacia arriba— con **altura ajustable** por el
  arrastre), *Marco* (rectangular) y *Marco de arco* (arco + jambas + umbral,
  sin imposta ni hoja).
- Botón **Ventana** (`y`) con **modal de tipo** análogo: *Ventana* (montante en
  cruz + alféizar), *Ventana de arco* (arco de medio punto), *Marco* (rectangular)
  y *Marco de arco* (arco + jambas, sin partición).
- Módulo `js/building.js` (global `Building`) con la geometría pura y su guardia
  de regresión `tests/building.test.js` (19 pruebas).

### Interno
- `CREATION_ONLY_TOOLS` (exporter.js) excluye las herramientas de Edificios de
  `ELEMENT_TYPES`, evitando elementos fantasma al importar un JSON manipulado.
- El comando de test documentado pasa a `node --test tests/*.test.js`: la forma
  con directorio (`node --test tests/`) omite un archivo bajo el glob de Node 22.x.

## [1.9.0] — 2026-07-24

### Añadido
- Botones **Cuadrado** (`4`) y **Trapecio** (`7`) en la barra de Formas.
  El cuadrado se crea regular desde el centro; el trapecio isósceles se crea
  por esquinas y admite proporciones libres.
- Rotación discreta de 45° para cuadrados y de 90° para trapecios, siempre
  alrededor del centro de la forma.
- Ambas formas admiten selección por su silueta real, redimensionado,
  relleno sólido o translúcido, bordes ocultos y exportación completa a PNG,
  JPG, SVG, HTML y JSON.
- 9 pruebas de configuración, geometría, rotación, renderizado,
  solapamiento, validación y exportación: la suite pasa de 197 a 206 pruebas.

## [1.8.1] — 2026-07-24

### Añadido
- **Tamaño del borrador independiente**, regulable de 4 a 100 px y con
  16 px por defecto. Al activar el Borrador, el control de Trazo cambia de
  nombre, rango y valor sin modificar el grosor del lápiz o de las formas.
- Indicador circular sobre el lienzo que representa el área exacta del
  borrador antes y durante cada pasada.
- La preferencia del tamaño se conserva entre sesiones. Los proyectos
  anteriores, que solo almacenaban `lineWidth`, mantienen su aspecto
  histórico usando automáticamente cuatro veces ese grosor.

### Corregido
- El **Borrador** ya no perfora el color de fondo ni la cuadrícula: elimina
  únicamente los elementos dibujados, por lo que deja de verse como una
  mancha oscura o transparente. App y exportación raster comparten ahora el
  mismo orden de composición, y el resultado se muestra en tiempo real
  mientras se arrastra en vez de utilizar un trazo rojo provisional.
- SVG y HTML aplican los borrados con máscaras vectoriales secuenciales:
  dejan de simularlos con una línea blanca y respetan fondos, tamaños y
  elementos creados después de cada pasada.
- Los recursos CSS y JavaScript incluyen la versión en su URL para impedir
  que el navegador reutilice archivos antiguos tras actualizar.
- 5 guardias nuevas o ampliadas de render, tamaño, importación, caché,
  solapamiento y exportación: la suite pasa de 192 a 197 pruebas.

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
