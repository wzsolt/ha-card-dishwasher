export const CARD_TYPE = "ha-card-dishwasher";

const extraRoles = {
  extra_silent_entity: ["switch", "extra_silent", "extra_silent_option", "user_selections_extra_silent", "user_selections_extra_silent_option"],
  extra_power_entity: ["switch", "extra_power", "extra_power_option", "user_selections_extra_power", "user_selections_extra_power_option"],
  glass_care_entity: ["switch", "glass_care", "glass_care_option", "user_selections_glass_care", "user_selections_glass_care_option"],
};
export const extraFields = Object.keys(extraRoles);

const roles = {
  state_entity: ["sensor", "state", "appliance_state", "dishwasher_state"],
  programme_entity: ["select", "programme", "program"],
  ...extraRoles,
  cycle_phase_entity: ["sensor", "cycle_phase"],
  door_entity: ["sensor", "door", "door_state"],
  connection_entity: ["binary_sensor", "connection"],
  alerts_entity: ["binary_sensor", "alerts"],
  cycles_run_entity: ["sensor", "cycles_run"],
  finishes_at_entity: ["sensor", "finishes_at"],
  time_to_end_entity: ["sensor", "time_to_end"],
  time_to_end_formatted_entity: ["sensor", "time_to_end_formatted"],
};

export const legacyFields = ["saved_programme_entity", "time_remaining_entity", "progress_percentage_entity"];
export const entityFields = Object.fromEntries([
  ...Object.entries(roles).map(([field, [domain]]) => [field, domain]),
  ...legacyFields.map((field) => [field, "sensor"]),
]);

export function normalizeConfig(config) {
  const result = { ...config };
  for (const field of ["device_id", ...Object.keys(entityFields)]) {
    const id = typeof result[field] === "string" ? result[field].trim() : "";
    if (id) result[field] = id;
    else delete result[field];
  }
  return result;
}

function only(values) {
  return values.length === 1 ? values[0] : undefined;
}

function matchesKey(entry, keys) {
  const compact = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = compact(entry.translation_key ?? "");
  return keys.some((role) => key === compact(role) || key === "dishwasher" + compact(role));
}

function matchingEntries(entries, [domain, ...keys]) {
  const domainEntries = entries.filter(({ entity_id }) => entity_id.startsWith(domain + "."));
  const translated = domainEntries.filter((entry) => matchesKey(entry, keys));
  if (translated.length) return translated;
  return domainEntries.filter(({ entity_id }) =>
    keys.some((key) => entity_id === domain + "." + key || entity_id.endsWith("_" + key)));
}

export function discoverEntities(hass, config = {}) {
  const states = hass.states ?? {};
  const registry = hass.entities ?? {};
  const selectedDevice = config.device_id || registry[config.state_entity]?.device_id;
  const available = (id) => Object.hasOwn(states, id);
  const entries = selectedDevice
    ? Object.values(registry).filter((entry) => entry.device_id === selectedDevice && available(entry.entity_id))
    : [];

  let anchor = config.state_entity;
  if (!anchor && selectedDevice) {
    const named = entries.filter(({ entity_id }) => /^sensor\.(?:.*_)?dishwasher_state$/.test(entity_id));
    anchor = only(named.length ? named : matchingEntries(entries, roles.state_entity))?.entity_id;
  }
  if (!anchor && !selectedDevice) {
    const named = Object.keys(states).filter((id) => /^sensor\.(?:.*_)?dishwasher_state$/.test(id));
    const translated = Object.values(registry).filter((entry) =>
      entry.device_id && available(entry.entity_id)
      && /^(?:aeg|electrolux|ha_electrolux)$/.test(entry.platform ?? "")
      && matchesKey(entry, roles.state_entity.slice(1))
      && Object.values(registry).some((sibling) => sibling.device_id === entry.device_id
        && sibling.entity_id.startsWith("sensor.") && matchesKey(sibling, ["cycle_phase"])));
    anchor = only([...new Set([...named, ...translated.map(({ entity_id }) => entity_id)])]);
    if (anchor) return discoverEntities(hass, { state_entity: anchor });
  }
  if (!anchor) return {};

  const stateEntry = registry[anchor];
  const prefix = /^sensor\.(.+)_state$/.exec(anchor)?.[1];
  const deviceEntries = entries.filter((entry) => !stateEntry?.platform || entry.platform === stateEntry.platform);
  const discovered = { state_entity: anchor };
  for (const [field, role] of Object.entries(roles)) {
    if (field === "state_entity") continue;
    const [domain, ...keys] = role;
    const siblings = prefix ? keys.map((key) => `${domain}.${prefix}_${key}`).filter((id) =>
      available(id) && (!selectedDevice || !registry[id]?.device_id || registry[id].device_id === selectedDevice)) : [];
    const id = only(siblings) ?? only(matchingEntries(deviceEntries, role))?.entity_id;
    if (id) discovered[field] = id;
  }
  return discovered;
}

export function resolveConfig(hass, config) {
  return { ...discoverEntities(hass, config), ...config };
}
