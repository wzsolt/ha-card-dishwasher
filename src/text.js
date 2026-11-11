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
  remainingClock: (clock) => `${clock} remaining`,
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
  fields: [
    "Dishwasher state (required)", "Programme", "Cycle phase", "Door", "Connection", "Alerts",
    "Completed cycles", "Estimated finish", "Formatted remaining time", "Saved programme",
    "Remaining time in seconds", "Estimated progress percentage",
  ],
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
  remainingClock: (clock) => `${clock} van hátra`,
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
  fields: [
    "Mosogatógép állapota (kötelező)", "Program", "Ciklusfázis", "Ajtó", "Kapcsolat", "Figyelmeztetések",
    "Lefutott ciklusok", "Várható befejezés", "Formázott hátralévő idő", "Mentett program",
    "Hátralévő idő másodpercben", "Becsült készültség százalékban",
  ],
};

export function localeFor(hass) {
  const language = hass.locale?.language || hass.language || "en";
  return /^hu(?:[-_]|$)/i.test(language) ? "hu-HU" : "en";
}

export function labels(hass) {
  return localeFor(hass) === "hu-HU" ? hu : en;
}
