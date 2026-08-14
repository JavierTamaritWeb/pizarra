# Changelog

Los cambios notables de Pizarra se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

## [2.25.2] — 2026-08-14

### Corregido

Con una figura 3D **ya dibujada** no se podía cambiar el color de las aristas ni
el de los lados, aunque sí la posición y el tamaño. Eran dos fallos distintos:

- **Pulsar la herramienta 3D con un sólido seleccionado lo deseleccionaba**, así
  que su modal pasaba a configurar el sólido *siguiente*: el color y el grosor no
  llegaban nunca a la figura que se tenía delante. Ahora la selección sobrevive,
  como ya ocurría al pulsar la herramienta de una forma plana seleccionada.
- **Un sólido dibujado en hueco no tiene caras**, porque las caras laterales son
  elementos y sólo se emiten al crear la figura. Marcar «Rellenar las caras»
  después sólo pintaba la cara frontal, de modo que *el color de los lados* no
  tenía a qué aplicarse. Ahora rellenar **vuelve a crear la figura** con sus
  caras, en su sitio y a su tamaño, en un solo paso de deshacer — el mismo
  recurso con el que el Jardín cambia de especie sin recolocar la planta.
- Y de paso: los mandos del modal 3D leían el valor de **un** elemento, y un
  sólido son siempre varias piezas, así que caían a los valores de fábrica. Como
  eso corre en cada repintado, la casilla de relleno se **desmarcaba sola** justo
  después de marcarla. Ahora enseñan el valor común de la figura.

Los ajustes de proyección (profundidad, ángulo, escorzo y tapa) y el giro de la
sección también vuelven a crear el sólido seleccionado, al soltar el deslizador.

## [2.25.1] — 2026-08-14

### Corregido

Repaso de la documentación y de la **Ayuda** de la app. Tres cosas que decía la
Ayuda ya no eran verdad, y ninguna tenía que ver con las figuras 3D:

- El **borrador** decía que el ⚙ de la cabecera «Trazo» del panel reabre su
  modal. Esa sección se quedó **sin ⚙** en la v2.21.0: lo reabre volver a pulsar
  la herramienta.
- El **emoji** decía que su tamaño lo fija el deslizador «Texto». Tiene el suyo
  propio, en su catálogo y de 32 a 96 px, desde la v2.10.0: agrandar un emoji no
  encoge el texto siguiente.
- El **jardín** hablaba de 40 especies vegetales. Son **49**.

### Añadido

- Las **figuras 3D** tienen ahora su propia sección en la Ayuda, en vez de dos
  líneas sueltas en «General», y `Shift+R` documenta que una figura compuesta
  gira entera.
- La **captura del README** está regenerada con la versión actual: enseña el
  grupo 3D, las estrellas y tres sólidos rellenos en el lienzo. Estaba en la
  v2.22.1, anterior a las dos.
- `CLAUDE.md`: el orden de carga de los scripts incluía todos menos `solid`, y la
  guía de **«añadir un tipo de elemento»** se ha completado con los tres pasos
  que omitía y que hoy no son opcionales —`VECTOR_TYPES` y la rama de
  `isValidElement` en el exportador, y `OUTLINE_TYPES`/`eraserDeps` para que el
  borrador no funcione por caja—, todos aprendidos al añadir el polígono libre.

## [2.25.0] — 2026-08-14

### Añadido

- **Las figuras 3D se giran.** Antes de dibujar, cada modal 3D lleva un mando de
  **giro de la sección** en los pasos válidos de su tipo (36° el pentágono, 30°
  el hexágono, 90° el trapecio), así que un prisma hexagonal ya puede salir de
  cara plana y no sólo en punta. La fila no aparece con el rectángulo, el
  redondeado y el círculo: ahí girar es intercambiar ancho y alto, que ya lo da
  el arrastre.
- **Y se giran ya dibujadas**: con una figura compuesta seleccionada —un sólido,
  un edificio, un árbol—, `Shift+R` y `←`/`→` la giran **entera** un cuarto de
  vuelta alrededor de su centro. Antes ahí no pasaba nada útil: las formas
  giraban cada una por su lado y las líneas se quedaban quietas.
- **Grosor y color de las aristas dentro del propio modal**, con la paleta
  completa y el selector libre, sin tener que ir al panel.
- **Las caras se rellenan, opacas o translúcidas**, con su color y su opacidad.
  En opaco la figura se lee maciza y las aristas de detrás quedan tapadas; en
  translúcido se ve a través, como un cristal, y las ocultas se siguen leyendo.
  Sólo se pintan las caras que se ven.
- Tipo de elemento **polígono libre** (`polygon`), sin botón en el sidebar —como
  la imagen pegada—: es lo que representa una cara lateral, un cuadrilátero
  arbitrario que ningún otro tipo sabía dibujar. Se selecciona, mueve, escala,
  borra por su silueta y viaja en las cinco exportaciones.

### Corregido

- **El ecuador de la esfera se dibujaba entero discontinuo.** Va por dentro del
  círculo, así que el recorte de líneas ocultas lo daba por tapado. Se notaba
  poco sin relleno y, al rellenar, dejaba un círculo plano sin ecuador ninguno.

## [2.24.0] — 2026-08-14

### Añadido

- **Grupo «3D» en el sidebar, detrás de Formas**, con cuatro herramientas —
  **Prisma**, **Pirámide**, **Tronco** y **Esfera**— que dibujan en volumen las
  mismas diez siluetas del grupo de arriba: 31 figuras en total (caja, cubo,
  cilindro, prisma pentagonal, pirámide, cono, tetraedro, tronco de cono,
  esfera, prismas estrellados…).
- **Lo que arrastras es la cara frontal, y sale sin deformar.** La proyección
  es caballera: el volumen se va hacia el fondo en diagonal y la cara que
  dibujas conserva su forma, que es lo único que deja reconocibles a la
  estrella y al trapecio. Las **aristas que quedan detrás salen discontinuas**,
  como en un croquis técnico.
- **Ángulo de fuga, escorzo y profundidad regulables** en el modal de cada
  herramienta, con miniatura en vivo. La profundidad va en **porcentaje de la
  cara**, no en píxeles, así que una figura pequeña y otra grande salen con las
  mismas proporciones sin tocar nada. El ángulo da la vuelta completa: el
  volumen puede irse hacia cualquiera de los cuatro lados. El Tronco añade el
  tamaño de su tapa.
- El botón elige el **remate** y su catálogo la **sección**, con los diez
  iconos pintados con la geometría real, así que no pueden mentir sobre lo que
  van a crear. La sección elegida se comparte entre las tres herramientas de
  extrusión, y todos los ajustes se recuerdan entre sesiones.
- Cada sólido nace como un **grupo**: se selecciona, mueve, escala, duplica y
  borra como una unidad, con un solo paso de deshacer, y `Alt`+clic sigue
  aislando una pieza.
- **Sin atajos de teclado**, como las estrellas o el Aerógrafo: las 26 letras y
  los 10 dígitos ya estaban asignados.

### Corregido

- La previsualización del arrastre **ya respeta el trazo discontinuo de cada
  pieza** en vez de heredar el del lienzo. Se notaba con las herramientas
  compuestas: con «Discontinuo» marcado, la previsualización de un árbol del
  jardín salía punteada aunque el resultado fuese sólido.

## [2.23.0] — 2026-08-14

### Añadido

- **Estrella de 5 puntas y estrella de 6 puntas**, en el grupo «Formas» detrás
  del hexágono. Son las regulares clásicas —el pentagrama y la Estrella de
  David—, no una estrella cualquiera: el radio interior es aquel en el que
  prolongar el lado de una punta lleva exactamente a otra punta, así que la
  silueta son rectas completas y no una flor de pétalos rectos.
- Como el resto de polígonos regulares, **se arrastran desde el centro**,
  conservan la caja cuadrada y admiten relleno sólido o translúcido, el modo
  «Bordes ocultos», el giro por pasos (36° la de 5 puntas, 30° la de 6) y las
  cinco exportaciones. El borrador y la selección respetan su **silueta real**:
  el hueco entre dos puntas no cuenta como parte del dibujo.
- **Sin atajo de teclado**, como Balcón, «Select» o el Aerógrafo: las 26 letras
  y los 10 dígitos ya estaban asignados. Se eligen en el sidebar.
- **`←` y `→` giran la forma seleccionada**, una orientación válida por
  pulsación y en el sentido de la flecha, cuando toda la selección guarda su
  orientación como ángulo: polígonos regulares, estrellas y trapecio. Es lo que
  se quiere hacer con una de estas formas nada más dibujarla, y hasta ahora el
  único camino era `Shift+R`, que gira en un solo sentido.

### Cambiado

- En esas formas, `←`/`→` dejan de mover 1 px —`↑`/`↓` sí siguen, igual que el
  ratón y los campos X/Y del panel—. Con cualquier otra cosa en la selección
  (un rectángulo, un texto) las cuatro flechas mueven como siempre.

## [2.22.1] — 2026-08-14

### Corregido

- **«Limpiar todo» no dejaba la app como recién abierta.** Sobrevivían al
  borrado dieciséis ajustes: el color, el grosor, el tamaño de letra, el
  relleno entero, el trazo discontinuo, la doble punta, la cuadrícula, «Ajustar
  a cuadrícula», «Los clics acumulan selección», la letra del lienzo y los tres
  del estilo de texto. Y en los que se persisten era peor, porque el siguiente
  guardado los reescribía y volvían tras recargar. Ahora todos salen de una
  fuente única (`appDefaults()`), la misma que usa el estado inicial, así que un
  ajuste nuevo se resetea solo por existir.
- El **tamaño del borrador** volvía a su valor en el estado pero su deslizador
  seguía enseñando el anterior: estrena punto de sincronía propio.

### Cambiado

- Al limpiar, la herramienta vuelve al **Lápiz** —en silencio, sin abrir sus
  ajustes encima del lienzo recién vaciado— y el relleno queda en **negro
  translúcido**, que es también con lo que arranca la app.

## [2.22.0] — 2026-08-14

### Añadido

- **Aerógrafo**, en el grupo «Dibujo» junto al Lápiz: la primera herramienta que
  aplica **tono** en vez de trazo. Pulveriza una nube de gotas a lo largo del
  recorrido del ratón —densa en el eje y difuminada hacia los bordes, con las
  puntas redondas— y un clic sin arrastrar deja un soplo redondo. Sirve para
  sombrear una fachada, ensuciar un fondo o marcar una zona con una veladura,
  que es lo único que no se podía hacer con cinco herramientas de línea.
- **Su modal de ajustes** (`#modal-airbrush`), que se abre al elegir la
  herramienta como el del Borrador y los de Dibujo: color, **anchura** de la
  boquilla, **grano**, **densidad** y **opacidad**, con una muestra en vivo que
  se cruza a sí misma para que se vea cómo se acumula la pintura translúcida.
  Al 100 % la pintura es sólida; por debajo es translúcida y **las pasadas se
  acumulan**: dos trazos cruzados oscurecen el cruce.
- **Pintar solo dentro de un área.** En «Dónde pinta» se elige entre todo el
  lienzo o un rectángulo: el modal se cierra, se marca el área arrastrando y a
  partir de ahí la pintura se corta en su borde, con el marco visible en
  discontinuo. El área se recuerda entre sesiones y se puede volver a marcar o
  quitar desde el mismo modal.
- **La paleta de 36 colores dentro de sus ajustes**, además del selector libre:
  es el mando que más se usa y tenerlo ahí evita cerrar el modal para ir a
  buscarlo al panel. Son las mismas muestras, así que el color activo se
  resalta en las dos rejillas a la vez.
- **El puntero es el círculo de la boquilla**, como en el Borrador: sustituye a
  la cruz del sistema y rodea **exactamente** la superficie que se va a pintar
  —las gotas se recortan para que la tinta acabe justo en esa línea—, así que a
  mayor anchura, mayor círculo y mayor superficie pintada.
