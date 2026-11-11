import { labels, localeFor } from "./text.js";

const absent = new Set(["", "unknown", "unavailable", "none", "null"]);
const holdProgramme = new Set([
  "run", "running", "pause", "paused", "delayedstart", "actionrequired",
  "endofcycle", "finished", "complete", "unknown", "unavailable", "",
]);
const openDoors = new Set(["open", "opened", "ajar", "partlyopen", "partiallyopen", "on", "true"]);
const closedDoors = new Set(["closed", "close", "locked", "off", "false"]);
const hiddenPhases = new Set(["0", "idle", "finished", "endofcycle", "notset", "invalid"]);

export function key(value) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

export function hasValue(value) {
  return !absent.has(value.toLowerCase());
}

function number(value) {
  return hasValue(value) ? Number(value) : NaN;
}

function programmeName(hass, entity, raw, fallback) {
  if (!hasValue(raw)) return fallback;
  const formatted = entity && hass.formatEntityState?.(entity, raw);
  if (formatted && formatted !== raw) return formatted;
  return raw.replace(/^(?:dishwasher_|programme?_)+/i, "").replace(/_/g, " ")
    .replace(/^eco\b/i, "Eco").replace(/^[a-z]/, (first) => first.toUpperCase());
}

const durationUnits = new Map([
  ["s", 1], ["sec", 1], ["second", 1], ["seconds", 1],
  ["min", 60], ["minute", 60], ["minutes", 60],
  ["h", 3600], ["hour", 3600], ["hours", 3600],
]);

export function durationSeconds(value, unit) {
  const amount = number(value);
  const seconds = amount * durationUnits.get((unit || "s").trim().toLowerCase());
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : NaN;
}

export function clockSeconds(value) {
  if (!/^\d+:\d{2}(?::\d{2})?$/.test(value)) return NaN;
  const [hours, minutes, seconds = 0] = value.split(":").map(Number);
  const total = hours * 3600 + minutes * 60 + seconds;
  return minutes < 60 && seconds < 60 && Number.isSafeInteger(total) ? total : NaN;
}

export function applianceMode(value) {
  const mode = key(value);
  if (mode === "run") return "running";
  if (mode === "pause") return "paused";
  if (["endofcycle", "finished", "complete"].includes(mode)) return "finished";
  return mode;
}

function timing(hass, locale, text, running, finish, seconds, clock, now) {
  const parts = [];
  if (running && finish > now) {
    const formatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit", minute: "2-digit", timeZone: hass.config?.time_zone,
    });
    parts.push(text.finishTime(formatter.format(finish)));
  }
  if (Number.isFinite(seconds) && seconds >= 0) {
    const minutes = Math.ceil(seconds / 60);
    parts.push(text.remaining(Math.floor(minutes / 60), minutes % 60));
  } else if (Number.isFinite(clockSeconds(clock))) {
    parts.push(text.remainingClock(clock));
  }
  return parts.join(" · ");
}

export function dishwasherView(hass, config, now = Date.now(), cycle = {}) {
  const text = labels(hass);
  const locale = localeFor(hass);
  const read = (field) => hass.states[config[field]]?.state?.trim() ?? "";
  const mode = applianceMode(read("state_entity"));
  const connected = read("connection_entity") !== "off";
  const running = connected && mode === "running";
  const paused = connected && mode === "paused";
  const finished = connected && mode === "finished";
  const active = running || paused;
  const status = !connected ? "offline" : finished ? "finished" : paused ? "paused" : running ? "running" : mode;
  const doorState = key(read("door_entity"));
  const door = openDoors.has(doorState) ? "open" : closedDoors.has(doorState) ? "closed" : "unknownDoor";
  let animation = "";
  if (connected && door === "closed") {
    if (running) animation = "running";
    else if (mode === "delayedstart") animation = "delayed";
    else if (finished) animation = "finished";
  }
  const saved = read("saved_programme_entity");
  const remembered = hasValue(saved) ? saved : cycle.programme;
  const rawProgramme = holdProgramme.has(mode) && remembered ? remembered : read("programme_entity");
  const rawPhase = read("cycle_phase_entity");
  const phase = key(rawPhase);
  const cycles = number(read("cycles_run_entity"));
  const finish = Date.parse(read("finishes_at_entity"));
  const rawUnit = hass.states[config.time_to_end_entity]?.attributes?.unit_of_measurement;
  const clock = read("time_to_end_formatted_entity");
  const remaining = [
    number(read("time_remaining_entity")),
    running && finish >= now ? Math.ceil((finish - now) / 1000) : NaN,
    durationSeconds(read("time_to_end_entity"), rawUnit),
  ].find((value) => Number.isFinite(value) && value >= 0);
  const savedEstimate = number(read("progress_percentage_entity"));
  const forProgress = remaining ?? [clockSeconds(clock), paused ? cycle.remainingAtPause : NaN]
    .find((value) => Number.isFinite(value));
  const elapsed = cycle.initialDuration > 0 && forProgress !== undefined
    ? Math.floor(100 * (cycle.initialDuration - forProgress) / cycle.initialDuration) : NaN;
  const estimate = Number.isFinite(savedEstimate) && savedEstimate >= 0 ? savedEstimate : Math.max(0, elapsed);
  return {
    text, door, animation,
    status: Object.hasOwn(text.states, status) ? text.states[status] : text.states.unknown,
    programme: programmeName(hass, hass.states[config.programme_entity], rawProgramme, text.noProgramme),
    eco: /(?:^|[^a-z0-9])eco(?:$|[^a-z])/i.test(rawProgramme),
    cycles: Number.isSafeInteger(cycles) && cycles >= 0 ? cycles.toLocaleString(locale) : "—",
    percent: finished ? 100 : active && Number.isFinite(estimate) && estimate >= 0
      ? Math.min(99, Math.floor(estimate)) : null,
    phase: active && hasValue(rawPhase) && !hiddenPhases.has(phase)
      ? Object.hasOwn(text.phases, phase) ? text.phases[phase] : rawPhase.replace(/_/g, " ")
      : "",
    timing: active ? timing(hass, locale, text, running, finish, remaining, clock, now) : "",
    alert: connected && read("alerts_entity") === "on",
  };
}
