// Folder "3 Manual (run on purpose)": doorbell, library rescan, test preset, reboot, playlist restore, clear history,
// statistics, rebuild index, UpdateDNS, radio favourites, playurl, firmware upgrade, library id, test sound, setup and
// grouping requests, test share (M01–M45). Every request is skipped unless runManual is set (config.json or
// RUN_MANUAL=1), also when it is run on its own; run single requests with --test-name-pattern.
require("./manual/manual");
