'use strict';
/* ============================================================
   playwright.config.js — Suite end-to-end en un navegador de verdad.

   COMPLEMENTA a `node --test tests/*.test.js`, no la sustituye. El arnés
   `node:vm` (tests/helpers/load-app.js) es rápido y prueba la lógica; lo que
   NO sabe hacer es layout, CSS, foco real ni acciones por defecto del
   navegador. Justo eso es lo que se prueba aquí, y por eso los specs de
   `e2e/` corresponden casi uno a uno con las entradas de BUGS.md que estaban
   marcadas como "solo verificables manualmente".

   Regla para decidir dónde va un test nuevo:
     · ¿Coordenadas, undo, exportación, geometría?  →  tests/  (node:vm)
     · ¿Se ve, cabe, recibe el foco, hace scroll?   →  e2e/    (Playwright)

   Ejecutar:  npm run test:e2e          (npm run e2e:install la primera vez)
   ============================================================ */

const { defineConfig, devices } = require('@playwright/test');

// La app no tiene build: se sirve estática, igual que en README/CLAUDE.md.
// Puerto propio para no chocar con el 8000 que uno abre a mano mientras trabaja.
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  // Fuera de tests/, que es el glob de `node --test tests/*.test.js`: cada
  // suite se ejecuta con su propio runner y no deben mezclarse.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]]
                           : [['list']],

  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },

  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `${BASE}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore',   // http.server escribe su log de accesos en stderr
    timeout: 30_000,
  },

  // Solo Chromium: es lo que hay que descargar, y ninguna de estas pruebas
  // depende de un motor concreto. Añadir firefox/webkit aquí es una línea
  // más (y un `playwright install` más largo).
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // DESPUÉS del device a propósito: `devices` trae su propio viewport y
      // aquí gana el del proyecto sobre el de `use` global. El tamaño importa
      // porque el zoom se auto-ajusta al espacio disponible; los tests que
      // dependen de ello lo fijan aparte con WIDE/NARROW (e2e/helpers.js).
      viewport: { width: 1440, height: 900 },
    },
  }],
});
