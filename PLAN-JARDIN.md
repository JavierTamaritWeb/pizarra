# PLAN-JARDIN.md — Plan de mejora de la sección Jardín

> Síntesis de dos análisis en paralelo (2026-08-17): carencias de la sección
> leyendo `garden.js`/catálogos/modales/tests completos, e investigación de
> repos de GitHub y fuentes de datos **open source con licencia verificada**
> (criterio de descarte duro pedido por el usuario). Recuentos comprobados
> contra los catálogos reales: hoy 50 especies / 68 variantes en 8 catálogos.
>
> Convención heredada de PLAN.md: prioridad/esfuerzo/archivos por ítem, fases
> ordenadas por dependencia, descartes razonados y estrategia de tests al
> final. Los nombres y rutas vigentes los da CLAUDE.md.

## 0. Invariantes de la casa que atan TODO el plan

Ninguna mejora puede saltarse estas reglas (todas tienen guarda o precedente
de bug documentado en BUGS.md/CLAUDE.md):

- **Cero dependencias de runtime.** Los repos externos son ideas/algoritmos a
  reimplementar en `src/js/` (precedente: perfect-freehand → `freehand.js`) o
  datos a extraer en build/a mano a tablas congeladas. Nunca un `<script>` de
  terceros ni un `npm install` que el runtime necesite.
- **Determinismo estricto en garden.js**: sin `Math.random()`; la
  irregularidad sale de tablas congeladas o de hashes/PRNG con seed
  (`mulberry32` en sketchy.js, `_rnd` por-gota en airbrush.js). Todo
  generador nuevo (Poisson, L-system, tramas) recibe el seed inyectado.
- **Toda herramienta de jardín es de solo-creación**: emite tipos existentes
  (`rect/line/circle/curveArrow/text/polygon`), entra en `CREATION_ONLY_TOOLS`
  (exporter.js) y en la tabla `VARIANT_MODALS` — así render, exports, undo,
  borrador y bounds funcionan sin código nuevo.
- **Los elementos no serializan lo regenerable**: como el aerógrafo (gotas) y
  el lápiz con presión (contorno), una trama o una siembra guarda parámetros
  + seed, nunca los puntos.
- **`gardenMeta` valida con whitelist de longitud exacta y `version === 1`**
  (exporter.js): cualquier campo nuevo exige diseñar la v2 y su convivencia
  con proyectos guardados — se paga UNA vez, en el primer ítem que lo
  necesite (§3.5), no antes.
- **Los ajustes de una herramienta se abren desde la herramienta** (regla
  v1.22.0); los gestos con modificador son aceleradores, nunca única vía
  (regla de una mano); un catálogo nuevo pasa por `VARIANT_MODALS`; cualquier
  `.panel__*` nuevo que se oculte por JS entra en la regla agrupada
  `[hidden]` de `_panel.scss`.
- **Ids históricos que mienten** (`oleander`=romero, `sunflower`=boca de
  dragón, `pittosporum`=jara, `box`=olivo recortado…): no se renombran jamás
  (romperían proyectos guardados). El ítem §3.1 les pone tabla de
  correspondencia en el encabezado de garden.js.

## 1. Resumen ejecutivo

La sección tiene un suelo firme que no hay que tocar: tamaño botánico por
clic, iconos que son la geometría real, determinismo, ficha `gardenMeta`
regenerable, frutales y endemismos bien cubiertos. Sus tres huecos grandes
son: (a) **no produce un plano de verdad** — sin norte, sin escala gráfica,
sin leyenda ni listado de plantación, pese a que la app ya conoce la escala
(`plantPxPerM`) y la especie de cada grupo (`gardenMeta`); (b) **un arrastre
= un ejemplar** — no hay siembra de superficies, setos sobre trazado ni
alineaciones a marco, aunque el aerógrafo (área + dispersión determinista) y
el camino (eje por el lado largo) ya inventaron los dos gestos necesarios;
(c) **añadir una especie cuesta cinco retoques** por las tablas desperdigadas
de garden.js, lo que frena la ampliación del catálogo. El plan ataca (a) en
la fase 1 (barato, muy visible), (b) en la fase 2 (el módulo Poisson-disc es
la pieza nueva que desbloquea siembra Y tramas de suelo), y paga la deuda de
(c) al principio de la fase 3, antes de las especies nuevas y del salto de
calidad de los alzados (L-systems). Referencias externas: solo open source
verificado — MIT/ISC/BSD para código-idea, dominio público/ODbL/CC-BY para
datos; descartes explícitos en §5.

