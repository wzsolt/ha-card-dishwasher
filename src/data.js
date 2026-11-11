import { labels, localeFor } from "./text.js";

const absent = new Set(["", "unknown", "unavailable", "none", "null"]);
const holdProgramme = new Set([
  "run", "running", "pause", "paused", "delayedstart", "actionrequired",
  "endofcycle", "finished", "complete", "unknown", "unavailable", "",
]);
const openDoors = new Set(["open", "opened", "ajar", "partlyopen", "partiallyopen", "on", "true"]);
const closedDoors = new Set(["closed", "close", "locked", "off", "false"]);
const hiddenPhases = new Set(["0", "idle", "finished", "endofcycle", "notset", "invalid"]);

function key(value) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function hasValue(value) {
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

function timing(hass, locale, text, running, finishAt, seconds, clock, now) {
  const finish = Date.parse(finishAt);
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
  } else if (/^\d+:\d{2}(?::\d{2})?$/.test(clock)) {
    parts.push(text.remainingClock(clock));
  }
  return parts.join(" · ");
}

export function dishwasherView(hass, config, now = Date.now()) {
  const text = labels(hass);
  const locale = localeFor(hass);
  const read = (field) => hass.states[config[field]]?.state?.trim() ?? "";
  const mode = key(read("state_entity"));
  const connected = read("connection_entity") !== "off";
  const running = connected && ["run", "running"].includes(mode);
  const paused = connected && ["pause", "paused"].includes(mode);
  const finished = connected && ["endofcycle", "finished", "complete"].includes(mode);
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
  const rawProgramme = holdProgramme.has(mode) && hasValue(saved) ? saved : read("programme_entity");
  const rawPhase = read("cycle_phase_entity");
  const phase = key(rawPhase);
  const cycles = number(read("cycles_run_entity"));
  const estimate = number(read("progress_percentage_entity"));
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
    timing: active ? timing(hass, locale, text, running, read("finishes_at_entity"),
      number(read("time_remaining_entity")), read("time_to_end_formatted_entity"), now) : "",
    alert: connected && read("alerts_entity") === "on",
  };
}
