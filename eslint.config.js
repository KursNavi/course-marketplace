import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `worktrees/**`: Liegt ein git-Worktree versehentlich INNERHALB des Repos,
  // lintet eslint dessen komplette Kopie mit. `npm run lint` meldete dadurch
  // lokal tausende Fehler und war unbrauchbar. Der CI faellt das nicht auf,
  // weil sie frisch klont.
  globalIgnores(['dist', '.vercel/**', 'supabase/.temp/**', 'worktrees/**']),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Bleibt bewusst aus: 806 Fundstellen im Bestand, ganz ueberwiegend
      // Aufraeumarbeit ohne Fehlerwirkung. Als Warnung waeren sie nur Rauschen,
      // in dem die 38 wirklich relevanten Hook-Hinweise untergingen. Wer den
      // Bestand angeht, schaltet die Regel hier scharf:
      //   npx eslint . --rule '{"no-unused-vars":["error",{"args":"none"}]}'
      'no-unused-vars': 'off',
      // Doppelte Keys sind immer ein Fehler: der spaetere Wert gewinnt still,
      // der frueher notierte Text ist tot. In TRANSLATIONS lagen so 20 Stueck.
      'no-dupe-keys': 'error',
      'no-irregular-whitespace': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
    // Diese vier Regeln waren alle abgeschaltet. Sie finden echte Fehler:
    // veraltete Werte in Effekten, Render-Schleifen, verlorene Memoisierung.
    // Der Bestand ist mit 38 Fundstellen ueberschaubar — als Warnung sind sie
    // sichtbar und abarbeitbar, ohne dass die CI am Altbestand haengenbleibt.
    // Sobald der Bestand abgetragen ist, gehoeren sie auf 'error'.
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    files: ['tests/**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['api/**/*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs,cjs}', '*.js', '*.mjs', '*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
