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
    ["switch.custom_silent", "userSelections.extraSilentOption", "chosen"],
    ["switch.other_glass", "glass_care", "other"],
  ];
  hass.entities = Object.fromEntries(entries.map(([entity_id, translation_key, device_id]) => {
    states[entity_id] = { state: "unknown" };
    return [entity_id, { entity_id, translation_key, device_id, platform: "aeg" }];
  }));
  assert.deepEqual(discoverEntities(hass, { device_id: "chosen" }), {
    state_entity: "sensor.custom_status", programme_entity: "select.custom_cycle",
    cycle_phase_entity: "sensor.custom_phase", extra_silent_entity: "switch.custom_silent",
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

test("locks selected extras and a programme made unknown well before start", () => {
  const { history, hass } = recorded("END_OF_CYCLE", "10:55:00");
  history[config.state_entity].splice(1, 0, sample("09:45:00", "DELAYED_START"));
  history[config.state_entity].push(sample("10:30:00", "PAUSED"), sample("10:55:00", "END_OF_CYCLE"));
  history[config.programme_entity] = [
    sample("09:05:00", "ECO"), sample("09:06:00", "unknown"), sample("10:01:00", "QUICK"),
  ];
  history[config.extra_silent_entity] = [
    sample("09:06:00", "on"), sample("09:30:00", "unavailable"), sample("09:45:01", "off"),
  ];
  history[config.extra_power_entity] = [sample("09:10:00", "on"), sample("09:11:00", "off")];
  history[config.glass_care_entity] = [sample("09:45:01", "on")];
  hass.states[config.extra_silent_entity] = { state: "off" };
  hass.states[config.glass_care_entity] = { state: "on" };
  const cycle = recoverCycle(history, hass, config, now);
  assert.equal(cycle.programme, "ECO");
  assert.deepEqual(cycle.extras, { extra_silent_entity: "on", extra_power_entity: "off" });
  assert.deepEqual(dishwasherView(hass, config, now, cycle).extras, ["extra_silent_entity"]);

  hass.states[config.state_entity].state = "READY_TO_START";
  hass.states[config.programme_entity].state = "QUICK";
  assert.deepEqual(dishwasherView(hass, config, now, cycle).extras, ["glass_care_entity"]);
  assert.equal(dishwasherView(hass, config, now, cycle).programme, "QUICK");
});

test("retries a fresh unknown programme even if Recorder initially returns an older selection", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  const { history, hass } = recorded("READY_TO_START");
  hass.states[config.programme_entity] = { state: "unknown", last_changed: new Date(now).toISOString() };
  let calls = 0;
  hass.callWS = async (request) => {
    assert.deepEqual(request.entity_ids, [config.programme_entity]);
    calls++;
    return calls === 1 ? history : {
      [config.programme_entity]: [...history[config.programme_entity], sample("10:59:59", "AUTO")],
    };
  };
  const loader = new CycleHistory(() => {});
  t.after(() => loader.clear());
  loader.update(hass, config);
  await Promise.resolve();
  assert.equal(loader.update(hass, config).programme, "ECO");
  t.mock.timers.tick(10_000);
  await Promise.resolve();
  assert.equal(loader.update(hass, config).programme, "AUTO");
  hass.states[config.programme_entity].state = "QUICK";
  assert.deepEqual(loader.update(hass, config), {});
  assert.equal(calls, 2);
});

test("recovers unavailable extras independently and respects a live off after a programme change", async (t) => {
  const { history, hass } = recorded("READY_TO_START");
  hass.states[config.programme_entity].state = "ECO";
  hass.states[config.extra_power_entity] = { state: "on" };
  hass.states[config.glass_care_entity] = { state: "unavailable" };
  history[config.state_entity] = [sample("09:00:00", "READY_TO_START")];
  history[config.glass_care_entity] = [sample("10:05:00", "on"), sample("10:10:00", "unavailable")];

  const requests = [];
  hass.callWS = async (request) => {
    requests.push(request.entity_ids);
    return history;
  };
  const loader = new CycleHistory(() => {});
  t.after(() => loader.clear());
  loader.update(hass, config);
  await Promise.resolve();
  assert.deepEqual(requests, [[config.state_entity, config.glass_care_entity]]);
  const view = () => dishwasherView(hass, config, now, loader.update(hass, config));
  assert.deepEqual(view().extras, ["extra_power_entity", "glass_care_entity"]);

  hass.states[config.programme_entity].state = "QUICK";
  assert.equal(view().programme, "QUICK");
  assert.deepEqual(view().extras, ["extra_power_entity", "glass_care_entity"]);
  assert.equal(requests.length, 1);

  history[config.extra_power_entity] = [sample("10:06:00", "on"), sample("10:11:00", "unavailable")];
  hass.states[config.extra_power_entity].state = "unavailable";
  assert.deepEqual(view().extras, ["glass_care_entity"]);
  await Promise.resolve();
  assert.deepEqual(view().extras, ["extra_power_entity", "glass_care_entity"]);

  hass.states[config.glass_care_entity].state = "off";
  assert.deepEqual(view().extras, ["extra_power_entity"]);
});

test("unavailable switches cannot carry an earlier cycle's extras into the next selection or cycle", async (t) => {
  const { history, hass } = recorded("READY_TO_START", "10:50:00");
  history[config.state_entity].push(sample("10:45:00", "END_OF_CYCLE"), sample("10:50:00", "READY_TO_START"));
  history[config.extra_power_entity] = [sample("09:45:00", "on"), sample("10:00:01", "unavailable")];
  hass.states[config.extra_power_entity] = { state: "unavailable" };
  hass.states[config.programme_entity].state = "QUICK";
  hass.callWS = async () => history;
  const loader = new CycleHistory(() => {});
  t.after(() => loader.clear());
  loader.update(hass, config);
  await Promise.resolve();
  assert.deepEqual(loader.update(hass, config).extras, {});

  history[config.state_entity].push(sample("10:55:00", "RUNNING"));
  hass.states[config.state_entity] = { state: "RUNNING", last_changed: new Date(time("10:55:00")).toISOString() };
  assert.deepEqual(recoverCycle(history, hass, config, now).extras, {});

  // A switch that continued to report on through the reset belongs to the new selection.
  history[config.extra_power_entity] = [sample("09:45:00", "on"), sample("10:52:00", "unavailable")];
  assert.deepEqual(recoverCycle(history, hass, config, now).extras, { extra_power_entity: "on" });
});