- **`src/js/airbrush.js`**, módulo puro con la geometría de la nube. El elemento
  guarda el **eje** del trazo y cuatro parámetros, nunca las gotas: se regeneran
  de forma determinista desde el `seed`, así que el JSON no engorda y el lienzo,
  el PNG, el JPG, el SVG y el HTML dibujan exactamente lo mismo.

### Cambiado

- **El borrador se lleva la mancha entera al rozar su banda**, midiendo contra el
  eje ensanchado por la boquilla y no contra su caja: pasar por una esquina
  vacía del rectángulo que la contiene ya no la borra.
- Redimensionar una mancha **conserva la proporción**, como los polígonos
  regulares y los grupos, y **escala su boquilla**: es un solo escalar y no
  existe la boquilla elíptica.

## [2.21.0] — 2026-08-13

### Añadido

- **Cada sección del panel con ajustes propios lleva su ⚙**: «Posición y
  tamaño», «Relleno», «Texto» y «Elementos» estrenan el suyo, junto a los que
  ya tenían «Edificios» y «Jardín». Cada uno abre siempre los ajustes de **su**
  sección, sin cambiar de herramienta ni soltar la selección.
- El ⚙ de **«Posición y tamaño»** abre los ajustes del **tipo seleccionado**,
  no los de la herramienta activa: con un botón seleccionado y Mover puesto
  abre los del componente. Con tipos que discrepan no hay unos ajustes que
  sirvan para todos, así que desaparece en vez de abrir los del primero.
- El ⚙ de **«Elementos»** abre «Los clics acumulan selección» con **cualquier**
  herramienta puesta, no solo con las dos de Edición.

### Cambiado

### Cambiado

- La sección del panel se titula **«Color»** en vez de «Trazo», y el selector
  personalizado se rotula **«Color»** en lugar de mostrar el código hex
  (`#1a1a2e`) — como «Fondo» y «Cuadrícula» en «Lienzo». Sin el grosor, esa
  sección es la del color; y el hex decía el valor, no para qué sirve el mando.

### Eliminado

- **El deslizador del grosor del panel** (y su rótulo «Trazo: 2px»). Era un
  mando que cambiaba de significado según la herramienta: con el Borrador
  gobernaba **su** tamaño, se retitulaba «Tamaño del borrador» y cambiaba de
  rango. El grosor vive ahora donde se elige la herramienta, en los cinco
  modales de ajustes, cuatro de los cuales ya lo tenían como gemelo; **el de
  Texto lo estrena** para que un texto seleccionado no se quede sin sitio
  desde el que cambiar su trazo. La sección «Trazo» del panel conserva la
  paleta de color y las casillas de discontinuo y doble punta.
- **El ⚙ de la cabecera «Trazo».** Era uno solo que se re-apuntaba a cinco
  modales distintos según la herramienta activa, y aparecía y desaparecía con
  una condición de seis ramas: el mismo botón, en el mismo sitio, abría cinco
  diálogos distintos y no había forma de saber cuál sin pulsarlo. Sus destinos
  se alcanzan por donde toca: **pulsando la herramienta** en la barra lateral
  —que además funciona con el panel cerrado o convertido en cajón— y, con algo
  seleccionado, desde el ⚙ de «Posición y tamaño». «Trazo» y «Lienzo» son
  ahora las dos únicas secciones sin ⚙, cada una por su motivo.

### Cambiado

- Los ⚙ de «Edificios» y «Jardín» siguen pasando por `selectTool`, que es donde
  se reconstruye un catálogo; los cuatro nuevos abren su modal directamente.
- Las muestras de `#modal-stroke` y `#modal-shape` leen el tipo de lo
  seleccionado antes que el de la herramienta. Ahora que esos modales se abren
  con cualquier herramienta puesta, un pentágono seleccionado se
  previsualizaba como rectángulo y una flecha, como línea sin punta.

## [2.20.0] — 2026-08-11

### Cambiado

- **El lienzo nace como un plano de obra**: papel de pizarra azulada
  (`#686f92`) con la cuadrícula casi blanca encima (`#fcfcfc`). Antes era
  blanco con la rejilla gris.
- **Lo que se exporta —y por tanto lo que se imprime— sigue saliendo sobre
  blanco limpio y sin cuadrícula**, en los cinco formatos. El color del papel
  y la rejilla son ajustes de pantalla y no viajan a ningún archivo. Ya se
  comportaba así, pero mientras el fondo por defecto era blanco daba lo mismo;
  ahora es una promesa que se puede romper, y hay una guarda que lo comprueba
  exportando una escena vacía y colándole a propósito el color del lienzo.
- El detector de tinta de la suite e2e mide contra el papel en vez de contra
  un umbral fijo de luminancia. Con el papel oscuro, el lienzo **vacío** ya
  contaba 779 401 píxeles de «dibujo»: había dejado de medir lo que su nombre
  promete.
- **Las dos capturas del README están regeneradas.** La principal era de la
  **v1.16.1** —catorce versiones atrás—: enseñaba una paleta de 18 colores, un
  panel con los 28 controles siempre a la vista, ningún grupo «Edición» y los
  componentes rotulados en inglés. La del jardín llevaba nombres de especie
  anteriores al catálogo botánico de la v2.7.0.

### Corregido

- **La ayuda de la app mandaba al panel a buscar «Los clics acumulan
  selección»**, que dejó el panel en la v2.17.0. Ahora nombra las dos
  herramientas que la abren, Mover y «Select». El README decía lo mismo.

## [2.19.0] — 2026-08-11

### Añadido

- **Doce colores pastel** en la paleta del panel: coral, melocotón, ámbar,
  amarillo, lima, verde, turquesa, celeste, azul, añil, lila y rosa. Cubren el
  arco iris entero en tonos claros, que es justo lo que faltaba para sombrear
  y rellenar sin que el dibujo compitiera con el trazo.
- **Seis vivos nuevos** que tapan los huecos del arco iris anterior: calabaza,
  zanahoria, lima, añil, amatista y magenta.

### Cambiado

- **La paleta se ordena por tono del arco iris.** Antes iba en el orden en que
  se habían ido añadiendo los colores, con los rojos repartidos por tres filas
  distintas. Ahora abre con la tinta y los neutros —de oscuro a claro,
  empezando por el color por defecto—, siguen los vivos de rojo a rosa pasando
  por naranja, amarillo, verde, turquesa, azul, añil y violeta, y cierran los
  pasteles en ese mismo recorrido. Dentro de un mismo tono va antes el más
  oscuro.
- La paleta pasa de 18 colores a **36**, en seis filas de seis: la rejilla del
  panel tiene seis columnas, así que cada fila es una familia completa.
- Ningún color desaparece: los 18 de siempre siguen ahí, solo cambian de sitio
  (`#1a1a2e`, el color de creación por defecto, sigue abriendo la paleta).

## [2.18.0] — 2026-08-10

### Cambiado

- **Mover también abre los ajustes de selección al elegirla**, con la misma
  casilla «Los clics acumulan selección» que «Select». El ajuste gobierna el
  clic de las dos herramientas, así que ahora las dos lo enseñan; en la 2.17.0
  Mover dependía del ⚙ del panel, que sigue estando para reabrirlo sin soltar
  la herramienta.
- Las cuatro veces que la aplicación activa Mover **por su cuenta** —al pegar
  una imagen, al pegar elementos, con Ctrl+A y al volver de un catálogo
  cancelado— siguen sin abrir nada: ahí nadie ha pulsado la herramienta, y un
  diálogo dejaría el lienzo inerte justo después de pegar o de seleccionarlo
  todo.

## [2.17.0] — 2026-08-10

### Cambiado

- **«Los clics acumulan selección» deja el panel y pasa a ser el ajuste de la
  herramienta «Select».** Pulsarla abre sus ajustes con la casilla dentro, como
  ya hacían el borrador, el trazo, las formas, el texto y los componentes. En el
  panel quedaba lejos del sidebar —donde de verdad se elige la herramienta— y,
  en pantallas de menos de 1100 px, escondida dentro de un cajón.
- El ajuste sigue gobernando también los clics de **Mover**, que comparte la
  misma forma de seleccionar. Mover no abre el modal al elegirla, porque es la
  herramienta que más se pulsa —tras dibujar, al pegar, con Ctrl+A— y un
  diálogo en cada paso estorbaría; se llega a él con el **⚙** del panel, que
  ahora aparece también con las dos herramientas de Edición.

## [2.16.3] — 2026-08-10

### Corregido

Los tres defectos que una revisión del código encontró en el estilo de texto
recién estrenado y en su gemelo del trazo.

- **Elegir el color de la sombra ya no borra el historial de deshacer.** El
  selector de color del sistema avisa de cada tono que se pisa al arrastrar, no
  solo del elegido al final, y la app guardaba un paso de deshacer en cada uno:
  un solo arrastre llenaba el historial (que tiene un tope de 50) de tonos
  intermedios y expulsaba todo el trabajo anterior. Ahora **todo el arrastre es
  un único paso**, como ya ocurría en el color de trazo, el de relleno, el
  grosor, la opacidad y el giro.
- **Cambiar el tipo de sombra ya no revierte su color.** Elegir rojo para la
  sombra de un texto y pasar después de «suave» a «halo» devolvía la sombra al
  gris por defecto. El cambio de tipo cambia solo el tipo.
- **Con varios objetos seleccionados, «Trazo discontinuo» y «Doble punta» ya no
  mienten.** Al seleccionar tres flechas discontinuas y pulsar la herramienta
  Flecha para editarlas, ambas casillas aparecían desmarcadas aunque las tres lo
  estuvieran; ahora enseñan el valor que comparten, como el resto del panel
  desde la 2.12.0.

## [2.16.2] — 2026-08-10

### Corregido

- **El modal de «Ajustes del texto» podía bloquear la aplicación.** En una
  ventana de altura corriente, los controles añadidos en la 2.16.0 hacían que
  el modal no cupiera y su botón **«Cerrar» quedaba fuera de la pantalla**.
  Como un diálogo modal vuelve inerte todo lo que hay detrás, el lienzo dejaba
  de responder y no se podía dibujar ni escribir: la app parecía rota nada más
  elegir la herramienta Texto. Ahora el botón de cierre se queda **anclado al
  fondo** del diálogo mientras su contenido se desplaza, en los cinco modales
  de ajustes.

## [2.16.0] — 2026-08-10

### Añadido

- **Negrita en el texto**, con el corte real de la familia donde lo hay
  —Caveat, Kalam, Montserrat Alternates y OpenDyslexic traen el suyo— y
  sintetizada por el navegador en las tres que sencillamente no tienen negrita
  (Architects Daughter, Patrick Hand e Indie Flower son familias de un solo
  grosor).
- **Tres sombreados para el texto**, con **color propio**: *suave*
  (desplazada y difuminada), *dura* (desplazada y nítida) y *halo* (resplandor
  alrededor, que es lo que hace legible un texto claro sobre un dibujo denso).
  Las medidas se escalan con el tamaño de letra, así que la sombra de un
  titular no es la misma manchita que la de una nota al pie.
- Los tres controles viven en el panel «Texto» y, gemelos, en «Ajustes del
  texto», con la semántica de siempre: **con textos seleccionados los editan**
  y sin selección fijan el estilo con el que nacerá el próximo. Viajan en los
  cinco formatos de exportación —`font-weight` y un filtro `feDropShadow` en
  el SVG, `text-shadow` en el HTML— y sobreviven al JSON.

### Corregido

- **La negrita de Caveat salía idéntica a la redonda.** Su `@font-face`
  declaraba el rango «400 700» sobre un fichero que solo trae el 400, así que
  el navegador lo daba por bueno y ni siquiera la sintetizaba. Ahora cada
  negrita declarada tiene su propio fichero, y una guarda comprueba que no
  vuelva a apuntar al de la redonda.

## [2.15.0] — 2026-08-10

### Añadido

- **Montserrat Alternates**, séptima letra del lienzo: una geométrica con las
  formas alternativas que le dan carácter, para bocetos de aire más tipográfico
  que dibujado. Autoalojada como el resto (OFL 1.1), así que la app sigue sin
  pedir nada por red.

### Cambiado

