import globals from 'globals';
import pluginJs from '@eslint/js';


/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: { 
      globals: {
        CONST: 'readonly',
        CONFIG: 'readonly',
        foundry: 'readonly',
        ApplicationV2: 'readonly',
        ItemSheetV2: 'readonly',
        game: 'readonly',
        Hooks: 'readonly',
        Dialog: 'readonly',
        renderTemplate: 'readonly',
        loadTemplates: 'readonly',
        fromUuidSync: 'readonly',
        ChatMessage: 'readonly',
        ui: 'readonly',
        FormDataExtended: 'readonly',
        $: 'readonly',
        libWrapper: 'readonly',
        ...globals.browser
      }
    },
    rules: {
      // Ignore unused variables prefixed with '_'
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Example of additional rules
      'semi': ['error', 'always'], // Require semicolons
      'quotes': ['error', 'single'], // Enforce single quotes
    },
  },
  pluginJs.configs.recommended,
];