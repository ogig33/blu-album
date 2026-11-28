// Block "1 Read" (test-cases.md): every read request of the app (A), API behaviour the app relies on (E),
// the reference endpoints that only read (V). No effect on the player. The requests run in this order.
require("./read/app");
require("./read/details");
require("./read/reference");
