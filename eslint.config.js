// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    // Builds y archivos generados por scripts/vendor-kiosk.mjs
    ignores: ['dist/*', 'test/.dist/*', 'public/vendor/*', 'src/vendor/*'],
  },
  {
    // Motor 3D: scripts clásicos ES5 que corren en el iframe / WebView (Three.js como global)
    files: ['src/components/mapa3d/runtime/*.js'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      globals: { ...globals.browser, THREE: 'readonly', MiTecmmEtiquetas: 'readonly', module: 'readonly', exports: 'writable' },
    },
    rules: { 'no-var': 'off' },
  },
  {
    // THREE aparece dentro de funciones que se evalúan en el navegador (page.evaluate)
    files: ['test/**/*.{cjs,mjs}', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, THREE: 'readonly' } },
  },
  {
    // Reglas pensadas para React Compiler (no se usa en este proyecto): se reportan como
    // advertencias para corregirlas poco a poco sin bloquear el lint.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
