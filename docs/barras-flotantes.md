# Barras de herramientas flotantes (v3.13.0)

El botón **Barras** del topbar (`#btn-float-tools`, clase `float-toggle`)
alterna entre el sidebar fijo de siempre y **cinco paletas flotantes
arrastrables**: Edición · Dibujo · Formas y 3D · UI · Edificios y Jardín.
El reparto vive en **una sola tabla**, `FLOATBAR_GROUPS` (config.js), que
referencia los grupos por su `label` de `TOOL_GROUPS` — identificadores
estables, anclados por `tests/config-templates.test.js`, cuya guarda de
partición exige que cada grupo del sidebar aparezca en exactamente una barra
y en el mismo orden. Un grupo nuevo en `TOOL_GROUPS` sin barra asignada hace
fallar esa guarda en vez de desaparecer del modo flotante en silencio.

## Duplicar con OTRA clase, jamás mover ni compartir `.sidebar__tool`

`#sidebar` no se toca: conserva siempre sus botones (el modo solo lo oculta
por CSS), y `buildFloatbars()` (app.js) construye duplicados con clase
**`.floatbar__tool`**. Compartir la clase rompería tres guardas a la vez sin
que nada lo avisara en el código:

- los asserts vm de `app.$('sidebar').querySelector('.sidebar__tool--active')`;
- el roving de `e2e/keyboard-focus.spec.js`, que exige **exactamente un**
  `.sidebar__tool[tabindex="0"]` en el documento;
- el modo estricto de Playwright: `page.locator('.sidebar__tool[data-tool=…]')`
  con dos coincidencias falla en toda la suite (`helpers.selectTool`).

La factoría compartida es `toolButton(t, block)` y el roving por barra
`wireRovingToolbar(container, tools)` — extraídos de `buildSidebar`, así que
sidebar y barras no pueden divergir en cómo nace un botón.
`updateToolbarActive()` pinta el activo en **dos barridos separados** (uno por
clase BEM): dom-stub no resuelve selectores con coma.

## La visibilidad es CSS puro; el JS no mide la ventana

El modo es la clase **`app--floatbars`** en `.app`, y `_floatbar.scss` decide
dónde actúa: dentro de `bp.from(bp.$panel-drawer + 1)` (= **1101px**) se
muestran `.floatbars` y se oculta `.sidebar`; bajo ese umbral no hay regla
alguna, así que manda el sidebar/cajón de siempre y el interruptor
(`.float-toggle`) ni aparece. El `+ 1` es el complemento exacto del max-width
del cajón (≤1100): si `$panel-drawer` cambia, este lado le sigue solo. No hay
`matchMedia` de anchura en app.js — coherente con que toda la responsividad
del proyecto es CSS —, y de paso el modo queda inerte por construcción en el
arnés vm (dom-stub no aplica estilos).

Tres detalles de estilo con historia: `.floatbars`/`.floatbar` llevan su
regla `[hidden]` (la trampa de siempre: ambos declaran `display`); el bloque
trae su **propia** `text-transform: uppercase` repetida en `button` —
precedente `.ctxmenu`: nace en JS y no puede entrar en el `$ui` de
`_uppercase.scss`, anclado a existir en el HTML por smoke —; y su capa es el
token nuevo `$z-floatbar: 30`, entre el overlay del lienzo (10) y el backdrop
del cajón (40).

## Posiciones efímeras a propósito

Las posiciones y el plegado viven **solo en el DOM** (`style.left/top`, clase
`floatbar--collapsed`): ni en `state` ni en prefs. Recargar restaura la
cascada de fábrica (`floatbarHome(i)`: bajo el topbar, pegadas a la
izquierda, una junto a otra) — es el comportamiento pedido, no un ahorro. Lo
único que persiste es el **modo** (`state.floatToolbars`, en prefs como
`alignGuides`: es un modo de trabajo), y «Limpiar todo» lo devuelve a fábrica
vía `appDefaults()` + `syncAllControls()` → `applyFloatToolbars(state.…)`.
`applyFloatToolbars` no guarda prefs; guarda el click del interruptor — así
las re-aplicaciones de arranque y de «Limpiar todo» no tienen efectos.

Acoplamiento a conservar: **`FLOATBAR_W` (app.js, 84) es el `width: 8.4rem`
de `.floatbar`** — la cascada de fábrica y el clamp calculan con ese número.

## Arrastre, clamp y plegado

El arrastre va por pointer events sobre `.floatbar__handle` (ignorando el
botón de plegar), con `setPointerCapture` y clamp al viewport en cada
fotograma — el patrón de `showContextMenu`, el otro `fixed` posicionado desde
JS. Es **mobiliario, no dibujo**: jamás toca `state`, el undo ni el autosave.
`clampFloatbars()` corre también en el resize (antes del return de
`zoomManual`: el clamp no es cosa del zoom), porque una barra fuera de un
viewport encogido sería irrecuperable — el asa es su única vía de manejo. El
asa se mantiene siempre dentro (`FLOATBAR_MIN_TOP` = bajo el topbar,
`FLOATBAR_HANDLE_H` por abajo), y la barra más alta (Edificios y Jardín, 17
botones) escrolea por dentro (`max-height` en `.floatbar__tools`).

Si el viewport baja de 1101px con el modo activo, el CSS oculta las barras y
muestra el sidebar; al volver a crecer reaparecen **donde estaban en la
sesión** (el DOM conserva sus estilos). Nada de JS.

Accesibilidad: cada barra es `role="toolbar"` con su propio roving tabindex —
cinco paradas de Tab, flechas/Home/End por dentro, el patrón ARIA de un
toolbar por tabstop. Mover una barra es solo de puntero (posición efímera,
sin equivalente de teclado — dicho en la Ayuda); las herramientas conservan
sus atajos de tecla, que no pasan por ninguna barra.

## Guardas

- `tests/config-templates.test.js` — partición exacta 7→5 y rótulos de asa.
- `tests/app-interaction.test.js` — construcción (5 barras, mismas
  herramientas que el sidebar, cascada de fábrica en el DOM), activo pintado
  en ambos juegos, clic flotante = clic de sidebar (modal incluido),
  interruptor persistido en prefs (y **solo** él: ningún otro campo `float*`),
  plegado sin tocar prefs, y «Limpiar todo» a fábrica — además de la foto de
  la guarda grande, que ahora incluye el `aria-pressed` del interruptor.
- `e2e/floatbars.spec.js` — visibilidad real de la conmutación, dibujar desde
  una barra, arrastre y clamp con el ratón, plegado, recarga (modo sí,
  posiciones no), el umbral de 1100px en ambos sentidos y el roving por barra.
