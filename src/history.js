import { applianceMode, clockSeconds, durationSeconds, hasValue } from "./data.js";

const second = 1000;
const minute = 60 * second;
const lookback = 3 * 24 * 60 * minute;
const initialWindow = 2 * minute;
const historyFields = [
  "state_entity", "programme_entity", "time_to_end_entity", "time_to_end_formatted_entity", "finishes_at_entity",
];
const runningModes = new Set(["running", "paused", "delayedstart"]);
const interruptedModes = new Set(["actionrequired", "unknown", "unavailable", ""]);
const waitingModes = new Set(["ready", "readytostart", "idle", "standby", "inactive", "off", "finished", "aborted", "error"]);
const retryDelays = [10 * second, 25 * second, 60 * second];

function samples(history, id, end) {
  return (history[id] ?? []).map((sample) => ({
    value: String(sample.s ?? sample.state ?? "").trim(),
    time: typeof (sample.lc ?? sample.lu) === "number"
      ? (sample.lc ?? sample.lu) * second : Date.parse(sample.last_changed ?? sample.last_updated),
    attributes: sample.a ?? sample.attributes,
  })).filter(({ time }) => Number.isFinite(time) && time <= end).sort((a, b) => a.time - b.time);
}

function cycleStarts(states, mode) {
  let first = states.length - 1;
  // A current running cycle must never borrow an earlier cycle's final state.
  if (mode === "finished") {
    while (first >= 0 && (states[first].mode === "finished" || interruptedModes.has(states[first].mode))) first--;
  }
  let started;
  let running;
  while (first >= 0) {
    const sample = states[first--];
    if (runningModes.has(sample.mode)) {
      started = sample.time;
      if (sample.mode === "running") running = sample.time;
    } else if (!interruptedModes.has(sample.mode)) {
      return waitingModes.has(sample.mode) && started !== undefined ? { started, running } : {};
    }
  }
  // A lookback that opens in the middle of a cycle has no trustworthy start.
  return {};
}

function savedProgramme(programmes, started) {
  const before = programmes.filter(({ time }) => time <= started);
  const latest = before.at(-1);
  if (!latest) return undefined;
  if (hasValue(latest.value)) return latest.value;
  const lost = before.findLastIndex(({ time, value }, index) => time >= started - initialWindow
    && !hasValue(value) && index > 0 && hasValue(before[index - 1].value));
  return lost > 0 ? before[lost - 1].value : undefined;
}

function initialSeconds(history, hass, config, started, end) {
  const unit = hass.states[config.time_to_end_entity]?.attributes?.unit_of_measurement;
  const readers = [
    ["time_to_end_entity", (sample) => durationSeconds(sample.value, sample.attributes?.unit_of_measurement ?? unit)],
    ["time_to_end_formatted_entity", (sample) => clockSeconds(sample.value)],
    ["finishes_at_entity", (sample) => Math.ceil((Date.parse(sample.value) - started) / second)],
  ];
  for (const [field, read] of readers) {
    const values = samples(history, config[field], Math.min(end, started + initialWindow));
    const recent = values.filter(({ time }) => time >= started - 30 * second);
    const before = recent.filter(({ time }) => time < started).at(-1);
    const after = recent.filter(({ time }) => time >= started);
    // A first positive reading may be published just before or just after the state change.
    const initial = after.map(read).find((value) => Number.isFinite(value) && value > 0);
    const preceding = before && read(before);
    if (Number.isFinite(preceding) && preceding > 0) return Math.max(preceding, initial ?? 0);
    if (initial !== undefined) return initial;
  }
  return undefined;
}

function remainingAtPause(history, hass, config, running, pausedAt) {
  const unit = hass.states[config.time_to_end_entity]?.attributes?.unit_of_measurement;
  const raw = samples(history, config.time_to_end_entity, pausedAt)
    .findLast(({ time, value, attributes }) => time >= running
      && Number.isFinite(durationSeconds(value, attributes?.unit_of_measurement ?? unit)));
  if (raw) return durationSeconds(raw.value, raw.attributes?.unit_of_measurement ?? unit);
  const clock = samples(history, config.time_to_end_formatted_entity, pausedAt)
    .findLast(({ time, value }) => time >= running && Number.isFinite(clockSeconds(value)));
  return clock && clockSeconds(clock.value);
}

export function recoverCycle(history, hass, config, now) {
  const live = hass.states[config.state_entity];
  const mode = applianceMode(live?.state ?? "");
  const recorded = samples(history, config.state_entity, now).map(({ time, value }) => ({
    time, mode: applianceMode(value),
  }));
  const liveTime = Date.parse(live?.last_changed);
  const latest = recorded.at(-1);
  if (Number.isFinite(liveTime) && liveTime <= now && (!latest || liveTime >= latest.time)
      && latest?.mode !== mode) recorded.push({ time: liveTime, mode });
  if (recorded.at(-1)?.mode !== mode) return {};
  const { started, running } = cycleStarts(recorded, mode);
  if (started === undefined) return {};
  return {
    programme: savedProgramme(samples(history, config.programme_entity, now), started),
    initialDuration: running === undefined ? undefined : initialSeconds(history, hass, config, running, now),
    remainingAtPause: mode === "paused" && running !== undefined
      ? remainingAtPause(history, hass, config, running, recorded.at(-1).time) : undefined,
  };
}

export class CycleHistory {
  constructor(onChange) {
    this.onChange = onChange;
  }

  clear() {
    clearTimeout(this.timer);
    this.current = undefined;
  }

  update(hass, config) {
    const state = hass.states[config.state_entity];
    const mode = applianceMode(state?.state ?? "");
    if (!hass.callWS || (!runningModes.has(mode) && mode !== "finished" && mode !== "actionrequired")) {
      this.clear();
      return {};
    }

    const ids = [...new Set(historyFields.map((field) => config[field]).filter(Boolean))];
    const key = JSON.stringify([ids, mode, state.last_changed]);
    const connection = hass.connection ?? hass.callWS;
    if (this.current?.key !== key || this.current.connection !== connection) {
      this.clear();
      this.current = { key, connection, value: {}, attempts: 0 };
      this.load(hass, config, ids, mode, this.current);
    }
    return this.current.value;
  }

  async load(hass, config, ids, mode, current) {
    const now = Date.now();
    try {
      const history = await hass.callWS({
        type: "history/history_during_period",
        entity_ids: ids,
        start_time: new Date(now - lookback).toISOString(),
        end_time: new Date(now).toISOString(),
        include_start_time_state: true,
        minimal_response: false,
        no_attributes: false,
        significant_changes_only: false,
      });
      if (current !== this.current) return;
      current.value = recoverCycle(history, hass, config, now);
      this.onChange();
    } catch {
      // Live readings and the optional legacy helpers are still available.
    }
    if (current !== this.current) return;
    const programmeMissing = config.programme_entity && !current.value.programme;
    const durationMissing = mode !== "delayedstart" && mode !== "finished" && !current.value.initialDuration;
    const delay = retryDelays[current.attempts++];
    if (delay && (programmeMissing || durationMissing)) {
      this.timer = setTimeout(() => this.load(hass, config, ids, mode, current), delay);
    }
  }
}
