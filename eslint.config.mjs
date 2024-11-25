import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: { 
      globals: {
        CONST: "readonly",
        foundry: "readonly",
        game: "readonly",
        Hooks: "readonly",
        Dialog: "readonly",
        renderTemplate: "readonly",
        loadTemplates: "readonly",
        fromUuidSync: "readonly",
        ChatMessage: "readonly",
        ui: "readonly",
        FormDataExtended: "readonly",
        $: "readonly",
        libWrapper: "readonly",
        ...globals.browser
      }
    }
  },
  pluginJs.configs.recommended,
];