- **El selector pasa a llamarse «Letra del lienzo».** Se llamaba «Letra
  manuscrita» cuando todas lo eran; con OpenDyslexic y Montserrat Alternates
  dentro, dos de las siete no lo son y el rótulo prometía algo que la lista ya
  no cumplía.

## [2.14.0] — 2026-08-10

### Añadido

- **OpenDyslexic también dibuja el lienzo.** Se suma como sexta opción del
  selector de letra, junto a las cinco manuscritas. Hasta ahora la elección
  pensada para lectores con dislexia se quedaba en la interfaz —topbar, panel,
  modales— y el dibujo seguía en cursiva, que es justo donde más cuesta leer;
  ahora los textos, los rótulos de los componentes y las etiquetas del jardín
  pueden escribirse con ella. Ya viajaba autoalojada, así que no añade ni un
  byte de descarga.

### Corregido

- **Un exportado con OpenDyslexic ya no enlaza una fuente inexistente.**
  OpenDyslexic no está en Google Fonts, y la URL que los `.svg` y `.html`
  exportados piden se arma con la familia activa: habría salido un enlace roto
  que falla en silencio. Ahora las familias propias de la app se declaran como
  tales y el exportado omite el enlace, quedándose con su pila de resguardos.

## [2.13.0] — 2026-08-10

### Añadido

- **La letra manuscrita se elige, entre cinco** (seis desde la 2.14.0). Además de la de siempre
  (Architects Daughter) llegan **Caveat**, **Patrick Hand**, **Kalam** e
  **Indie Flower**. El selector vive en el panel («Lienzo» → Letra manuscrita)
  y, gemelo, dentro de **«Ajustes del texto»**, que es donde se mira al
  escribir: la muestra del modal cambia al instante. Cada opción de la lista
  se rotula **con su propia letra**, que es lo único que distingue una
  manuscrita de otra antes de elegirla. La elección es un ajuste global del
  boceto, como el fondo o la cuadrícula, y sobrevive a la recarga.

### Cambiado

- **La aplicación ya no pide ninguna fuente por red.** Las cinco manuscritas
  viajan autoalojadas en `fonts/` (SIL OFL 1.1, subconjunto latino), así que
  desaparecen los dos `preconnect` y el `<link>` a Google Fonts del `<head>`:
  Pizarra dibuja con su letra de siempre **sin conexión** y abierta con
  `file://`, que es justo lo que el README promete. Antes, sin red, el lienzo
  caía a la cursiva del sistema. Los archivos **exportados** sí siguen pidiendo
  la fuente a Google, y es deliberado: un `.svg` o un `.html` suelto viaja sin
  la carpeta `fonts/` al lado, así que una ruta relativa se rompería en cuanto
  saliera de aquí; la URL se arma con la familia activa.

## [2.12.1] — 2026-08-10

### Corregido

- **Lanzar un objeto fuera del lienzo ya no lo pierde.** Arrastrar algo deprisa
  más allá del borde lo hacía desaparecer, y no solo de la vista: seguía en la
  escena y dentro del JSON exportado, pero invisible e inalcanzable —el clic no
  llega ahí fuera y la marquesina solo se dibuja sobre el lienzo, así que ni
  seleccionándolo todo volvía—, de modo que la única vía de vuelta era deshacer
  en el momento. Ahora el movimiento se frena dejando siempre **24 px del
  objeto dentro** (o el objeto entero, si es más pequeño). Las teclas de flecha
  y las casillas de X/Y de «Posición y tamaño» lo perdían igual y pasan por el
  mismo freno. Un grupo se detiene **entero**, sin desmontarse contra el borde,
  y lo que ya estuviera fuera —un proyecto guardado con una versión anterior—
  puede seguir viniendo hacia dentro.

## [2.12.0] — 2026-08-10

### Añadido

- **Editar varios elementos a la vez, de verdad.** Con varios seleccionados
  —aunque no sean un edificio ni un grupo—, la caja combinada ahora se dibuja
  **con tiradores**: arrastrar una esquina escala todo el conjunto de forma
  uniforme, igual que ya hacían los grupos, mientras que arrastrar por dentro
  lo sigue moviendo. Antes solo se podía redimensionar tecleando las medidas.
- **El panel dice la verdad con varios seleccionados.** Color, grosor,
  discontinuo, doble punta, tamaño de letra y todo el bloque de relleno ya se
  aplicaban a la selección entera, pero los controles seguían enseñando lo
  último visto —el negro y el 2 px de los defaults— aunque los tres elementos
  fueran rojos y gruesos, y eso hacía parecer que el panel no iba con ellos.
  Ahora enseñan el valor que **todos** comparten; cuando discrepan, el control
  se queda como está en vez de mostrar el del primero como si fuera el de
  todos. Cada control se calcula sobre los elementos a los que afecta: una
  flecha junto a un rectángulo no vacía la casilla de «Doble punta».

### Corregido

- **Pulsar «Mover» ya no suelta la selección múltiple.** Seleccionar varios
  objetos —enmarcándolos con «Select», o por cualquier otra vía— y pulsar
  **Mover** para desplazarlos movía **solo** el objeto bajo el puntero: al
  elegir la herramienta se vaciaba la selección, herencia del «vaciar siempre»
  anterior a la 2.10.0. Mover y «Select» son las dos herramientas que trabajan
  *sobre* la selección —una la desplaza, redimensiona y duplica; la otra la
  construye—, así que ninguna la vacía al elegirla, en los dos sentidos. Las
  de creación, el Borrador, Emoji y los catálogos siguen vaciando como
  siempre.

## [2.11.0] — 2026-08-10

### Añadido

- **Nueva herramienta «Select» en Edición** (entre Mover y Borrador): solo
  selección — el clic selecciona cualquier elemento con la misma semántica que
  Mover (el grupo completo, Alt aísla la pieza, doble clic desciende, Shift y
  «Los clics acumulan selección» funcionan igual) y el arrastre dibuja
  **siempre** marquesina, incluso empezando encima de un elemento: el gesto
  que con Mover lo desplazaría. Nada se mueve jamás con ella, así que en un
  lienzo denso se puede enmarcar sin miedo; una vez seleccionado, el panel
  edita posición, tamaño, color o texto como siempre. Sin atajo de teclado
  (las 26 letras y los 10 dígitos están asignados) y con cursor de flecha
  propio: ni la cruz de dibujar ni el `move` de Mover.

## [2.10.1] — 2026-08-10

### Corregido

Auditoría severa sobre la 2.10.x (tres revisores independientes + verificación
con sondas; cada defecto tiene su entrada en `BUGS.md` y su guarda de
regresión):

- **Teclear una medida ya siempre gana.** Los campos de «Posición y tamaño»
  enseñan valores redondeados, pero se comparaban contra la caja exacta: con
  cualquier caja fraccionaria (un polígono dibujado en diagonal; con el
  auto-zoom, casi todo) el alto que acababas de teclear perdía contra un ancho
  que nadie había tocado. Además, vaciar un campo colapsaba el elemento
  (`Number('')` es 0: Ancho → 1px, X → 0) y una medida inasumible (el alto de
  una línea horizontal) apilaba un paso de deshacer fantasma.
- **Un cambio rezagado ya no se aplica al elemento equivocado.** Teclear un
  ancho y clicar otro elemento sin confirmar aplicaba la medida al recién
  seleccionado (el `mousedown` corre antes que el `blur`→`change`).
- **«Posición y tamaño» funciona con cualquier multi-selección**, no solo con
  grupos: con dos elementos sueltos los campos enseñaban valores rancios y
  teclear no hacía nada. La escala sigue siendo uniforme.
- **El rótulo respeta la semántica dual**: con multi-selección ya no reescribe
  en silencio el rótulo de creación (y la fila no se ofrece); el default se
  recorta a 120 caracteres al escribir, no al recargar.
- **Vaciar un texto desde el panel lo borra**, como el editor de doble clic —
  antes dejaba un elemento invisible de caja cero.
- **Los tiradores solo se dibujan con Mover**: con la selección conservada y
  una herramienta de creación, agarrar la esquina creaba un elemento nuevo en
  vez de escalar — el lienzo prometía lo que no hacía.
- **El deslizador del panel vuelve a mandar sobre el Emoji**: con Emoji activo
  se retitula («Emoji») y gobierna su tamaño (32–96), como el de grosor hace
  con el borrador; seleccionar un emoji grande ya no desborda el control
  (max 96). Cancelar un catálogo viniendo de Emoji ya no reabre su catálogo.
- **El modal de trazo no ofrece lo que no aplica**: «Trazo discontinuo» se
  atenúa con el Lápiz (lo ignoraba, pero cambiaba en silencio el default de
  las líneas) y «Doble punta» con un Semicírculo seleccionado; las casillas se
  resincronizan siempre y la muestra ignora una casilla deshabilitada.
- **La muestra del relleno sólido ya no miente**: sin color de relleno elegido
  enseña el tinte clásico del trazo, como la forma que se va a crear.
- **Los tres formatos dicen lo mismo**: el SVG del navbar gana los enlaces
  «Inicio / Nosotros / Contacto» que canvas y HTML ya pintaban, y el marcador
  de imagen deja de exportar «Image Placeholder» en inglés.

## [2.10.0] — 2026-08-10

### Añadido

- **Pulsar la herramienta de un elemento seleccionado lo edita en su modal,
  posición incluida.** Hasta ahora elegir una herramienta deseleccionaba
  siempre, así que los modales de ajustes solo servían para configurar lo
  próximo que se iba a dibujar. Ahora, si lo seleccionado es del tipo que esa
  herramienta crea (regla por tipo exacto: un rectángulo se edita pulsando
  Rectángulo), la selección se conserva y el modal abre mostrando y editando
  ese elemento: color, grosor, relleno, giro… y un bloque nuevo de **Posición
  y tamaño** (X/Y/ancho/alto) que existe en los cuatro modales de ajustes y
  solo aparece con selección. Es el mismo `applyGeometry` del panel
  parametrizado por prefijo, así que escribir una medida en el modal respeta
  las mismas invariantes (un polígono regular mantiene `w === h`, un grupo
  escala en proporción). Empezar a dibujar en el lienzo suelta la selección:
  crear y editar no se pisan.
- **Botón, Input, Imagen, Navbar y Tarjeta abren sus ajustes al pulsarlos**
  (`#modal-ui`, compartido y retitulado por herramienta), con vista previa
  dibujada por el renderer real, color, grosor y un campo de **Rótulo** con
  semántica dual: con un componente seleccionado edita el suyo; sin selección
  fija el rótulo con el que nacerán los próximos (se recuerda entre sesiones).
  Imagen no lleva rótulo y su fila se oculta. El ⚙ del panel los reabre.
- **Texto abre sus ajustes al pulsarlo** (`#modal-text`): tamaño de letra,
  color y vista previa. El **tamaño de letra gana la semántica dual** que ya
  tenían grosor y color: con un texto seleccionado, el deslizador (el del
  panel o el del modal) lo cambia a él, en un solo paso de deshacer; sin
  selección fija el default. Era el último control de aspecto sin ella.
- **El catálogo de Emoji estrena un deslizador de tamaño** (32–96 px),
  independiente del tamaño de letra del texto: agrandar un emoji ya no encoge
  el próximo texto. Se recuerda entre sesiones y «Limpiar todo» lo devuelve a
  32 px.

### Cambiado

- **Los textos por defecto de los componentes UI están en español**, en el
  lienzo y en los exports SVG/HTML: «Botón», «Escribe aquí...», «Título»,
  «Texto de ejemplo» y el menú «Inicio / Nosotros / Contacto» del Navbar
  (antes «Button», «Type here...», «Card Title» y «Home / About / Contact», en
  una app cuya interfaz siempre estuvo en español). Un componente con rótulo
  propio no cambia; los que no lo tenían pasan a verse en español.
- **Mover es ahora la única herramienta sin modal de ajustes**: la promesa
  «pulsar una herramienta muestra sus ajustes» cubre ya Dibujo, Formas, UI,
  Texto, Emoji, Borrador, Edificios y Jardín.

## [2.9.0] — 2026-08-10

### Cambiado

