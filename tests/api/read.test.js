// Folder "1 Read (safe)": every read request of the app (A), album details and API variants (E),
// the reference endpoints that only read (V). No effect on the player. The requests run in this order.
require("./read/app");
require("./read/details");
require("./read/reference");