---

## 2. Fase 1 — El plano de verdad (anotación y datos)

Objetivo: que un boceto del Jardín se lea como plano de plantación. Todo son
entradas de catálogo + cases nuevos; sin elemento nuevo, sin gesto nuevo, sin
tocar `gardenMeta`. Ítems independientes entre sí.

### 1.1 Flecha de norte y escala gráfica (Decoración)
- **Prioridad:** alta · **Esfuerzo:** bajo · **Archivos:** `src/js/config.js`
  (DECOR_TYPES), `src/js/garden.js` (`_decorTool`), tests
- Dos variantes nuevas de `DECOR_TYPES`: `north` (círculo + flecha + «N»,
  el reloj de sol ya dibuja un gnomon orientado, garden.js) y `scalebar`
  (barra 0–1–5 m con tramos alternos). La barra lee `o.plantPxPerM` de
  `gardenOpts()` — la escala que la app ya conoce y nada dibuja — así que sus
  segmentos miden metros de verdad y el rótulo dice la escala activa.
- Cuidado: la escala estampada es la del momento de creación (los elementos
  son planos); si el usuario cambia `plantPxPerM` después, la barra vieja no
  se actualiza — documentarlo en el propio rótulo del catálogo, como hace
  Fachada con su cubierta.
- **Guardas:** firma distinta en el test de variantes-nunca-iguales (corre
  solo al añadir la entrada); test propio: la barra a 20 px/m mide el doble
  que a 10 px/m.

### 1.2 Leyenda / listado de plantación
- **Prioridad:** alta · **Esfuerzo:** medio · **Archivos:** `src/js/app.js`
  (recuento + estampado), `index.html` (botón en `#panel-sec-garden` y su
  gemelo en los modales de planta), tests
- El dato ya existe entero: agrupar `state.elements` por `buildingGroupId`,
  leer `gardenMeta.variant`/`tool`, contar ejemplares y componer
  «① Lavanda ×6 · Lavandula angustifolia · H 0,8 m» por especie. Se estampa
  como **elementos `text` ordinarios** en una esquina del lienzo (un grupo
  con `buildingGroupId` propio): al ser elementos normales, sobrevive a los
  cinco exports, al undo y al JSON **sin tocar exporter.js** — la idea del
  listado de plantación de open-garden-planner (GPLv3, solo la idea), hecha a
  la manera de la casa.
- Un solo paso de undo para todo el estampado (patrón «Pintar lo
  seleccionado»). Regenerar la leyenda = borrar el grupo anterior y estampar
  el nuevo (patrón `regenerateGardenGroup`).
- **Guardas:** vm — dos especies × N ejemplares dan la lista correcta, un
  ejemplar mordido por el borrador (fragmentos con el mismo gid) cuenta UNA
  vez; el estampado es un paso de undo.

### 1.3 Piscina (Decoración)
- **Prioridad:** alta · **Esfuerzo:** bajo · **Archivos:** config.js,
  garden.js (`_decorTool`), tests
- El ausente más flagrante del jardín español. Variante `pool` de
  `DECOR_TYPES`: rectángulo de esquinas suaves + borde/andén + trama de agua
  (las ondas del estanque `pond`/`LOBES.pond` son media implementación) +
  escalerilla. Caja por defecto en `byVariant` (~8×4 m a 20 px/m).
- **Guardas:** las genéricas de catálogo (firma, etiqueta, render, validez).

### 1.4 Superficies de parcela: sin césped / grava / mantillo
- **Prioridad:** media · **Esfuerzo:** bajo-medio · **Archivos:** config.js
  (PLOT_SHAPES o un ajuste del modal `#modal-plot`), garden.js (`_plotTool`)