- **El panel derecho se reorganiza y pasa a ser contextual.** Era una lista
  plana de 45 controles en diez secciones, todos a la vista sea cual sea la
  herramienta: dibujando con el lápiz seguían delante «Plantas», «Ventanas por
  planta», «Pendiente del tejado», «Cubierta del alzado», «Ancho del camino» y
  «Caminos en cualquier inclinación», que solo sirven para Fachada y para
  Camino. Ahora cada sección aparece con lo que la usa, y con el lápiz el panel
  baja de ~28 controles visibles a ~13 —lo que más se nota por debajo de
  1100 px, donde el panel es un cajón y cada control de más se paga en scroll—.

  - **Trazo** reúne grosor, color y los dos modificadores de línea. «Color» era
    una sección aparte pese a ser el color *del trazo*; «Trazo discontinuo» y
    «Doble punta» estaban en una sección **sin título** junto a la cuadrícula y
    a la selección múltiple, y ahora solo salen con línea, flecha o curva.
  - **Relleno** aparece con una forma rellenable. «Solapamiento» sale de aquí:
    no es un ajuste de relleno sino un modo de render de toda la escena, y pasa
    a «Lienzo».
  - **Lienzo** agrupa mostrar/ajustar cuadrícula, fondo, color de cuadrícula,
    solapamiento y zoom. **Selección** agrupa «Los clics acumulan selección»,
    el recuento y los botones de la selección.
  - **Edificios** y **Jardín** solo salen con sus herramientas, y estrenan un ⚙
    que reabre el catálogo sin soltar la herramienta.
  - **Nada se ha quitado ni renombrado.** Todo reaparece con su herramienta, y
    **al seleccionar un elemento vuelven los controles que lo editan** aunque la
    herramienta activa sea otra: es lo que hace falta para que seleccionar una
    forma siga permitiendo rellenarla.

### Añadido

- **Lápiz, Línea, Flecha, Flecha curva y Semicírculo abren sus ajustes al
  pulsarlas** (`#modal-stroke`), igual que el Borrador abre el suyo o Planta su
  catálogo: grosor, color, trazo discontinuo, doble punta y una **muestra en
  vivo** dibujada con las mismas primitivas que el lienzo, que cambia con la
  herramienta (una línea no lleva puntas, y «Doble punta» se atenúa). Cerrar
  deja la herramienta puesta —no hay nada que elegir—, y el ⚙ de la cabecera
  «Trazo» lo reabre sin cambiar de herramienta. Los cuatro ajustes siguen en el
  panel y son exactamente los mismos.
- **Las ocho de Formas abren «Ajustes de la forma»** (`#modal-shape`): además del
  trazo, llevan **el bloque de Relleno entero** —rellenar, translúcido, opacidad
  y color—, que es la sección del panel que solo les sirve a ellas. La muestra
  dibuja la forma de la herramienta activa (un pentágono no se parece a un
  círculo) ya rellena, así que se ve el resultado antes de arrastrar.
- **El giro deja de ser solo una acción sobre lo ya dibujado.** Cuadrado,
  triángulo, pentágono, hexágono y trapecio traen un deslizador de **giro** con
  el paso propio de cada uno —45°, 90°, 36°, 30° y cuartos de vuelta—, así que
  la forma **nace ya orientada** y la previsualización del arrastre lo enseña.
  Antes solo existía «Rotar selección», de un paso por clic: para poner un
  pentágono a 288° había que dibujarlo, seleccionarlo y pulsar ocho veces. Con
  algo seleccionado el mismo deslizador lo gira, en un único paso de deshacer.
- **Sección «Posición y tamaño» en el panel**, con la selección puesta: X, Y,
  ancho, alto y el **texto** del elemento cuando lo tiene (el contenido de un
  texto, el rótulo de un botón, un input, una navbar o una tarjeta). Hasta ahora
  solo se podía mover arrastrando y redimensionar con los tiradores —sin forma
  de dar una medida concreta ni de alinear dos cosas—, y el rótulo de un
  componente solo se cambiaba con doble clic sobre el dibujo, que no se anuncia
  en ninguna parte. Se lee y se escribe con `getElementBounds` +
  `moveElement`/`scaleElement`, así que vale para **cualquier** tipo, incluidos
  los trazos a mano alzada y las selecciones múltiples. Va **la primera del
  panel**: aparece solo cuando hay algo seleccionado, y entonces es lo más
  relevante que hay en pantalla. Escribir una medida respeta las mismas reglas
  que arrastrar un tirador —un polígono regular conserva `w === h` y un grupo
  escala en proporción—, porque un polígono deformado no pasa la validación de
  importación y dejaría un proyecto que ya no se puede abrir.
- **«Etiquetas» dentro de los ocho modales del jardín**, junto al selector de
  modo de etiqueta, que es donde se decide qué se dibuja. Con las etiquetas
  apagadas, el modo de etiqueta se deshabilita porque no rotula nada. La casilla
  del panel sigue estando y es la misma.

### Corregido

- **El ⚙ del panel se veía con todas las herramientas** y abría el modal del
  tamaño del borrador viniera a cuento o no. `app.js` le ponía `hidden`
  correctamente, pero `.panel__gear` declara `display: inline-flex` para cumplir
  el objetivo táctil de 24×24 px, y eso gana al `display:none` del navegador.
  Estaba así desde que existe el botón (v1.22.0) y ninguna guarda podía verlo:
  en el arnés `node:vm`, `hidden` es una propiedad de JavaScript, no un estilo.
- **«Cuadrícula» se salía del panel** por el borde de la ventana: los dos
  selectores de color de «Lienzo» no caben en una fila de 22 rem.
- **Tras «Limpiar todo», Verjas y Cancela** seguían enseñando el diseño y la
  altura anteriores hasta reabrir su modal: el reset llamaba a tres de los cinco
  puntos de sincronía.
- **El color no se podía cambiar en nada ya dibujado.** El selector de color
  era el único control de aspecto sin semántica dual: elegir un color con algo
  seleccionado no lo recoloreaba, así que un botón, una tarjeta o cualquier
  elemento se quedaba para siempre del color con el que nació. Ahora recolorea
  la selección —tanto el picker como las muestras—, en un único paso de
  deshacer, y el panel enseña el color de lo seleccionado en vez del último
  elegido.
- Un `<select>` deshabilitado se veía igual que uno usable: ahora se atenúa,
  como ya hacían los deslizadores.
- **La vista previa del Cuadrado dibujaba un rectángulo.** El cuadrado es un
  polígono regular de cuatro lados con su propio tipo de elemento, no un `rect`.
- El atributo `hidden` tampoco ocultaba `.panel__field` ni `.panel__gear`, por
  el mismo motivo que las secciones: su `display` gana al del navegador. Las
  cuatro reglas se agrupan ahora en un solo sitio, con la advertencia.
- Cancelar un catálogo devolvía a la herramienta anterior sin mirar si esa
  también abre modal, lo que ahora encadenaría dos ventanas seguidas. Se vuelve
  a ella en silencio: recupera la herramienta sin abrir nada encima. Mandar a
  Mover en todos los casos habría sido más fácil y peor.

### Tests

- **495 unitarios** y **43 end-to-end**. Las guardas nuevas cubren las secciones
  contextuales, su reaparición con la selección, los gemelos del modal de trazo,
  la reentrada de herramienta, la casilla de etiquetas y el reset completo.
- La visibilidad real se comprueba en `e2e/panel.spec.js` **a propósito**: el
  arnés `node:vm` ve `hidden` como propiedad y no sabe si el CSS la respeta, que
  es exactamente el agujero por el que se coló el bug del ⚙.

## [2.8.0] — 2026-08-09

### Añadido

- **Dos aromáticas nuevas en el catálogo de Jardín: María Luisa (*Aloysia
  citriodora*) e Hierbabuena (*Mentha spicata*)**, documentadas como el resto
  con nombre botánico, altura y diámetro adultos, y dibujadas en planta y en
  alzado. El catálogo de Aromáticas pasa a **10 especies**.

  - La **María Luisa** es la única aromática con porte de arbusto (2,5 m): en
    alzado son varas leñosas arqueadas con panícula terminal clara, y en planta
    la mata lleva verticilos de tres hojas a 120°, que es su rasgo de
    identificación en campo.
  - La **hierbabuena** se dibuja como lo que es, una herbácea estolonífera: en
    planta el tapiz deja escapar cuatro estolones con su brote enraizado en la
    punta, y en alzado son tallos rectos con hoja opuesta y espiga terminal.

  Romero y lavanda ya estaban en el catálogo desde la 2.7.0 y no cambian.

- **Seis autóctonas y endémicas valencianas en el catálogo de Flor**: lirio de
  mar (*Pancratium maritimum*), campanilla valenciana (*Acis valentina*), boca
  de dragón de roca (*Antirrhinum valentinum*), silene de Ifach (*Silene
  hifacensis*), limonio de Dufour (*Limonium dufourii*) y narciso trompón
  (*Narcissus radinganorum*). Flor pasa de 5 a **11 especies**, cada una con su
  planta y su alzado propios: las umbelas y trompetas de los bulbos, el porte
  tendido de las rupícolas y la roseta basal con panícula alta del limonio, que
  es justo lo que lo separa del estátice de jardín.

  Tres de ellas son bulbos con licorina. **Entran por decisión expresa**, y la
  guarda de toxicidad pasa a vigilar solo lo que decidió la 2.7.0 —que no
  vuelvan baladre, boj, durillo, laurel, amapola, iris ni gladiolo— en vez de
  fijar el catálogo entero especie a especie, que convertía cualquier alta en
  un fallo que no decía nada sobre toxicidad.

- **Caqui** (*Diospyros kaki*) en el catálogo de Árbol, que pasa a **13
  especies**. Copa ancha y fruto grande y anaranjado, que es lo único que lo
  distingue del naranjo cuando la copa va sin hoja. Granado y algarrobo ya
  estaban desde la 2.7.0.

  Con las nueve altas, el jardín pasa a **67 variantes** en ocho catálogos, con
  **49 especies vegetales** documentadas.

### Cambiado

- **«Mover» abre el sidebar.** El grupo «Edición» pasa por delante de «Dibujo»:
  es la herramienta a la que se vuelve entre gesto y gesto —seleccionar,
  arrastrar, redimensionar— y estaba al final, después de tres grupos de
  creación.
- **El Borrador se muda de «Dibujo» a «Edición».** No crea nada: quita lo que ya
  está dibujado, igual que el resto de ese grupo. Su atajo (`E`) no cambia.

### Corregido

- **Los iconos de las plantas pequeñas eran un borrón.** El icono simulaba un
  clic para heredar la proporción botánica de la especie, pero eso daba la caja
  en píxeles reales: a 20 px/m una campanilla de 0,25 m salía de 5 px. A ese
  tamaño manda el mínimo con el que la geometría evita pétalos invisibles, todo
  el detalle se iguala y se solapa, y el ajuste a los bordes amplía esa mancha
  hasta llenar la casilla. La caja se amplía ahora a 64 px de lado mayor
  **conservando la proporción**, que es lo que el icono promete. Se nota
  también en la caléndula, el tomillo y la boca de dragón, que arrastraban el
  mismo borrón desde la 2.7.0.

### Tests

- **480 tests unitarios** y **36 end-to-end**. Las guardas genéricas del jardín
  cubren las nueve especies nuevas sin tocarlas: ficha botánica completa,
  planta y alzado distintos, geometría irrepetible dentro de cada catálogo,
  determinismo y supervivencia al viaje de ida y vuelta por JSON.
- Nueva guarda de la caja del icono botánico: proporción de la especie y lado
  mayor mínimo.

## [2.7.1] — 2026-08-09

### Corregido

