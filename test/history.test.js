import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverEntities, resolveConfig } from "../src/config.js";
import { dishwasherView } from "../src/data.js";
import { CycleHistory, recoverCycle } from "../src/history.js";
import { fixture } from "./fixture.js";

const config = Object.fromEntries(Object.entries(fixture).filter(([field]) =>
  !["saved_programme_entity", "time_remaining_entity", "progress_percentage_entity"].includes(field)));
const time = (value) => Date.parse("2026-11-11T" + value + "Z");
const sample = (at, s, a) => ({ s, lu: time(at) / 1000, a });
const now = time("11:00:00");

function recorded(mode = "RUNNING", changed = "10:00:00") {
  const states = {
    [config.state_entity]: { state: mode, last_changed: new Date(time(changed)).toISOString() },
    [config.programme_entity]: { state: "unavailable" },
    [config.time_to_end_entity]: { state: "60", attributes: { unit_of_measurement: "min" } },
  };
  const history = {
    [config.state_entity]: [sample("09:00:00", "READY_TO_START"), sample("10:00:00", "RUNNING")],
    [config.programme_entity]: [sample("09:58:00", "ECO"), sample("09:59:59", "unavailable")],
    [config.time_to_end_entity]: [
      sample("10:00:03", "120", { unit_of_measurement: "min" }),
      sample("10:59:59", "60", { unit_of_measurement: "min" }),
    ],
  };
  return { history, hass: { states } };
}

test("recovers the initial duration and last valid programme after opening mid-cycle", () => {
  const { history, hass } = recorded();
  const cycle = recoverCycle(history, hass, config, now);
  assert.equal(cycle.programme, "ECO");
  assert.equal(cycle.initialDuration, 7200);
  const view = dishwasherView(hass, config, now, cycle);
  assert.equal(view.percent, 50);
  assert.equal(view.programme, "Eco");
  assert.equal(view.eco, true);
});

test("keeps the delayed-start programme across resume and uses the first running duration", () => {
  const { history, hass } = recorded("RUNNING", "10:35:00");
  history[config.state_entity].splice(1, 0, sample("09:59:50", "DELAYED_START"));
  history[config.state_entity].push(sample("10:30:00", "PAUSED"), sample("10:35:00", "RUNNING"));
  history[config.programme_entity].push(sample("10:31:00", "QUICK"));
  assert.equal(recoverCycle(history, hass, config, now).programme, "ECO");
  assert.equal(recoverCycle(history, hass, config, now).initialDuration, 7200);
});

test("uses the latest running cycle after completion and leaves missing initial samples unknown", () => {
  const { history, hass } = recorded("RUNNING", "10:50:00");
  history[config.state_entity].push(sample("10:45:00", "END_OF_CYCLE"), sample("10:50:00", "RUNNING"));
  history[config.programme_entity].push(sample("10:49:00", "QUICK"), sample("10:50:05", "unavailable"));
  const cycle = recoverCycle(history, hass, config, now);
  assert.equal(cycle.programme, "QUICK");
  assert.equal(cycle.initialDuration, undefined);
  assert.equal(dishwasherView(hass, config, now, cycle).percent, null);
});

test("recovers the pause snapshot if the live timer is unavailable", () => {
  const { history, hass } = recorded("PAUSED", "10:58:00");
  hass.states[config.time_to_end_entity].state = "unavailable";
  history[config.time_to_end_entity].push(sample("10:57:59", "65"));
  const cycle = recoverCycle(history, hass, config, now);
  assert.equal(cycle.remainingAtPause, 3900);
  assert.equal(dishwasherView(hass, config, now, cycle).percent, 45);
});

test("declines an ambiguous cycle start and supports a timestamp-only baseline", () => {
  const { history, hass } = recorded();
  delete history[config.time_to_end_entity];
  history[config.finishes_at_entity] = [sample("10:00:05", "2026-11-11T12:00:00Z")];
  assert.equal(recoverCycle(history, hass, config, now).initialDuration, 7200);
  history[config.state_entity].shift();
  assert.deepEqual(recoverCycle(history, hass, config, now), {});
});

test("discovery handles the device registry, entity prefixes and multiple dishwashers", () => {
  const states = Object.fromEntries(Object.values(config).filter((value) => value.includes("kitchen_dishwasher"))
    .map((id) => [id, { state: "unknown" }]));
  const hass = { states };
  const expected = Object.fromEntries(Object.entries(config).filter(([field]) => field !== "type"));
  assert.deepEqual(discoverEntities(hass, { state_entity: config.state_entity }), expected);
  assert.equal(resolveConfig(hass, { time_to_end_entity: "sensor.manual" }).time_to_end_entity, "sensor.manual");
  states["sensor.other_dishwasher_state"] = { state: "idle" };
  assert.deepEqual(discoverEntities(hass), {});
  assert.equal(discoverEntities(hass, { state_entity: config.state_entity }).door_entity, config.door_entity);
  const entries = [
    ["sensor.custom_status", "state", "chosen"], ["select.custom_cycle", "programme", "chosen"],
    ["sensor.custom_phase", "cycle_phase", "chosen"], ["sensor.wrong_time_to_end", "time_to_end", "other"],
  ];
  hass.entities = Object.fromEntries(entries.map(([entity_id, translation_key, device_id]) => {
    states[entity_id] = { state: "unknown" };
    return [entity_id, { entity_id, translation_key, device_id, platform: "aeg" }];
  }));
  assert.deepEqual(discoverEntities(hass, { device_id: "chosen" }), {
    state_entity: "sensor.custom_status", programme_entity: "select.custom_cycle", cycle_phase_entity: "sensor.custom_phase",
  });
});

test("a slow Recorder response for a previous configuration cannot replace the current cycle", async () => {
  const { history, hass } = recorded();
  const pending = [];
  hass.callWS = () => new Promise((resolve) => pending.push(resolve));
  const changes = [];
  const loader = new CycleHistory(() => changes.push(loader.current.value));
  loader.update(hass, config);
  loader.update(hass, { ...config, programme_entity: "select.other" });
  pending[0](history);
  await Promise.resolve();
  assert.deepEqual(changes, []);
  pending[1](history);
  await Promise.resolve();
  assert.equal(changes[0].programme, undefined);
  loader.clear();
});
