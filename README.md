# ✎ Pizarra

**Crea wireframes, diagramas y bocetos con estilo dibujado a mano, directamente en tu navegador.**

![Versión](https://img.shields.io/badge/versi%C3%B3n-1.9.0-blueviolet)
![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e?logo=javascript&logoColor=000)
![Sin dependencias](https://img.shields.io/badge/dependencias-0-brightgreen)
![Tests](https://img.shields.io/badge/tests-206%20%E2%9C%93-brightgreen)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)

Pizarra es una aplicación de wireframing sobre canvas escrita en JavaScript puro: **sin build, sin bundler y sin `node_modules`**. Permite crear bocetos, diagramas y prototipos rápidos directamente en el navegador.

---

## Características

### Dibujo
- ✏️ **Lápiz, líneas, flechas, formas** (rectángulo, redondeado, elipse) con trazo *sketchy* de aspecto manual — determinista: cada elemento guarda su semilla y no "tiembla" entre repintados.
- 🧽 **Borrador real y regulable** (`E`): elimina trazos, rellenos y formas sin
  perforar el fondo ni la cuadrícula. Al seleccionarlo, el control de Trazo se
  convierte en **Tamaño del borrador**, independiente y ajustable de 4 a
  100 px (16 px por defecto); un círculo indica el área exacta y cada pasada
  se deshace o rehace como una sola acción.
- 🔺 **Formas geométricas**: botones para cuadrado (`4`), trapecio (`7`), triángulo (`3`), pentágono (`5`) y hexágono (`6`). Los polígonos regulares se arrastran desde el centro y conservan todos sus lados iguales; el trapecio admite proporciones libres.
- 🪣 **Relleno con color**: selecciona una forma geométrica (círculo/elipse, rectángulos, trapecio o polígonos regulares) y elige su color de relleno; el checkbox la vacía sin perder el color. **Relleno translúcido** alterna entre sólido y transparente, y el regulador permite ajustar su opacidad del **0 al 100 %** (40 % por defecto). Con formas seleccionadas modifica esas formas; sin selección establece el valor de las próximas. Sin color propio se conserva el tinte translúcido clásico del trazo.
- 🫥 **Solapamiento seleccionable**: el modo **Normal** conserva la mezcla de transparencias; **Bordes ocultos** convierte en discontinuos únicamente los tramos del contorno inferior cubiertos por otra forma. Respeta rectángulos, esquinas redondeadas, círculos/elipses, trapecios, polígonos regulares y el orden de capas.
- ◠ **Semicírculos** de 180° exactos y sin puntas: el arrastre fija el diámetro (y con él el radio); después `+`/`−` o su handle ajustan el radio manteniendo la media circunferencia perfecta. `Q` convierte una flecha curva existente en semicírculo y viceversa.
- 🧩 **Componentes UI listos**: botón, input, imagen, navbar y tarjeta, con etiquetas editables (doble click).
- 🙂 **Emoji** (`J`): catálogo de 60 emoji en cinco categorías; elige uno y haz click para estamparlo. Se insertan como texto, así que se mueven, escalan, exportan y editan como cualquier otro elemento.
- 🖼️ **Imágenes reales**: pega desde el portapapeles (`Ctrl/Cmd+V`) o arrastra archivos PNG/JPEG desde el escritorio.
- 📐 **Plantillas**: landing page, dashboard y formulario para empezar en un click.

### Flechas de nivel diagrama
- ↷ **Flechas curvas** con handle de curvatura: Shift al trazar la comba hacia el otro lado, `F` invierte el giro, `+`/`−` ajustan la intensidad, doble click en el handle la resetea.
- ⛓️ **Curvas encadenadas**: un click con Flecha curva fija el inicio; cada click añade otro tramo y `Ctrl`/`Cmd`+click termina la cadena con la punta en el último extremo. `Retroceso` elimina el último tramo, `Esc` cancela y `Enter` termina. El arrastre tradicional continúa creando una curva sencilla.
- 🔀 **Curva en S** (`S`): cúbica con dos puntos de control.
- 🧲 **Conectores anclados**: suelta un extremo sobre un elemento y la flecha se pega a su borde — al mover o redimensionar el elemento, la flecha lo sigue conservando su curvatura.
- 🏷️ **Etiquetas sobre el trazo** (doble click), desplazables a lo largo del trazo (arrastra su handle; doble click en él la re-centra), doble punta, trazo discontinuo, grosor por elemento y dirección invertible (`D`).

### Edición
- 👆 Selección múltiple (Shift+click, marquee, `Ctrl/Cmd+A`), mover, duplicar (`Ctrl/Cmd+D`), redimensionar con handles y nudge con flechas. El grupo seleccionado se arrastra desde cualquier punto de su marco combinado, incluido el espacio vacío entre elementos.
- ↻ **Rotación por pasos** desde el panel o con `Shift+R`: cuadrados 45°; trapecios, triángulos, rectángulos y redondeados 90°; pentágonos 36° y hexágonos 30°. En una selección múltiple, cada forma compatible usa su propio paso.
- 📋 **Copiar y pegar** la selección con `Ctrl/Cmd+C` / `Ctrl/Cmd+V` — también entre pestañas. Lo pegado aparece desplazado, queda seleccionado y las flechas ancladas se re-vinculan a sus clones.
- ↩️ Undo/redo con historial de 50 pasos (`Ctrl+Z` / `Ctrl+Y` / `Cmd+Shift+Z`).
- 🧮 Cuadrícula con ajuste opcional (Alt lo desactiva al vuelo) y zoom 30–300%, con auto-ajuste al espacio disponible en pantallas anchas.
- 🧰 **Barra de herramientas responsive**: conserva una columna hasta 1200 px y se reorganiza automáticamente en dos columnas desde 1201 px para reducir el desplazamiento vertical.
- 🎨 **Fondo y color de cuadrícula personalizables** desde el panel, con persistencia entre sesiones; "Limpiar todo" los devuelve a su valor original.
- 💾 **Autoguardado** en localStorage: tu trabajo sobrevive al refresco.

### Exportación
| Formato | Detalle |
|---------|---------|
| **PNG / JPG** | Imagen rasterizada del lienzo limpio |
| **SVG** | Vectorial escalable, fiel al render |
| **HTML** | Página editable con componentes reales + SVG incrustado para los trazos |
| **JSON** | Proyecto reutilizable — expórtalo e impórtalo después (con validación robusta) |

## Inicio rápido

Puedes clonar el repositorio y abrir la aplicación directamente:

```bash
git clone https://github.com/JavierTamaritWeb/pizarra.git
cd pizarra
open index.html
```

También puedes servirla localmente para acceder desde `http://localhost:8000`:

```bash
python3 -m http.server 8000
```

No es necesario instalar dependencias ni ejecutar un proceso de compilación.

## Cómo usar Pizarra

1. Elige una herramienta en la barra lateral o usa su atajo de teclado.
2. Dibuja sobre el lienzo; con **Mover** (`V`) puedes seleccionar, desplazar, redimensionar y duplicar elementos.
3. Personaliza el color, grosor, tamaño del borrador, relleno, cuadrícula y zoom desde el panel derecho.
4. Exporta el resultado como PNG, JPG, SVG o HTML, o guarda el proyecto como JSON para continuar más tarde.

Pizarra guarda automáticamente el lienzo en `localStorage`. Para crear una copia portátil o trabajar en otro navegador, exporta el proyecto como JSON y vuelve a importarlo cuando lo necesites.

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `P` `L` `A` `U` `G` `E` | Lápiz · Línea · Flecha · Flecha curva · Semicírculo · Borrador |
| `R` `O` `C` | Rectángulo · Redondeado · Círculo |
| `3` `4` `5` `6` `7` | Triángulo · Cuadrado · Pentágono · Hexágono · Trapecio |
| `T` `J` `B` `I` `M` `N` `K` | Texto · Emoji · Botón · Input · Imagen · Navbar · Tarjeta |
| `V` | Mover / seleccionar |
| `Ctrl/Cmd+Z` / `Ctrl+Y` o `Cmd+Shift+Z` | Deshacer / rehacer |
| `Ctrl/Cmd+D` / `Ctrl/Cmd+A` | Duplicar / seleccionar todo |
| `Shift+R` | Rotar selección: cuadrado 45° · trapecio/triángulo/rectángulo 90° · pentágono 36° · hexágono 30° |
| `Supr` / `Esc` | Borrar selección / deseleccionar |
| Flechas (+`Shift`) | Mover selección 1px (20px) |
| `F` / `D` / `S` | Invertir giro · invertir dirección · curva en S |
| `Q` | Convertir flecha curva ↔ semicírculo |
| `+` / `−` (+`Shift`) | Ajustar curvatura — en semicírculos, el radio (fino) |
| Clicks + `Ctrl`/`Cmd`+click | Encadenar tramos de Flecha curva · terminar con punta |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+V` | Copiar selección / pegarla (o pegar imagen del portapapeles) |
| `?` | Abrir la ayuda con todos los atajos |

## Arquitectura

```
index.html          Shell de la app (scripts en orden de dependencia)
css/styles.css      Estilos (BEM, tema oscuro)
js/
├── config.js       Constantes: herramientas, colores, tamaños
├── sketchy.js      Primitivas de trazo manual (PRNG determinista por elemento)
├── arc.js          Geometría de arcos circulares (ajuste de cúbica a semicírculo)
├── curve-path.js   Geometría compartida de flechas curvas encadenadas
├── shape-rotation.js Rotación discreta de formas alrededor de su centro
├── regular-polygon.js Geometría de cuadrados, triángulos, pentágonos y hexágonos
├── trapezoid.js     Geometría y rotación del trapecio
├── renderer.js     Render por tipo de elemento + cuadrícula + selección
├── exporter.js     Export PNG/JPG/SVG/HTML/JSON + import validado
├── templates.js    Plantillas predefinidas
└── app.js          Controlador: estado, eventos, undo/redo, conectores
tests/              Suite con el runner nativo de Node (sin dependencias)
```

Principios de diseño:

- **Un solo estado fuente de verdad** (`state.elements`): objetos planos, serializables e inmutables — cada edición produce copias, lo que hace el undo trivial y el autoguardado gratuito.
- **Render determinista**: el jitter del estilo sketchy usa un PRNG sembrado por elemento; el mismo dibujo se repinta idéntico.
- **Import seguro**: todo JSON importado pasa por un validador por tipo de elemento (whitelists, colores hex, data-URLs de imagen restringidas) que además evita inyecciones en los archivos exportados.

## Tests

206 tests con el runner nativo de Node — sin ninguna dependencia:

```bash
node --test tests/                    # suite completa
node --test tests/exporter.test.js    # un archivo
```

Los módulos se cargan en un contexto `node:vm` con stubs de canvas/DOM (ver `tests/helpers/`). La hoja de ruta de mejoras vive en [`PLAN.md`](PLAN.md) y el historial de versiones en [`CHANGELOG.md`](CHANGELOG.md).

## Licencia

[MIT](LICENSE) © Javier Tamarit