- Hoy `_plotTool` SIEMPRE añade `_grass` — no existe parcela de grava ni
  pradera sin contorno. `_grass` ya es una función separada: el acabado
  (césped/grava/mantillo/desnudo) se convierte en opción del modal de
  Parcela. Grava = stippling determinista (ver §3.0: el módulo Poisson sirve
  aquí; hasta que exista, puntos por hash estilo airbrush); mantillo =
  guiones orientados. Catálogo de tramas de referencia: textures.js (MIT) —
  reimplementación, nunca dependencia.
- La densidad crece con el área, como ya hacen `_grassCount` y el empedrado
  del camino — nunca N fijo escalado (el defecto que §2.1-fase2 corrige).
- **Guardas:** trama regenerada de parámetros+seed (mismo elemento tras
  guardar/cargar); parcela grande lleva más piedras que una chica.

### 1.5 Densificar las masas con el área (`bed`, `hedge`)
- **Prioridad:** media · **Esfuerzo:** bajo · **Archivos:** garden.js
  (`_flowerTool 'bed'`, `_shrubTool 'hedge'`), tests
- Incoherencia interna medible: el parterre usa 7 puntos fijos escalados
  (un macizo de 400 px sale con 7 flores gigantes) mientras césped y
  empedrado densifican con el área. Arreglo: nº de flores/ondulaciones =
  f(w·h) con tope, posiciones por hash determinista del seed de creación
  (patrón `_rnd` del aerógrafo — sin «hervido» al redimensionar: escalar
  mueve las existentes, crecer añade).
- **Guardas:** el doble de área ≥ 1,5× de flores; redimensionar un macizo
  existente no lo re-dibuja entero (afinidad, la guarda del aerógrafo).

---

## 3. Fase 2 — La plantación como herramienta (composición)

Objetivo: pasar de «catálogo de ejemplares» a «herramienta de plantación».
Abre con el único módulo nuevo del plan, del que cuelgan dos ítems.

### 2.0 Módulo `src/js/poisson.js` (Bridson determinista)
- **Prioridad:** alta (desbloquea 2.1 y cierra 1.4) · **Esfuerzo:** bajo ·
  **Archivos:** `src/js/poisson.js` (nuevo, ~80 líneas), `index.html`
  (script tras sketchy), `tests/helpers/load.js` (ALL_FILES/KNOWN_GLOBALS),
  `tests/poisson.test.js`
- Muestreo de disco de Poisson (algoritmo de Bridson) en JS puro, módulo
  hermano de `arc.js`/`freehand.js`: sin DOM, sin `Math.random` — **el RNG se
  inyecta** (`mulberry32(seed)` de sketchy.js), exactamente el diseño de
  kchapelier/fast-2d-poisson-disk-sampling (**MIT verificada**), que se
  reimplementa, no se instala. API: `Poisson.sample(w, h, minDist, rng)` →
  lista de puntos con separación mínima garantizada.
- **Guardas:** determinismo (mismo seed → mismos puntos), separación mínima
  real (test de pares), cota de densidad; guarda de orden de scripts en
  smoke.

### 2.1 Herramienta «Sembrar» (especie × superficie)
- **Prioridad:** alta · **Esfuerzo:** medio-alto · **Archivos:** config.js
  (TOOLS + grupo Jardín, **sin tecla**: no queda ninguna plana, lista
  pinneada en config-templates), garden.js (generador), app.js (gesto +
  gardenMeta), index.html (modal vía `VARIANT_MODALS`), exporter.js
  (`CREATION_ONLY_TOOLS` — la trampa de alta documentada), e2e
- El gesto del **aerógrafo** aplicado a plantas: el arrastre define el área,
  `Poisson.sample` con `minDist = anchura adulta de la especie en px`
  (`plantSize` × `plantPxPerM` — ya existen) coloca los ejemplares, y cada
  punto estampa la marca en planta de la especie elegida (las marcas chicas
  ya existen: `_dot`/`_climberMark`/rosetas). Todo el macizo es UN grupo con
  UN `gardenMeta` (herramienta, especie, área, seed) → regenerable con
  `regenerateGardenGroup`, contable por la leyenda de 1.2 («×23» sale
  gratis), y un paso de undo.
- Decisiones tomadas del precedente aerógrafo: el seed se fija en el
  mousedown (la preview no hierve); un área bajo `MIN_AREA` no crea nada;
  la preview dibuja las piezas reales con `drawPiecesPreview`.