- **Un grupo seleccionado ya se puede redimensionar.** El marco combinado de un
  edificio o una planta se dibujaba sin tiradores y solo se podía mover: los
  tiradores existían únicamente con un elemento suelto seleccionado. Como desde
  que existen Edificios y Jardín casi todo lo que se dibuja es un grupo —un muro
  son ~70 piezas—, en la práctica el redimensionado había desaparecido de la
  app: al pulsar sobre lo recién dibujado salía una multiselección, y una
  multiselección no ofrecía por dónde agarrar.

  Ahora el marco del grupo lleva sus cuatro tiradores y arrastrarlos escala
  todas las piezas a la vez, en un único paso de deshacer. Detalles:

  - La **escala del grupo es uniforme**, a diferencia del estirón libre de dos
    ejes que sí admite un elemento suelto. Dentro de un grupo viaja de todo, y
    un estirón libre rompería invariantes ajenas: los polígonos regulares exigen
    `w === h` y la validación de importación **rechaza** los deformados, así que
    un escalado libre podía dejar un proyecto imposible de volver a abrir.
  - El impacto sobre los tiradores se comprueba **antes** que el arrastre por
    marco combinado. Caen sobre las mismas esquinas, y con el otro orden agarrar
    una esquina movería el grupo en lugar de escalarlo.

## [2.7.0] — 2026-08-09

### Añadido

- **Jardín botánico en planta y alzado.** Árboles, arbustos, flores,
  aromáticas y trepadoras comparten una vista previa viva y pueden cambiar de
  representación sin duplicar catálogos ni geometrías.
- **40 especies documentadas** con nombre científico, altura, diámetro, porte,
  follaje y floración/fruto cuando procede. Los catálogos de Árbol y Arbusto
  crecen a 12 y 9 especies, y nace **Trepadoras** con 6 especies.
- Controles por ejemplar para etapa joven/en desarrollo/adulta, tamaño
  **50–150 %**, escala **8–50 px/m**, acabado natural o tinta y etiquetas por
  nombre común, botánico o dimensiones.
- **Botón «Editar planta»** al seleccionar un ejemplar completo. Reabre su
  ficha, permite sustituir especie y representación en la misma posición y
  registra toda la regeneración como un único paso de Deshacer.
- Metadatos `gardenMeta` validados y serializables para conservar la intención
  botánica al mover, duplicar, guardar, exportar e importar el proyecto.

### Cambiado

- Las copas, troncos, portes, rosetas, floraciones y soportes de trepadoras
  tienen geometría de alzado propia; el modo natural suma masas translúcidas y
  una paleta coherente sin perder el trazo manual.
- Los iconos vegetales conservan ahora las proporciones adultas de cada
  especie. El ciprés adopta una silueta fastigiada en llama y se refinan los
  perfiles de copa, arbustos, aromáticas, corolas y órganos de las trepadoras
  para que las 40 especies sean reconocibles aun con dibujo esquemático.
- Los catálogos de Arbusto y Flor adoptan un repertorio mediterráneo prudente
  ante la toxicidad: se retiran baladre, boj, durillo, laurel, amapola, iris y
  gladiolo. Los sustituyen mirto, lentisco, alcaparra, olivo, romero, madroño,
  jara, caléndula, rosa siempreverde, estátice y boca de dragón. Se conservan
  los ids internos para mantener compatibles los proyectos previos.
- Los modales botánicos reorganizan la vista previa y los controles en dos
  columnas en escritorio y una en móvil. La ficha tiene ancho propio y
  breakpoints a 700/520 px para que los selectores no recorten su contenido.
- Versión visible, caché de recursos y documentación actualizadas a **2.7.0**.

### Tests

- **477 tests unitarios**: fichas y cotas, geometrías distintas en ambas
  vistas, límites, persistencia, metadatos, edición reversible y exportación.
- **36 tests end-to-end**: vista previa, catálogo, dibujo, edición, recarga,
  ajuste móvil, medición del texto de los controles, comprobación visible del
  repertorio sin especies descartadas y proporción del ciprés en Chromium.

## [2.6.0] — 2026-08-09

### Añadido

- **Herramienta independiente «Cancela»** en la sección Edificios. Permite
  colocar una entrada sin dibujar previamente un muro, en vista de **planta o
  alzado**, conservando hojas, pilastras, coronaciones y motivos ornamentales.
- Su modal reúne los **18 estilos** existentes: barrotes de una o dos hojas,
  nueve cóncavas, cuatro convexas monumentales y tres portones urbanos.
- **Altura regulable de 0 a 350 cm**, con miniatura en vivo. A 0 cm queda solo
  la línea de implantación; el arrastre fija el ancho y la cota fija el alto.
- Estado independiente y persistente para `gateView`, `gateType` y
  `gateHeightCm`. Las preferencias inválidas se ignoran o se acotan.
- Catálogos compartidos `GATE_TYPES` y `GATE_VIEWS`, usados también para
  validar las cancelas del Muro sin mantener dos listas divergentes.

### Cambiado

- La documentación y la ayuda integrada reflejan los nueve botones de
  Edificios, los 18 estilos de cancela y los rangos en centímetros.
- Versión visible, caché de recursos y distribución actualizadas a **2.6.0**.

### Tests

- **462 tests unitarios**: geometría autónoma, 18 diseños distintos, planta y
  alzado, rango exacto 0–350 cm, persistencia y validación del modal.
- **31 tests end-to-end**: el nuevo flujo comprueba botón, modal, 18 miniaturas
  diferentes, dibujo real y restauración tras recargar.

## [2.5.4] — 2026-08-09

### Cambiado

- Las puntas defensivas de los **13 diseños de Verjas** dejan de compartir una
  plantilla genérica. Cada modelo tiene una hoja clásica propia: lanceolada,
  aguja, ojiva trilobulada, rombo, laurel, llama, palmeta, hoja castellana
  facetada, flor de lis, piramidión herreriano, cáliz andaluz, corazón catalán
  o rocalla valenciana.
- Los remates se aplican tanto a la herramienta Verjas como a la verja superior
  del Muro. Todos conservan dos filos convergentes y función disuasoria.

### Tests

- Guardia geométrica que compara la **propia hoja**, no solo su collar o el
  ornamento inferior, e impide que dos modelos vuelvan a compartir perfil.

## [2.5.2] — 2026-08-09

### Añadido

- **Verja Valenciana barroca de rocalla**, con cartelas ovales, roleos
  asimétricos, abanicos de concha y rosetas. Es el decimotercer diseño y está
  disponible tanto como verja autónoma como sobre el Muro.

## [2.5.0] — 2026-08-09

### Añadido

- **Herramienta «Verjas»** en Edificios: paños independientes en planta o
  alzado, miniatura en vivo y altura física de **0 a 350 cm**.
- Doce diseños iniciales de forja, incluidos cinco repertorios españoles:
  castellano, plateresco, herreriano, andaluz y catalán. Todos llevan lanzas.
- Material **ladrillo cara vista** para el Muro, con hiladas y juntas alternas.
- Seis cancelas adicionales para el Muro: tres variantes de Convexa monumental
  y tres portones urbanos —uno ciego y dos abiertos—. El catálogo alcanza los
  **18 estilos** actuales.

### Cambiado

- La altura de la verja superior del Muro pasa a ser ajustable.
- La distribución `dist/`, las preferencias y la ayuda integrada incorporan
  los nuevos catálogos y materiales.

## [2.4.5] — 2026-08-09

### Añadido

- **Diez cancelas de forja para el muro**, además de las dos de barrotes rectos:
  cóncava pura de barrotes graduados, cuello de cisne (doble curva), cóncava con
  zócalo ciego, ornamental con volutas, con abanico radial, con lira central, con
  rombos ingleses, de anillas neoclásicas, de palmetas barrocas y convexa
  monumental con paneles. Todas se dibujan con tipos de elemento ya existentes,
  así que exportación, undo y JSON siguen sin necesitar código propio.
- **Alto de la verja superior, modulable** (`#wall-railing-height`, 0,3–1,5 m):
  igual que el alto de la cancela, va en metros sobre la escala del muro y se
  acota al rango que exporta `building.js` (`WALL_RAIL_H_MIN/MAX`). En planta
  el pasamanos se separa del borde según ese alto, así que el ajuste también se
  ve desde arriba.

### Cambiado

- **El muro nace en alzado y con cancela cóncava**, en vez de en planta y sin
  puerta: la vista de alzado es la que enseña de una vez el material, la altura,
  la verja y la puerta, y con «sin puerta» por defecto la mitad del catálogo
  quedaba invisible hasta que alguien lo buscaba.
- **Las preferencias guardadas llevan versión de diseño** (`wallDesignVersion`).
  Unas preferencias escritas antes de este rediseño traían «planta» y «sin
  puerta» aunque nadie hubiera tocado nunca la herramienta, y ese default
  histórico tapaba el diseño nuevo en silencio. Solo se restaura la vista
  guardada si la versión coincide; a partir de la primera elección propia, se
  respeta con normalidad.

### Tests

- Nuevo `e2e/wall-concave.spec.js`: la cancela cóncava se ve en el modal, se
  dibuja en el lienzo y sobrevive a una recarga.
- Actualizadas tres aserciones de `building.test.js` que habían quedado ancladas
  a la geometría anterior del muro: la lista de tipos admitidos (el muro emite
  también `circle`, que es un tipo ya existente), la distinción piedra/hormigón
  —que ahora está en las **llagas**, no en el número de líneas, porque el
  hormigón lleva una tongada por altura de vertido— y el recuento de pilastras,
  que contaba también la basa dibujada dentro de cada una.

## [2.4.0] — 2026-08-08

### Añadido

- **Alto de la puerta del muro, modulable** (`#wall-gate-height`, 0,8–3 m):
  un deslizador en el modal de Muro que fija el alto de la cancela en metros,
  sobre la misma escala que el muro. Una cancela de 2,5 m sobre un muro de 1 m
  asoma por encima, con las pilastras acompañándola. Persiste en preferencias
  y se acota al rango que exporta `building.js` (`WALL_GATE_H_MIN/MAX`).

### Cambiado

- **La entrada del muro es ahora una cancela, no una valla de tablas.** El
  hueco se dibujaba como un rectángulo lleno de barrotes de suelo a techo, sin
  jerarquía ninguna. Ahora lleva **dos pilastras rematadas en albardilla** —lo
  que convierte un hueco en una entrada—, hojas de reja con **puntas de
  lanza**, pasamanos y travesaño bajo, y el paño del muro se **parte** en el
  paso en vez de cruzarlo por detrás. La verja del remate se interrumpe en las
  pilastras (antes cruzaba por encima de la puerta, forja flotando en el aire).
- El motivo de reja vive en un solo sitio (`_railPanel`), compartido por la
  verja y por las hojas: los barrotes se abomban a lados alternos, en vez de
  con una comba que crecía con la posición y dibujaba una lente de lado a lado
  en los paños largos.

### Corregido

- **El muro de piedra parecía de bloques prefabricados.** El alzado se dibujaba
  con una retícula exacta (hilada fija de 22 px, junta siempre a media pieza),
  que es justo el aparejo de un bloque de hormigón. Ahora es mampostería:
  altura de hilada y ancho de mampuesto variables pieza a pieza, con las llagas
  algo inclinadas y sin alinearse en columnas. La irregularidad es determinista
  (no usa `Math.random`), así que el icono, la miniatura, la previsualización
  del arrastre y el trazo comprometido salen idénticos.
- **La altura de 2 m no se notaba.** Solo decidía la caja al hacer clic sin
  arrastrar —es decir, casi nunca—: cualquier arrastre la anulaba. Ahora la
  altura declarada fija la **escala** del dibujo (px por metro), así que a igual
  tamaño dibujado un muro de 2 m sale con hiladas y mampuestos la mitad de
  grandes, la verja proporcionada y el hormigón con más tongadas. En planta,
  además, un muro de 2 m nace con más canto.
- **La verja de forja no se podía elegir.** El modal de Muro atenuaba altura y
  verja en vista de planta —la vista por defecto— y elegir vista cierra el
  modal: los dos ajustes quedaban fuera de alcance en la única visita en la que
  se podían tocar. Los cuatro ajustes están ahora siempre disponibles, y la
  verja se dibuja también en planta (el pasamanos visto desde arriba).
## [2.3.0] — 2026-08-08

### Añadido

