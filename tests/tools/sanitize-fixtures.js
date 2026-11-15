// Copies recorded player answers (Bruno fixtures) to the UI test fixtures and removes
// personal details on the way: IP addresses, room name, network share and mount paths,
// USB drive ids. The structure of the answers stays the same.
// Usage: node tests/tools/sanitize-fixtures.js [from] [to]
//   default: tests/api/fixtures -> tests/ui/fixtures (only NN-*.xml, not explore-*)
const fs = require("fs"),
  path = require("path");
const root = path.join(__dirname, "..", "..");
const from = process.argv[2] || path.join(root, "tests", "api", "fixtures");
const to = process.argv[3] || path.join(root, "tests", "ui", "fixtures");

const RULES = [
  // Room name (settings)
  [/(id="zonename"[^>]*value=")[^"]*"/g, '$1Living Room"'],
  // Network share description (settings), e.g. //192.168.1.1/NAS/MUSIC
  [/(description=")\/\/[^"]*"/g, '$1//nas/music"'],
  // Mount folder of a network share or USB drive below /var/mnt/ or /tmp/mnt/ (raw and URL-encoded)
  [/(\/(?:var|tmp)\/mnt\/)[^/"<&%]+/g, "$1music"],
  [/(%2F(?:var|tmp)%2Fmnt%2F)[^%"<&]+/g, "$1music"],
  // USB drive ids used as service name (e.g. ABCD_1234) and in mount paths (ABCD-1234)
  [/\b[0-9A-F]{4}_[0-9A-F]{4}\b/g, "1A2B_3C4D"],
  [/\b[0-9A-F]{4}-[0-9A-F]{4}\b/g, "1A2B-3C4D"],
  // Any remaining IPv4 address -> documentation range
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "192.0.2.10"],
];

fs.mkdirSync(to, { recursive: true });
let n = 0;
for (const f of fs
  .readdirSync(from)
  .filter((x) => /^\d\d-.*\.xml$/.test(x))
  .sort()) {
  let s = fs.readFileSync(path.join(from, f), "utf8");
  for (const [re, rep] of RULES) s = s.replace(re, rep);
  fs.writeFileSync(path.join(to, f), s);
  n++;
}
console.log(`${n} fixtures sanitized: ${from} -> ${to}`);