- **Guardas:** vm — determinismo del sembrado, separación ≥ anchura adulta,
  regenerar con otra especie conserva área y seed; e2e — gesto completo y
  recuento en la leyenda.

### 2.2 Seto / hilera sobre un eje (a marco regular)
- **Prioridad:** media · **Esfuerzo:** medio · **Archivos:** garden.js,
  config.js, app.js, index.html
- El **camino** ya resolvió el gesto (eje por el lado largo, `_pathAxis`;
  ángulo libre `_pathAxisFree` con su casilla de una mano). Reutilizarlo para:
  seto continuo que sigue el eje (la masa ondulada de `hedge` extruida a lo
  largo), e hilera de N ejemplares a marco M metros (`plantPxPerM` convierte;
  el marco es un ajuste del modal, p. ej. frutal a 6×6 m). N sale de
  longitud/marco — nunca N fijo.
- **Guardas:** el marco en metros se respeta a cualquier escala; eje
  diagonal (modo libre) coloca la hilera sobre el eje real.

### 2.3 Cota entre plantas
- **Prioridad:** media · **Esfuerzo:** bajo-medio · **Archivos:** app.js
  (o garden.js como variante de Decoración)
- Línea de cota: flecha `heads:'both'` (existe) + rótulo `text` con la
  distancia en metros leída de `plantPxPerM`. Encaje mínimo: variante de
  Decoración cuyo arrastre son los dos extremos y que estampa
  flecha + texto como grupo. Completa el plano junto con 1.1.
- **Guardas:** 100 px a 20 px/m rotulan «5 m»; el rótulo viaja con la cota
  al moverla (grupo).

---

## 4. Fase 3 — Especies y calidad de dibujo

Objetivo: ampliar catálogo y subir el nivel de los alzados. **El orden
importa: 3.1 (deuda) va primero** para que cada especie nueva cueste una
entrada y no cinco retoques.

### 3.1 Pagar la deuda de tablas de garden.js
- **Prioridad:** alta (es lo que abarata todo lo demás) · **Esfuerzo:**
  medio · **Archivos:** garden.js, CLAUDE.md
- Tres pagos, sin cambiar ni un píxel del resultado (guarda de oro:
  snapshot JSON de las 68 variantes antes/después):
  1. **Borrar el `byVariant` muerto** de las herramientas de planta
     (`_plantDefault` nunca devuelve null para especies con ficha completa,
     que son todas — las entradas palm/cypress/carob/hedge/… son
     inalcanzables; solo PLOT y DECOR lo usan de verdad).
  2. **Consolidar las tablas por-tipo desperdigadas** (details, flowers,
     stems, massTop/massHeight, profiles…) en la ficha de especie o en una
     tabla única por catálogo.
  3. **Tabla de correspondencia de ids históricos** en el encabezado
     (`oleander`→romero, `sunflower`→boca de dragón…), para que nadie
     «arregle» un case guiándose por el id.
- Actualizar de paso los recuentos que CLAUDE.md afirma (la guarda de smoke
  solo vigila Ayuda y README).

### 3.2 Especies nuevas, tanda mediterránea
- **Prioridad:** media-alta · **Esfuerzo:** bajo por especie (tras 3.1) ·
  **Archivos:** config.js + garden.js + tests (el alta de especie de siempre)
- Las ausencias con más retorno, por catálogo:
  - **Árbol:** palmito (*Chamaerops humilis*, única palmera autóctona
    europea) y washingtonia — `habit:'palm'` ya tiene builder; cerezo o
    níspero como frutal de hueso/pepita no cítrico.
  - **Aromáticas/gramíneas:** esparto (*Stipa tenacissima*) y un
    *Pennisetum*, con hábito nuevo `'grass'` (el `_tuft` es media
    implementación) — la columna vertebral del paisajismo mediterráneo
    actual.
  - **Arbusto:** seto de ciprés (reutiliza `hedge`).
  - **Parcela/Decoración:** bancal de huerto (rect + surcos, como el `box`).
  - **Tapizantes:** gazania o uña de gato (`habit:'groundcover'`, como el
    tomillo) — dan sentido a la siembra de 2.1.
