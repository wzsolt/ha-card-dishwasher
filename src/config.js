export const CARD_TYPE = "ha-card-dishwasher";

export const entityFields = {
  state_entity: "sensor",
  programme_entity: "select",
  cycle_phase_entity: "sensor",
  door_entity: "sensor",
  connection_entity: "binary_sensor",
  alerts_entity: "binary_sensor",
  cycles_run_entity: "sensor",
  finishes_at_entity: "sensor",
  time_to_end_formatted_entity: "sensor",
  saved_programme_entity: "sensor",
  time_remaining_entity: "sensor",
  progress_percentage_entity: "sensor",
};

export function normalizeConfig(config) {
  const result = { ...config };
  for (const field of Object.keys(entityFields)) {
    const id = result[field]?.trim();
    if (id) result[field] = id;
    else delete result[field];
  }
  return result;
}
