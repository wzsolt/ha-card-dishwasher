import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import { normalizeConfig } from "../src/config.js";
import { dishwasherView } from "../src/data.js";

const config = parse(readFileSync(new URL("../examples/aeg-dishwasher.yaml", import.meta.url), "utf8"));
const now = Date.parse("2026-11-11T09:00:00Z");

function view(overrides = {}, extra = {}) {
  const values = {
    state_entity: "RUNNING", door_entity: "CLOSED", cycle_phase_entity: "RINSE",
    programme_entity: "unavailable", saved_programme_entity: "dishwasher_eco_50",
    cycles_run_entity: "123", progress_percentage_entity: "62", time_remaining_entity: "4440",
    finishes_at_entity: "2026-11-11T10:14:00Z", ...overrides,
  };
  const states = Object.fromEntries(Object.entries(values).map(([field, state]) => [config[field], { state }]));
  return dishwasherView({ states, config: { time_zone: "Europe/Budapest" }, language: "hu", ...extra }, config, now);
}

test("shows the saved Eco programme, progress, timing and phase in Hungarian", () => {
  const result = view();
  assert.equal(result.programme, "Eco 50");
  assert.equal(result.eco, true);
  assert.equal(result.cycles, "123");
  assert.equal(result.percent, 62);
  assert.equal(result.status, "Fut a program");
  assert.equal(result.phase, "Öblítés");
  assert.equal(result.timing, "Vége 11:14 · 1 óra 14 perc van hátra");
  assert.equal(result.animation, "running");
});

test("keeps the programme when locked and resumes using the live selection when ready", () => {
  const paused = view({ state_entity: "PAUSED", programme_entity: "AUTO" });
  assert.equal(paused.programme, "Eco 50");
  assert.equal(paused.percent, 62);
  assert.equal(paused.animation, "");
  assert.equal(paused.timing, "1 óra 14 perc van hátra");
  const ready = view({ state_entity: "READY_TO_START", programme_entity: "AUTO" });
  assert.equal(ready.programme, "AUTO");
  assert.equal(ready.percent, null);
  assert.equal(ready.phase, "");
  assert.equal(ready.timing, "");
});

test("picks delayed, finished and static images based on state, door and connection", () => {
  assert.equal(view({ state_entity: "DELAYED_START" }).animation, "delayed");
  const finished = view({ state_entity: "END_OF_CYCLE", progress_percentage_entity: "unavailable" });
  assert.equal(finished.animation, "finished");
  assert.equal(finished.percent, 100);
  assert.equal(finished.timing, "");
  assert.equal(view({ door_entity: "PARTLY_OPEN" }).door, "open");
  assert.equal(view({ door_entity: "PARTLY_OPEN" }).animation, "");
  const offline = view({ connection_entity: "off", alerts_entity: "on" });
  assert.equal(offline.animation, "");
  assert.equal(offline.status, "Nincs kapcsolat");
  assert.equal(offline.alert, false);
  assert.equal(view({ door_entity: "unavailable" }).animation, "");
});

test("uses clock fallback and handles invalid optional data", () => {
  const result = view({
    saved_programme_entity: "unknown", cycles_run_entity: "-1", time_remaining_entity: "-1",
    progress_percentage_entity: "100.7", time_to_end_formatted_entity: "00:05", finishes_at_entity: "unknown",
  }, { language: "en" });
  assert.equal(result.programme, "Programme data unavailable");
  assert.equal(result.cycles, "—");
  assert.equal(result.percent, 99);
  assert.equal(result.timing, "00:05 remaining");
  assert.equal(view({ cycle_phase_entity: "INVALID", progress_percentage_entity: "unknown" }).percent, null);
  assert.equal(view({ cycle_phase_entity: "INVALID" }).phase, "");
  assert.equal(view({ cycle_phase_entity: "constructor", state_entity: "constructor" }).status, "Nincs állapotadat");
  const minimal = dishwasherView({ states: {} }, { state_entity: "sensor.any" });
  assert.equal(minimal.status, "Status unavailable");
  assert.equal(minimal.door, "unknownDoor");
});

test("normalizes entity IDs and preserves grid configuration", () => {
  const grid_options = { columns: 9, rows: "auto" };
  assert.deepEqual(normalizeConfig({
    state_entity: " sensor.state ", saved_programme_entity: "", grid_options,
  }), { state_entity: "sensor.state", grid_options });
});