- **Herramienta «Muro» en Edificios**: dibuja muros perimetrales en **vista de
  planta** (contorno visto desde arriba) o **de alzado** (visto de frente),
  elegible en su propio catálogo de dos vistas.
  - **Material**: piedra (achurado en planta, hiladas y juntas de sillar a
    matacán en alzado) u hormigón (liso, con una sola junta de hormigonado).
  - **Altura**: 1 m o 2 m — fija la caja por defecto al hacer clic sin
    arrastrar; un arrastre real siempre manda, como en el resto de Edificios.
  - **Verja de forja arriba** (opcional, solo en alzado): reutiliza la misma
    geometría combada del balcón de forja (`_railing` + `ArcMath`).
  - **Puerta de barrotes de forja** (opcional, una o dos hojas): un hueco
    barrado que ambas vistas y sus texturas dejan sin atravesar, igual que la
    fachada deja sitio a la puerta principal.
  - Sin tipo de elemento nuevo: produce `rect`/`line`/`curveArrow` ya
    existentes, así que export, undo y JSON funcionan sin cambios.
  - Sin atajo de teclado: no queda ninguna tecla suelta libre (como Balcón).

## [2.2.0] — 2026-08-08

Correcciones de la segunda auditoría severa (cuatro frentes: lógica JS,
accesibilidad WCAG, build/publicable y coherencia de documentación). Cada fix
lleva su entrada en `BUGS.md` con guardia de regresión verificada por sabotaje.

### Añadido

- **Doble clic sobre una pieza de un edificio o del jardín la aísla** — la vía
  de una sola mano para lo que antes solo hacía `Alt`+clic (que queda como
  atajo). Regla del proyecto: ningún gesto puede exigir un acorde
  tecla+puntero como única forma.
- **Casilla «Los clics acumulan selección»** en el panel (mismo patrón que
  «Ajustar a cuadrícula»): cada clic añade a la selección y un clic sin
  arrastre sobre lo ya seleccionado lo quita — la multi-selección disjunta sin
  `Shift`. Arrastrar sigue moviendo el grupo.
- **Navegación por flechas en la barra de herramientas** (roving tabindex):
  la barra entera es una sola parada de Tab y flechas/Inicio/Fin recorren las
  herramientas, como promete su `role="toolbar"`.
- **Licencia MIT traducida al español** (`LICENSE.es.txt`, también en el
  publicable); la versión vinculante sigue siendo `LICENSE` en inglés.
- Tests de `dist/` (`tests/dist.test.js`): rutas aplanadas y contenido íntegro
  del publicable, con skip explícito si no existe.

### Corregido

- **El borrador ya no desancla flechas en silencio**: el recorte usa el mismo
  margen de tinta que la detección de contacto (`r + grosor/2`), un roce sin
  mordisco deja el elemento intacto (sin paso de undo fantasma) y el trozo que
  conserva su extremo original de flecha conserva también su ancla.
- **Doble clic en el segundo control de una curva encadenada** reseteaba el
  control equivocado; ahora resetea el tramo cúbico entero a su S canónica.
- **El cajón del panel cerrado (≤1100 px) ya no es tabulable** (`visibility`
  con la transición respetada), el botón «⚙ Panel» anuncia su estado
  (`aria-expanded`) y `Esc` lo cierra.
- **Contrastes WCAG AA**: los botones destructivos pasan de 4.13:1 a 5.92:1
  (`--color-danger: #f4778c`), el texto secundario pequeño a ≥4.6:1
  (`--text-dim`/`--text-muted` aclarados), la pista de los sliders a 3.21:1
  (token nuevo `--slider-track`) y el ⚙ del borrador crece a 24×24 px.
- **Nombres accesibles**: `label` real en los sliders de Texto y Zoom,
  `aria-label` en el picker de color del trazo, `<h1>` en el nombre de la app
  y los emoji decorativos de los botones con `aria-hidden`.
- **La caché de imágenes del Renderer se poda** contra la escena y el
  historial (antes cada data-URL pegado quedaba retenido para siempre) y
  registra `onerror`.
- «Limpiar todo» resetea también los defaults de Edificios/Jardín (antes el
  siguiente guardado de preferencias resucitaba la configuración recién
  borrada). Los seeds corruptos de un JSON manipulado se re-siembran; el
  autosave hace flush en `pagehide`; `HEX_RE` solo acepta longitudes hex
  válidas en CSS; feedback si falla la lectura de un archivo de imagen.
- **Build del publicable**: el aplanado de rutas se verifica (error ruidoso si
  no casa), `dist/` se construye en `dist.tmp` y se sustituye solo al acabar,
  y ningún `.DS_Store` viaja al publicable.
- Documentación: el README ya no se contradice en el número de tests, las
  rutas `js/` → `src/js/` rancias de comentarios y docs vivas están al día,
  `GARDEN_MODALS` → `VARIANT_MODALS` en los comentarios que lo citaban, y
  PLAN.md declara su condición de documento histórico.

### Cambiado

- `buildSidebar` construye los botones con `createElement`/`textContent` —
  desaparece el único `innerHTML` interpolado del proyecto.
- `.app` usa `100dvh` con fallback a `100vh` (la barra de URL móvil recortaba
  el pie del panel); token muerto `--color-accent` eliminado.

## [2.1.1] — 2026-08-08

### Cambiado

- **Todas las imágenes viven ahora en `src/img/`**, junto a `src/scss/` y
  `src/js/`: el juego de iconos, `favicon.ico`, el logo de la topbar, el PNG
  fuente y las capturas del README. Desaparecen las carpetas `icons/` y
  `docs/` y no queda nada con forma de imagen en la raíz.
- `npm run build` aplana `src/img/` a `dist/img/` igual que ya hacía con
  `src/js/` → `dist/js/`, y reescribe también las rutas de
  `site.webmanifest` (sus `src` se resuelven relativos al propio
  manifiesto, no al documento).
- Las capturas del README pasan a llamarse `screenshot-*`: es el prefijo por
  el que `IMG_SKIP` las deja fuera del publicable.
- Guard en `tests/smoke.test.js`: no puede haber imágenes fuera de
  `src/img/`. Una suelta en la raíz funcionaría en desarrollo y
  desaparecería del publicable, porque el build solo conoce esa ruta.

## [2.1.0] — 2026-08-08

### Añadido

- **Icono propio de la app, en todos los formatos que piden los sistemas.**
  Sustituye al favicon inline (un `✎` sobre un cuadrado turquesa, dibujado
  como data URI en el `<head>`) por el juego completo generado desde
  `icons/icon-source-512.png`: `favicon.ico` multi-resolución (16/32/48),
  `icons/favicon-16x16.png`, `-32x32`, `-48x48`, `icons/icon-192.png`,
  `icons/icon-512.png`, `icons/apple-touch-icon.png` (180 px) y
  `icons/icon-maskable-512.png`.
- **`site.webmanifest`** con nombre, colores de marca y los cuatro iconos, de
  modo que la app se puede instalar en el escritorio o en la pantalla de
  inicio con su propio icono en lugar de una captura del sitio.
- Guard en `tests/smoke.test.js`: todo icono referenciado por el `<head>`, por
  el manifiesto o por la barra superior existe en disco y mide lo que declara
  su `sizes`.
- `npm run build` copia `icons/`, `favicon.ico` y `site.webmanifest` a
  `dist/` (el PNG fuente se queda fuera del publicable).

### Cambiado

- **La marca de la barra superior es ahora el icono real**
  (`icons/logo-96.png`, a 96 px para pantallas 2x) en lugar del glifo `✎`
  sobre un cuadrado con degradado. Es decorativa (`alt=""`): el nombre
  «Pizarra» va justo al lado.

## [2.0.0] — 2026-08-08

Salto de versión mayor: consolida el cambio de stack de desarrollo iniciado en
la 1.25.0 — estilos en **SCSS (BEM) compilados con Gulp 5 + dart-sass**, fuente
en `src/`, publicable minificado en `dist/` y toolchain de stylelint/terser. La
app en runtime sigue siendo la misma (cero dependencias, clonar y abrir), pero
la forma de desarrollarla ya no: `css/styles.css` es un artefacto y editarlo a
mano está vetado.

### Corregido

- **Los nombres del sidebar ya no se parten por dentro de la palabra ni pisan
  su icono.** «Rectángulo» salía como «Rectán / gulo» y los nombres de varias
  líneas se montaban sobre el icono: el `overflow-wrap: anywhere` partía por
  cualquier carácter y el botón tenía altura fija y 52px de ancho para
  palabras que en OpenDyslexic miden 58. El botón pasa a 6.8rem con
  `min-height`, sin letter-spacing en el nombre; los anchos del sidebar
  (72/132px) no cambian. Ver `BUGS.md`.
- `.panel__select` usaba `var(--text-main)`, que no existe (la real es
  `--text-primary`): la declaración se descartaba en silencio y el `<select>`
  heredaba el color del padre. Era el fix aparte que dejó programado la
  migración a SCSS de v1.25.0. Ver `BUGS.md`.
- El export HTML interpolaba la familia tipográfica (`SKETCHY_FONT`, leída de
  `--font-sketch`) sin sanear dentro de su `<style>`; era la única
  interpolación del exporter sin defensa. Ahora `FONT_CSS` descarta `<>{};`
  (no se puede cerrar la etiqueta ni inyectar reglas) y `FONT_FALLBACK`
  descarta también `<>&` para los atributos XML del SVG. Ver `BUGS.md`.

### Tests

- Guardia general nueva en `tests/smoke.test.js`: **toda custom property usada
  en `css/styles.css` está definida** — un `var()` con nombre equivocado no
  falla en ningún sitio por sí solo.
- Guardia en `tests/exporter.test.js`: una `--font-sketch` envenenada no puede
  cerrar el `<style>` del HTML exportado (config.js se carga con un
  `getComputedStyle` manipulado).
- Guardia e2e en `responsive.spec.js`: en ambos modos del sidebar, ningún
  nombre desborda su caja, invade su icono ni se sale del botón.
- `BUGS.md` y `CHANGELOG.md` normalizados a markdownlint (líneas en blanco
  alrededor de títulos y listas; `.markdownlint.json` nuevo con `MD024
  siblings_only` para los títulos repetidos del formato Keep a Changelog);
  sin cambios de contenido. Cache-busting (`?v=`), insignia del topbar y
  badges del README sincronizados con la versión. **399 unitarios + 26 e2e.**

## [1.25.0] — 2026-08-08

### Cambiado

- **Los estilos se desarrollan en SCSS (BEM) y se compilan con Gulp 5 +
  dart-sass.** El antiguo `css/styles.css` monolítico pasa a ser un artefacto
  generado desde `src/scss/` — 18 ficheros que respetan el orden literal del
  original: un parcial por bloque BEM con sus propias media queries, más
  `abstracts/` con los tokens de diseño (`_variables.scss`), las tipografías
  (`_fonts.scss`), los breakpoints y los mixins. El CSS compilado **sigue
  commiteado en la misma ruta**, así que clonar y abrir `index.html` funciona
  igual que siempre y la app conserva sus **cero dependencias en runtime**;
  Node solo hace falta para desarrollar. La equivalencia con el CSS anterior
  se verificó con un diff normalizado que resuelve los valores computados:
  mismas 141 reglas, mismo resultado.
- **Todas las distancias de la interfaz están ahora en `rem`, con 1rem =
  10px** (raíz al 62.5%, `body` restaura los 16px efectivos): si se sube el
  tamaño de fuente del navegador, la interfaz escala con él — mejora real de
  accesibilidad. Los breakpoints de las media queries y las coordenadas del
  lienzo (px de canvas, fijadas por JS) se quedan en px a propósito.
- **Las tipografías se cambian en un único sitio:**
  `src/scss/abstracts/_fonts.scss` declara `$font-ui` y `$font-sketch`, de ahí
  salen las custom properties del CSS, y ahora también el lienzo:
  `SKETCHY_FONT` (config.js) lee `--font-sketch` en runtime (con su literal
  como resguardo para el harness de tests) y `FONT_FALLBACK` (exporter.js) se
  deriva de ella sin comillas para los atributos XML del SVG exportado. Antes
  la misma familia estaba escrita 4 veces en 3 ficheros con 3 sintaxis.