- **Datos:** dimensiones adultas de **USDA PLANTS (dominio público — la
  fuente más limpia)** contrastadas con el **dump de Trefle (ODbL** — datos
  extraídos a mano a la tabla congelada, una línea de atribución en el
  README**)**. Permapeople (CC BY-SA) solo para contrastar. PFAF no se toca
  (NC).
- **Guardas:** las genéricas del catálogo cubren cada alta; el recuento de
  la Ayuda/README sube solo con la guarda de smoke vigilando.

### 3.3 Alzados con arquitectura de ramas (L-systems)
- **Prioridad:** media · **Esfuerzo:** alto · **Archivos:**
  `src/js/lsystem.js` (nuevo, expansor + tortuga 2D, ~100 líneas),
  garden.js (alzados de árbol/arbusto), tests
- El salto de calidad de los alzados: sustituir las ramas fijas por
  expansión de sistema-L **determinista por construcción** (reglas de
  ramificación por especie, 2-3 iteraciones, ángulos de la ficha). Reglas
  concretas: las tablas del libro **The Algorithmic Beauty of Plants**
  (distribución libre autorizada; las reglas son datos, no código) con
  nylki/lindenmayer (**MIT**) como referencia de implementación. El temblor
  lo sigue poniendo Sketchy desde `el.seed` — el L-system emite las
  `line`/`curve` limpias.
- La parametrización por especie (6-8 números: ángulo, ratio de longitud,
  hijas por nivel) toma el modelo de ez-tree (**MIT**, solo el modelo de
  parámetros — su código es 3D/Three.js).
- Empezar por 2-3 especies caducas (almendro, higuera) donde la estructura
  se ve; extender si convence en navegador (calibración visual, como el
  grano del aerógrafo).
- **Guardas:** determinismo (misma ficha → mismas ramas), cota de piezas
  por árbol (presupuesto de elementos), silueta dentro de la caja botánica.

### 3.4 Editar un grupo vegetal pulsando su herramienta
- **Prioridad:** media · **Esfuerzo:** bajo-medio · **Archivos:** app.js
  (`selectTool` + `VARIANT_MODALS`), tests
- Hoy la edición depende de `#btn-edit-garden`, un botón del panel —
  exactamente el patrón que la casa declara defecto (panel = cajón oculto
  bajo 1100 px). Arreglo con precedente: como `selectedSolid()`, si la
  selección es un grupo vegetal completo, pulsar su herramienta conserva la
  selección y abre el catálogo en modo edición (`editGardenGroupId`). El
  botón del panel queda como segunda vía, no única.
- **Guardas:** vm — grupo completo + pulsar herramienta = editar; grupo
  incompleto o mezcla = comportamiento actual; cancelar no toca el original.

### 3.5 Estacionalidad (floración / invierno) — y `gardenMeta` v2
- **Prioridad:** media-baja (el más caro; hacerlo el último y de una vez) ·
  **Esfuerzo:** alto · **Archivos:** config.js (fichas: `deciduous`,
  `bloomSeason`), garden.js (builders), app.js (`gardenOpts` + modales),
  exporter.js (**migración v1→v2 de la whitelist**), tests
- `plantSeason` como opción global de `gardenOpts()` (igual que `plantView`):
  «floración» dibuja los accents (lo de hoy), «reposo» los omite, «invierno»
  deja a las caducas en `_taperedTrunk` + ramas (ya son piezas separadas en
  `_treeElevation`; con 3.3 hecho, la copa desnuda sale del mismo L-system).
  Función pura de las opciones — determinismo intacto. Idea de UX validada
  en PermaplanT (BSD-3, solo referencia).
- Obliga a la **v2 de `gardenMeta`** (whitelist de longitud exacta +
  `version === 1` hoy): diseñar la migración una vez — v1 se sigue
  aceptando y regenera como «floración».
- **Guardas:** proyecto v1 importa y se dibuja byte-idéntico; round-trip v2;
  invierno de un perenne = mismo dibujo que floración sin accents.

---

## 5. Referencias externas — tabla de licencias y descartes

Regla: **solo open source verificado** (enlace de licencia comprobado
2026-08-17). GPL/AGPL: solo ideas, jamás portar código.

