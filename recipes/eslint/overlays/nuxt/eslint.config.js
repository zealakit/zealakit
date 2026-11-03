import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".nuxt", ".output", ".nitro"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginVue.configs["flat/recommended"],
    ],
    files: ["**/*.{ts,tsx,vue}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
);