- **La interfaz usa OpenDyslexic**, una tipografía diseñada para lectores con
  dislexia, en lugar de IBM Plex Sans. Va **autoalojada** en `fonts/`: cuatro
  woff2 (Regular, Bold, Italic y BoldItalic) generados con fontTools a partir
  de los OTF oficiales aportados por el usuario — familia clásica derivada de
  Bitstream Vera, con su licencia al lado — así que funciona sin red y
  abriendo por `file://`. Sus `@font-face` viven en
  `src/scss/base/_font-faces.scss` y el `<link>` de Google Fonts queda solo
  para Architects Daughter, la manuscrita del lienzo. Como OpenDyslexic es
  más ancha, las etiquetas de la barra estrecha parten ahora las palabras
  largas en dos líneas («Semicírculo» se recortaba por los lados).

### Añadido

- **La app fuente vive en `src/`**: `src/scss/` (estilos) y `src/js/` (los
  14 módulos, movidos desde la raíz; `index.html` apunta ahora a
  `src/js/*.js`). `index.html` se queda en la raíz — el harness de tests,
  Playwright y el «clonar y abrir» lo anclan ahí.
- **`dist/`, el publicable minificado**: `npm run build` deja en `dist/` la
  app lista para desplegar — LICENSE tal cual, index.html con las rutas
  `src/js/` aplanadas a `js/` (la única transformación de HTML que existe),
  el CSS recompilado comprimido (24K → 16K) y el JS minificado con terser
  (396K → 172K) conservando nombres de fichero. Va sin versionar: se
  regenera cuando se necesita. Los `src/js/` no se transforman nunca en el
  árbol fuente — son los que leen el harness de tests y el navegador en
  desarrollo.
- **Toolchain de desarrollo**: Gulp 5 (`build`/`build:css`/`watch:css`) con la
  API moderna de Sass —sin plugins intermedios, sin sourcemaps, sin
  autoprefixer, salida determinista—, terser para el `dist/` y stylelint
  (`stylelint-config-standard-scss` con el patrón de clases ajustado a BEM y
  notación de color legacy a propósito, para no reescribir el CSS heredado).

### Tests

- Guardia nueva en `smoke.test.js`: `css/styles.css` debe ser el artefacto
  compilado (banner), conservar la convención `1rem = 10px`, las custom
  properties responsive (`--sidebar-w` 7.2/13.2rem), las cuatro media queries,
  los selectores vendor sin agrupar y — la clave — **la familia de
  `--font-sketch` idéntica al resguardo de `SKETCHY_FONT`**, porque en
  navegador una divergencia sería invisible para el harness. Verificada
  contra el código roto (cambiar la familia solo en el CSS la tumba).
  **397 unitarios + 25 e2e.**
- Conocido (fix aparte): `.panel__select` usa `var(--text-main)`, que no
  existe. Se migró tal cual para que esta versión no cambie ni un byte de
  comportamiento; corregirlo lleva su propia entrada en BUGS.md.

## [1.24.0] — 2026-08-08

### Cambiado

- **La inclinación del camino se marca de un clic, no manteniendo Shift.** El
  ángulo libre llegó en la v1.23.0 atado a Shift+arrastrar, que es un gesto de
  **dos manos**: quien solo puede usar una se quedaba fuera de la función
  entera. Ahora es un ajuste pegajoso, **«Cualquier inclinación»**, con casilla
  en el propio catálogo de Camino y gemela en el panel «Jardín», que se
  recuerda entre sesiones. Shift sigue valiendo, pero como atajo opcional para
  inclinar un camino suelto sin tocar la casilla.

### Añadido

- **El ancho del camino se cambia desde el propio catálogo.** Con el camino
  inclinado el arrastre ya no deja lado corto que leer, así que el ancho solo
  puede venir del deslizador — y estaba únicamente en el panel, que por debajo
  de 1100px ni siquiera se ve (es un cajón). Ahora hay un gemelo dentro del
  modal de Camino, junto a una **miniatura en vivo** que enseña el ancho y la
  inclinación activos antes de dibujar nada, siguiendo el patrón de Fachada.
  Los iconos del catálogo siguen pintándose en modo caja a propósito: distinguen
  el trazado (serpenteante/recto, liso/empedrado), no el ángulo.
- **El ángulo se ve mientras dibujas.** Con la inclinación libre, el ángulo es
  lo único que decide el gesto y nada lo decía: acertar una diagonal concreta
  era a ojo. Ahora sale rotulado junto al puntero durante el arrastre (0° a la
  derecha, positivo hacia arriba), y desaparece al soltar — vive en la capa de
  previsualización, así que no es un elemento ni entra en el dibujo. En modo
  caja no aparece: ahí el camino solo puede salir a 0° o 90°.

### Tests

- Cuatro guardias nuevas en `app-interaction.test.js`: el trazado en diagonal
  sin tocar el teclado (y su persistencia en prefs), el ancho cambiado desde el
  modal llegando al camino inclinado, el reparto correcto entre iconos (modo
  caja) y miniatura (inclinada), y el rótulo del ángulo —presente a 45°, ausente
  en modo caja—. Verificadas contra el código roto: ignorar el ajuste pegajoso
  tumba tres, quitar el `opts` propio del catálogo tumba la del catálogo, y
  tanto no pintar el rótulo como pintarlo siempre tumban la del ángulo.
  **396 unitarios + 25 e2e.**

## [1.23.0] — 2026-08-07

### Añadido

- **El camino puede trazarse en cualquier ángulo.** Por defecto, el arrastre
  de Camino sigue leyéndose como caja —el lado largo es el recorrido y el
  corto, el grosor, tal cual desde v1.21.0—. Manteniendo pulsado **Shift**
  durante el arrastre, el recorrido pasa a ser el vector exacto del gesto, a
  cualquier inclinación; como ya no queda lado corto que leer, el grosor sale
  en ese modo del ajuste **«Ancho del camino»** del panel, igual que ya
  ocurría con un clic o una línea recta. El mecanismo reutiliza el mismo
  patrón que `curveFlip` (Shift durante el trazado de una flecha curva):
  `state.pathFreeAngle` se fija en los mismos tres puntos del gesto y se
  reinicia al soltar, para que el catálogo de Camino no herede el ángulo del
  último arrastre en sus iconos. De propina, el aplastamiento de los cantos
  del empedrado (`rx`/`ry`) pasa de un `if` horizontal/vertical a una fórmula
  continua: en ángulo libre no hay un salto visible justo a 45°, y ahí los
  cantos salen casi redondos.

### Tests

- Seis guardias nuevas en `garden.test.js` (dirección exacta a varios
  ángulos, el ancho lo manda `pathWidth` y no un lado corto inexistente, el
  clic sin arrastrar no cambia con el flag, los cantos siguen cabiendo entre
  los bordes en diagonal, y el redondeo del empedrado en diagonal) y dos en
  `app-interaction.test.js` (el gesto real con Shift frente a sin Shift, y que
  el modo libre no se filtra a los iconos del catálogo al reabrirlo). El
  helper `tests/helpers/load-app.js` ahora expone `context.Garden` y el resto
  de `KNOWN_GLOBALS` (vía `loadScript`, igual que `loadAll()`), necesario para
  la segunda guardia. **392 unitarios + 25 e2e.**

## [1.22.1] — 2026-08-07

### Arreglado

- **«Limpiar todo» reinicia el tamaño del borrador.** El botón ya devolvía el
  fondo, la cuadrícula, el solapamiento y el zoom a sus valores por defecto,
  pero olvidaba `state.eraserSize`: si se había cambiado el tamaño del
  borrador, seguía con ese valor tras limpiar en vez de volver a 16px.

### Tests

- Guardia en `app-interaction.test.js` para el reinicio del tamaño del
  borrador al pulsar «Limpiar todo». **384 unitarios + 25 e2e**.

## [1.22.0] — 2026-08-07

### Añadido

- **Modal de tamaño del borrador.** Elegir la herramienta Borrador abre un
  modal con una previsualización más grande del círculo real y su propio
  deslizador, igual que Planta o Balcón abren su catálogo al elegirlos; un
  botón ⚙ junto al slider "Tamaño del borrador" del panel lo reabre sin
  soltar la herramienta. Ambos controles quedan sincronizados, como los
  gemelos de Edificios. A diferencia de los catálogos, cerrarlo no devuelve a
  la herramienta anterior: el borrador ya es usable con el tamaño que tenga.

### Cambiado

- **El borrador recorta recta, flecha y trazo a mano en vez de borrarlos
  enteros.** Pasar el borrador por el centro de una línea, o justo por donde
  se cruzan dos trazos, ya solo se lleva el tramo bajo el círculo: lo demás
  sobrevive partido en tantos trozos como haga falta. Una flecha solo sigue
  siendo flecha en el trozo que conserva su punta original; cualquier otro
  trozo pasa a línea suelta, sin inventar una punta en el corte. El resto de
  tipos (formas, texto, imágenes, componentes, curvas) sigue el borrado
  entero de siempre — recortar el contorno de una forma o una curva Bézier
  de forma exacta queda fuera de alcance.

### Tests

- Cobertura de `Eraser.erase()`: recorte de recta y flecha (con y sin doble
  punta), trazo con hueco en medio, la intersección de dos trazos que ya no
  se borra entera, y que el resto de tipos sigue eliminándose entero.
  Gestos reales en `app-interaction.test.js` para el recorte y para el modal
  de tamaño. **383 unitarios + 25 e2e**.

## [1.21.0] — 2026-08-07

### Cambiado

- **El grosor del camino vuelve al ratón.** El arrastre se lee otra vez como
  caja: el lado largo es el recorrido y el corto, el grosor, así que moviendo el
  ratón arriba o abajo el camino engorda mientras se dibuja. Es la única forma
  de sacar las dos cosas de un solo gesto —un arrastre da dos datos, y el
  tercero tendría que venir de una tecla o de un segundo paso—, y por eso
  **se revierte el trazado en diagonal** que estrenó la 1.19.0: entre las dos,
  el grosor a mano pesa más.
- El **ancho del camino** del panel pasa a ser lo que dice su nombre: el ancho
  por defecto, el que se usa cuando el arrastre no lo da (un clic o una línea
  recta). El que sale del arrastre no se acota: ahí se ve exactamente lo que se
  dibuja.
- **El empedrado gana hileras al ensanchar el camino, en vez de piedras más
  gordas.** Con dos hileras fijas, un camino de 90 px salía con cantos de medio
  metro y se leía como una hilera de globos; ahora entra una hilera por cada
  17 px de ancho, con el total acotado para que un camino de punta a punta no
  suelte cientos de piezas.

### Tests

- Las guardias de camino se reescriben para la caja: el recorrido por el lado
  largo, el grosor creciendo al bajar el ratón, el ancho del panel como
  reserva, los cantos entre los bordes en los dos sentidos y a cualquier ancho,
  y la nueva —más cantos, no más gordos—. **365 unitarios + 25 e2e**.

## [1.20.0] — 2026-08-07

### Añadido

- **Ancho del camino**, en el panel «Jardín» (8–120 px). Al pasar el arrastre a
  ser el recorrido (1.19.0) desapareció el lado corto de la caja, que era de
  donde salía el ancho: el camino quedó sin forma de ensancharse o estrecharse.
  Es un default de creación, como el resto de la sección, y **se recuerda entre
  sesiones**. El número sigue al dedo mientras se mueve el slider, y si hay un
  camino en curso la previsualización se actualiza en el momento.

### Tests

- 4 guardias nuevas: el ancho pedido es el que separa los bordes, se acota a
  los topes, se conserva a cualquier inclinación, y el rango del slider coincide
  con el que aplica `js/garden.js` (que ahora lo exporta justo para poder
  compararlo). Más la del panel: mueve el control, dibuja y comprueba que el
  camino sale con ese ancho y que vuelve puesto al recargar. **366 unitarios +
  25 e2e**.

## [1.19.0] — 2026-08-07

### Añadido

