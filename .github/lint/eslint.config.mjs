// ESLint configuration for BluAlbum: the script in blualbum.html and the test tools.
// Used only by the GitHub workflow .github/workflows/lint.yml, which installs ESLint into this
// folder and runs it from the repository root with --config (nothing to install locally).
import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

// Functions and variables of the app that the UI tests call inside page.evaluate()
const APP_GLOBALS = ["shown", "openAlbum", "setState", "showArtist", "imgUrl", "render", "APP", "playerName"];

export default [
  js.configs.recommended,
  {
    // The app: one classic <script> in the HTML file, runs in the browser
    files: ["blualbum.html"],
    plugins: { html },
    languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: globals.browser },
  },
  {
    // Node scripts of the tests
    files: ["tests/**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "commonjs", globals: globals.node },
  },
  {
    // UI tests: callbacks of page.evaluate() run in the page
    files: ["tests/ui/run.js"],
    languageOptions: {
      globals: { ...globals.browser, ...Object.fromEntries(APP_GLOBALS.map((n) => [n, "readonly"])) },
    },
  },
];