| Fuente | Licencia | Uso en este plan |
|---|---|---|
| kchapelier/fast-2d-poisson-disk-sampling | MIT | Idea/algoritmo → `poisson.js` (§2.0) |
| nylki/lindenmayer | MIT | Referencia de implementación L-system (§3.3) |
| The Algorithmic Beauty of Plants | distribución libre (autores) | Reglas de ramificación como datos (§3.3) |
| dgreenheck/ez-tree | MIT | Solo su modelo de parámetros por especie (§3.3) |
| riccardoscalco/textures (textures.js) | MIT | Catálogo de tramas a reimplementar (§1.4) |
| USDA PLANTS | dominio público | Dimensiones adultas de especies (§3.2) |
| treflehq/dump | ODbL (datos) | Contraste de fichas; atribución en README (§3.2) |
| Permapeople | CC BY-SA 4.0 | Solo contraste (§3.2) |
| cofade/open-garden-planner | GPLv3 | **Solo ideas** (listado de plantación, §1.2) |
| ElektraInitiative/PermaplanT | BSD-3-Clause | Solo ideas (estacionalidad, §3.5) |
| d3/d3-delaunay | ISC | Plan B (Lloyd/Voronoi) si Poisson se queda corto |

**Descartados y por qué:** proctree.js (SIN licencia declarada — todos los
derechos reservados por defecto — y muerto desde 2019); PFAF (CC BY-**NC**-SA,
incompatible); OpenFarm (datos CC0 pero servidores cerrados en 2025 y dominio
equivocado: huerto, no paisajismo); WFO/GBIF (taxonomía sin dimensiones);
bibliotecas de símbolos de stock y ConceptDraw (propietarias — solo mirar
cómo rotula un plano profesional, nunca copiar ficheros); repos de
crosshatching WebGL (raster/3D, no patrón vectorial determinista). No existe
biblioteca Excalidraw de jardinería (verificado en excalidraw-libraries):
publicar una propia desde `variantIcon` es una oportunidad, no un consumo.

## 6. Estrategia de tests

- **Cada alta de catálogo** ya está cubierta por las guardas genéricas
  (variantes-nunca-iguales por firma+proporción, etiqueta centrada, render
  sin lanzar, validez de piezas, iconos con caja botánica) — corren sobre el
  catálogo entero, así que una especie nueva paga cero tests obligatorios y
  uno propio si tiene rasgo distintivo (precedente: el dondiego).
- **Módulos nuevos** (`poisson.js`, `lsystem.js`): test de módulo puro con
  determinismo como primera guarda (mismo seed → misma salida), igual que
  freehand.test.js.
- **La refactorización 3.1 se protege con un snapshot**: JSON de las 68
  variantes (planta y alzado, con seed fijo) antes y después — byte a byte.
- **Los recuentos** de Ayuda/README ya están atados por smoke; CLAUDE.md se
  actualiza a mano en 3.1.
- **e2e solo donde el vm no ve**: el gesto de sembrar (modal + arrastre +
  leyenda), y la calibración visual de tramas y L-systems se hace en
  navegador antes de fijar constantes (precedente: grano 5/densidad 70 del
  aerógrafo, SPEED_SPAN del lápiz).

## 7. Orden de ejecución sugerido

Cada ítem es una versión con su entrada de CHANGELOG, como siempre:

1. **1.1 + 1.3** (norte, escala, piscina) — una tarde, el plano empieza a
   parecer plano.
2. **1.2** (leyenda/listado de plantación) — la funcionalidad «profesional»
   más barata del plan.
3. **2.0 + 1.4 + 1.5** (Poisson + suelos + densificar masas) — el módulo
   nuevo y sus dos primeros clientes.
4. **2.1** (Sembrar) — el cambio de categoría de la sección.
5. **3.1** (deuda de tablas) — antes de ninguna especie nueva.
6. **3.2** (tanda mediterránea de especies) + **2.2/2.3** (seto/hilera,
   cotas) en el orden que apetezca.
7. **3.4** (editar desde la herramienta).
8. **3.3** (L-systems) y por último **3.5** (estacionalidad + gardenMeta v2).