- **Los caminos del Jardín se trazan en cualquier inclinación.** El arrastre ya
  no es una caja: **es el recorrido**, así que el camino sale en la dirección
  del gesto —vertical, horizontal o en cualquier diagonal— en vez de limitarse
  a los dos ejes. Un sendero de jardín cruza en diagonal tan a menudo como en
  horizontal. Un clic sin arrastrar sigue dando el camino vertical por defecto.

### Cambiado

- El ancho del camino pasa a ser una fracción acotada de su recorrido (antes lo
  daba el lado corto de la caja, que ya no existe): un sendero largo no sale
  como un hilo ni uno corto como una plaza.
- Los iconos del catálogo de Caminos se dibujan en diagonal, que es justo lo que
  la herramienta hace.
- Sigue habiendo **una sola geometría**, no una por orientación: se calcula en
  coordenadas de camino y se gira al lienzo, de modo que el empedrado comparte
  con los bordes la misma y única onda a cualquier ángulo.

### Tests

- Las guardias de camino pasan a barrer varios ángulos (0°, 90°, 30°, −45°,
  135°, 180°, −120°): la dirección y el sentido de los bordes, el giro completo
  del serpenteante y —la más valiosa— que los cantos siguen cabiendo entre los
  bordes sea cual sea la inclinación. Un signo suelto en la normal es invisible
  en horizontal y las tumba en cuanto se gira. **362 unitarios + 25 e2e**.

## [1.18.1] — 2026-08-07

### Cambiado

- **Los caminos del Jardín nacen en vertical** y, sobre todo, **corren por el
  eje largo del arrastre**: arrástralo a lo alto y el sendero baja; a lo ancho,
  cruza. Antes el recorrido estaba clavado en la horizontal, así que un
  arrastre alto daba un camino aplastado dentro de una caja que no le
  correspondía. En un plano de jardín un sendero baja tan a menudo como cruza.
  El icono del catálogo, que es la geometría real, lo refleja.
- La geometría sigue siendo **una sola**: se calcula en coordenadas de camino
  (fracción del recorrido × desvío del eje) y se lleva al lienzo con un
  mapeador, de modo que el empedrado sigue compartiendo con los bordes la misma
  y única onda.

### Tests

- 2 guardias nuevas: el camino sigue el eje largo del arrastre (recto y
  serpenteante) y los cantos caben entre los bordes también en vertical —el
  gemelo en el otro eje de la guardia que ya existía—. **362 unitarios + 25
  e2e**.

## [1.18.0] — 2026-08-07

Nueva herramienta **Balcón** en la sección Edificios, con 8 tipos.

### Añadido

- **Balcón** (sección Edificios): barandilla arriba y losa volada abajo, en
  alzado como la puerta y la ventana. Ocho tipos en su catálogo — **de
  barrotes, francés, de forja, balaustrada, corrido, acristalado, terraza y
  mirador**—, cada uno con su propia proporción al hacer clic sin arrastrar (un
  mirador nace alto; un balcón corrido, largo). Como el resto de la sección es
  **solo de creación**: cada arrastre produce rect/line/circle/curveArrow
  corrientes, así que exportación, undo, JSON y selección de grupo funcionan sin
  código específico.
- Su catálogo estrena en Edificios el patrón del Jardín: **el icono es el dibujo
  real** que sale al arrastrar, pintado por la misma geometría, así que no puede
  desincronizarse de la herramienta.
- El tipo elegido **persiste en las preferencias**, como los otros cinco de la
  sección.

### Cambiado

- La tabla de modales de variante (`VARIANT_MODALS` en `app.js`) deja de ser
  exclusiva del Jardín: ahora describe también el catálogo del Balcón, con el
  módulo generador y el constructor de opts como campos. Los cinco catálogos
  antiguos de Edificios siguen con su icono SVG a mano, a propósito: no son
  uniformes entre sí y su comportamiento no está fijado por tests.
- **Balcón no tiene atajo de teclado**, como Caminos y Aromáticas: las 26 letras
  y los 10 dígitos ya estaban asignados, y `F Q D S` las usan las acciones de
  flecha curva. Queda fijado por un test para que el hueco no crezca por
  descuido.

### Tests

- 13 guardias nuevas: geometría de los ocho tipos, la panza de la forja, las
  ménsulas del corrido, cajas por variante, ningún rect degenerado en balcones
  diminutos, «dos tipos nunca se dibujan igual» (la misma guardia que el
  jardín), el catálogo del modal y la persistencia del tipo elegido.
  **360 unitarios + 25 e2e**.

## [1.17.1] — 2026-08-07

Auditoría severa del código completo: **19 defectos corregidos**, cada uno con
su entrada en `BUGS.md` y su guardia de regresión probada contra el código
roto (14 tests nuevos en `tests/`, 4 en `e2e/`).

### Corregido

- **Atajos y foco.** Cambiar un `<select>` del panel («Solapamiento»,
  «Plantas»…) dejaba muertos todos los atajos hasta clicar en otro sitio;
  `Shift+R` sobre una selección sin formas rotables activaba Rectángulo y
  perdía la selección; `?` abría la Ayuda apilada sobre otro modal; y `Ctrl+V`
  pegaba clones detrás de un modal abierto cambiando además la herramienta.
- **Historial de undo.** Elegir color de relleno arrastrando por el diálogo
  nativo apilaba un paso por cada tono pisado (podía vaciar el historial de un
  gesto), y mantener pulsado `+`/`−`/`F`/`Q`/`D`/`S` sobre una curva apilaba
  ~30 pasos por segundo. Ahora todo gesto es un único paso, como el grosor y
  la opacidad.
- **Selección de flechas.** Las esquinas del bbox de una flecha seleccionada
  eran handles de resize invisibles: clicar en espacio vacío junto a una
  esquina escalaba la flecha en vez de deseleccionar.
- **Borrador.** El interior de una forma rellena contaba como tinta por su
  caja, no por su silueta: la esquina del bbox de un círculo relleno lo
  borraba desde ~15 px de distancia de cualquier tinta. Y un polígono
  degenerado (tamaño cero, llegado de datos externos) era imborrable.
- **Dibujo.** Un rectángulo redondeado menor de 24 px salía autointersecado
  (el radio no se acotaba al lado); el círculo del borrador quedaba fantasma
  en el overlay al cambiar de herramienta por teclado; y la previsualización
  del modo cadena ignoraba «Ajustar a cuadrícula» aunque el commit sí snapeaba.
- **Exportación.** El HTML exportado perdía el orden de capas entre vectores y
  componentes (toda flecha quedaba debajo de todo card); un color `#rrggbbaa`
  importado rompía los tintes de botones/inputs/cards en canvas y en los
  exports (fondos negros en SVG); la validación del import aceptaba `w/h ≤ 0`
  y `fontSize ≤ 0` (elementos que se veían en canvas y desaparecían del
  SVG/HTML); y un fallo de lectura del archivo dejaba el import colgado sin
  avisar. La validación endurecida se verificó contra 4.740 elementos de todas
  las variantes de Edificios y Jardín: cero rechazos, ningún proyecto guardado
  pierde piezas.
- README: Caminos también es herramienta sin atajo, no solo Aromáticas.

### Herramientas

- Eliminado el código muerto del export (`'eraser'` inalcanzable en
  `VECTOR_TYPES`/`_svgElement`) y la copia duplicada de `distToSegment` en
  `app.js` (ahora delega en `Eraser.distToSegment`).
- El stub de `FileReader` del arnés sabe simular un fallo de lectura
  (`{ error: true }`).
- Suites: **347 tests unitarios** y **25 e2e**.

## [1.17.0] — 2026-08-07

### Añadido

- **Botón «Caminos» en el Jardín, con cuatro trazados.** El camino tiene ahora
  dos ejes independientes: puede ser **serpenteante o recto** y **liso o
  empedrado**, en sus cuatro combinaciones. El empedrado son cantos irregulares
  a matajunta que siguen exactamente la ondulación de los bordes, con el tamaño
  que manda el ancho del camino —como en un empedrado de verdad—, así que un
  camino largo lleva más piedras, no piedras más grandes.
- Los caminos **salen de «Decoración» a su propio botón**: siendo cuatro,
  ocupaban la mitad de aquel catálogo y tapaban el resto de piezas. Sin atajo de
  teclado, como Aromáticas: las teclas sueltas libres están agotadas y ninguna
  de las que quedan puede usarse sin pisar una acción de flecha curva.
- **Reloj de sol** en Decoración, en sus dos formas: **de suelo** (sobre su
  pedestal, con la corona horaria y el gnomon apuntando al norte) y **de pared**
  (colgado de un muro, con el cuadrante abierto hacia el sur). Como todo el
  Jardín, en vista de planta.
- **Parcela cuadrada** en «Forma del jardín». Es la única variante que impone su
  proporción: toma el lado menor del arrastre y se centra en él, sin salirse
  nunca de lo que se marcó.

### Cambiado

- La guardia *"dos variantes nunca se dibujan igual"* compara también la
  **proporción**, no solo qué piezas hay: la parcela cuadrada lleva exactamente
  las mismas que la rectangular y aun así son dos opciones distintas de un
  vistazo. Sin eso, la primera variante que se eligiera por su forma habría
  hecho saltar el test sin haber nada roto.

### Herramientas

- **Suite end-to-end en un navegador real** (`e2e/`, Playwright): 21 tests que
  cubren lo que el arnés `node:vm` no puede ver por definición —layout, CSS,
  foco y acciones por defecto del navegador—. Casi todos son entradas de
  `BUGS.md` que hasta ahora decían *"verificación manual"*: el alcance del
  scroll con zoom, el editor de texto con zoom ≠ 100 %, el cajón del panel por
  debajo de 1100 px, los modales a 320 px, `Ctrl+Z` después de tocar el panel,
  los atajos con un modal abierto y el auto-ajuste del lienzo. Se ejecuta con
  `npm run test:e2e` (`npm run e2e:install` la primera vez).
- La aplicación **sigue sin dependencias**: `package.json` y `node_modules`
  existen solo para esa suite. `index.html` no ha cambiado y se sigue abriendo
  en el navegador tal cual.

## [1.16.1] — 2026-08-07

### Corregido

- **«Limpiar todo» dejaba el lienzo pequeño en vez de como al abrir la app.**
  En pantallas anchas el lienzo se ajusta solo para aprovechar el espacio, pero
  el botón forzaba el zoom al 100% y dejaba márgenes vacíos alrededor. Peor: lo
  marcaba como elección manual del usuario, así que el ajuste automático se
  quedaba desactivado el resto de la sesión y redimensionar la ventana ya no
  volvía a encajarlo. Ahora limpiar rehace el mismo ajuste que hace arrancar la
  app, que es lo que el botón promete.

## [1.16.0] — 2026-07-25

### Añadido

- **Almendro y algarrobo** en el catálogo de Árbol (Jardín), que pasa de 6 a 8
  especies. Como el resto, en vista de planta y con silueta propia: el almendro
  es una copa clara y abierta con la flor marcada en la periferia; el algarrobo,
  una copa ancha, densa y festoneada con su sombra dentro. El algarrobo nace
  además más grande por defecto (124×112), porque hace copa ancha.
- **Nuevo botón «Aromáticas»** en Jardín, con las matas aromáticas de siempre
  (lavanda, romero, tomillo, salvia, santolina) y las mediterráneas de porte
  arquitectónico (agave, aloe, chumbera). En planta, una roseta de hojas
  puntiagudas no se parece en nada a una mata redonda, y por eso viven aparte.
  Es el **único botón sin atajo de teclado**: `8 9 H X Z` agotaron las teclas
  sueltas libres y las que quedan ya hacen otra cosa.
- **Arbusto** suma los leñosos mediterráneos: **adelfa**, **boj recortado** y
  **lentisco** (de 4 a 7 tipos).
- El jardín queda en **40 variantes** repartidas en seis catálogos.

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

- **`js/app.js` pasa a ser testeable.** Nuevo arnés (`tests/helpers/dom-stub.js` +
  `load-app.js`) que construye el DOM desde el `index.html` real y ejecuta la
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
