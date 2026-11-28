// ESLint configuration for BluAlbum: the script in blualbum.html, the UI tests and the API tests.
// Used by the GitHub workflow .github/workflows/lint.yml, which installs ESLint into this folder and
// runs it from the repository root with --config; locally the same way (README "Development").
import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

// Functions and variables of the app that the UI tests call inside page.evaluate()
const APP_GLOBALS = [
  "shown", "openAlbum", "setState", "showArtist", "imgUrl", "render", "APP", "playerName", "favOf",
  "activeKey", "cache", "pos", "curPos", "openSources", "playlists",
  "LAN_MSG", "QUALITIES", "FORMATS", "LOSSY", "SEARCH_MIN", "SEARCH_DELAY", "TILE", "ONOFF", "RELEASES_LATEST",
  "CONNECT_TIMEOUT", "NO_REPLY_MSG", "viewList", "SORTS", "plLoad", "search", "sortAlbums",
];

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
    // UI tests and performance measurement: callbacks of page.evaluate() run in the page
    files: ["tests/ui/run.js", "tests/ui/perf.js"],
    languageOptions: {
      globals: { ...globals.browser, ...Object.fromEntries(APP_GLOBALS.map((n) => [n, "readonly"])) },
    },
  },
];
