const en = {
  title: "Dishwasher",
  noProgramme: "Programme data unavailable",
  eco: "Eco programme",
  cycleCount: "Cycles",
  cycleCountHelp: "Completed cycles",
  progress: "Estimated progress",
  phase: "Phase",
  open: "Door open",
  closed: "Door closed",
  unknownDoor: "Door state unknown",
  alert: "Warning",
  finishTime: (time) => `Ends at ${time}`,
  remaining: (hours, minutes) => `${hours ? hours + " h " : ""}${minutes} min remaining`,
  states: {
    ready: "Ready to start", readytostart: "Ready to start", idle: "Standby", standby: "Standby",
    off: "Off", delayedstart: "Delayed start", error: "Error", actionrequired: "Action required",
    aborted: "Aborted", inactive: "No programme running", offline: "Disconnected", finished: "Finished",
    paused: "Paused", running: "Programme running", unknown: "Status unavailable",
  },
  phases: {
    prewash: "Prewash", prerinse: "Pre-rinse", mainwash: "Washing", wash: "Washing", washing: "Washing",
    rinse: "Rinsing", rinsing: "Rinsing", finalrinse: "Final rinse", dry: "Drying", drying: "Drying",
    doordrying: "Drying with the door open", drain: "Draining", draining: "Draining",
  },
  remainingClock: (clock) => `${clock} remaining`,
  selectDishwasher: "Select the dishwasher or its state entity.",
  fields: {
    device_id: "Dishwasher device", state_entity: "Dishwasher state", programme_entity: "Programme",
    cycle_phase_entity: "Cycle phase", door_entity: "Door", connection_entity: "Connection",
    alerts_entity: "Alerts", cycles_run_entity: "Completed cycles", finishes_at_entity: "Estimated finish",
    time_to_end_entity: "Remaining time", time_to_end_formatted_entity: "Formatted remaining time",
    saved_programme_entity: "Saved programme (legacy)", time_remaining_entity: "Remaining seconds (legacy)",
    progress_percentage_entity: "Estimated progress (legacy)",
  },
};

const hu = {
  title: "Mosogatógép",
  noProgramme: "Programadat nem érhető el",
  eco: "Eco program",
  cycleCount: "Ciklusok",
  cycleCountHelp: "Lefutott ciklusok",
  progress: "Becsült készültség",
  phase: "Fázis",
  open: "Ajtó nyitva",
  closed: "Ajtó zárva",
  unknownDoor: "Ajtóállapot ismeretlen",
  alert: "Figyelmeztetés",
  finishTime: (time) => `Vége ${time}`,
  remaining: (hours, minutes) => `${hours ? hours + " óra " : ""}${minutes} perc van hátra`,
  states: {
    ready: "Indításra kész", readytostart: "Indításra kész", idle: "Készenlét", standby: "Készenlét",
    off: "Kikapcsolva", delayedstart: "Késleltetett indítás", error: "Hiba",
    actionrequired: "Beavatkozás szükséges", aborted: "Megszakítva", inactive: "Nincs futó program",
    offline: "Nincs kapcsolat", finished: "Kész", paused: "Szünetel", running: "Fut a program",
    unknown: "Nincs állapotadat",
  },
  phases: {
    prewash: "Előmosás", prerinse: "Előöblítés", mainwash: "Mosás", wash: "Mosás", washing: "Mosás",
    rinse: "Öblítés", rinsing: "Öblítés", finalrinse: "Utolsó öblítés", dry: "Szárítás", drying: "Szárítás",
    doordrying: "Szárítás nyitott ajtóval", drain: "Vízleeresztés", draining: "Vízleeresztés",
  },
  remainingClock: (clock) => `${clock} van hátra`,
  selectDishwasher: "Válaszd ki a mosogatógépet vagy az állapotentitását.",
  fields: {
    device_id: "Mosogatógép", state_entity: "Mosogatógép állapota", programme_entity: "Program",
    cycle_phase_entity: "Ciklusfázis", door_entity: "Ajtó", connection_entity: "Kapcsolat",
    alerts_entity: "Figyelmeztetések", cycles_run_entity: "Lefutott ciklusok", finishes_at_entity: "Várható befejezés",
    time_to_end_entity: "Hátralévő idő", time_to_end_formatted_entity: "Formázott hátralévő idő",
    saved_programme_entity: "Mentett program (korábbi)", time_remaining_entity: "Hátralévő másodperc (korábbi)",
    progress_percentage_entity: "Becsült készültség (korábbi)",
  },
};

export function localeFor(hass) {
  const language = hass.locale?.language || hass.language || "en";
  return /^hu(?:[-_]|$)/i.test(language) ? "hu-HU" : "en";
}

export function labels(hass) {
  return localeFor(hass) === "hu-HU" ? hu : en;
}
