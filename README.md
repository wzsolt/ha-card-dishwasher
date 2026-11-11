# AEG Dishwasher Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5)](https://github.com/wzsolt/ha-card-dishwasher#install)
[![GitHub Actions](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/card.yml/badge.svg?branch=main)](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/card.yml)
[![Lint](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/lint.yml/badge.svg?branch=main&event=push)](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/lint.yml)
[![HACS Validation](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/hacs.yml/badge.svg?branch=main)](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/hacs.yml)
[![Release](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwzsolt%2Fha-card-dishwasher%2Frelease-badge%2Frelease.json)](https://github.com/wzsolt/ha-card-dishwasher/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A read-only dashboard card for an AEG dishwasher in Home Assistant 2026.10 or later. It shows the programme, phase, estimated progress, finish time, door and alerts. The illustration animates when a cycle is running, scheduled or finished with the door closed. The card respects reduced-motion preferences and displays labels in Hungarian or English.

## Install

1. In HACS, open **Custom repositories** and add `https://github.com/wzsolt/ha-card-dishwasher` as a **Dashboard** repository.
2. Download **AEG Dishwasher Card** and reload the dashboard. If you manage resources in YAML, register the JavaScript module URL shown by HACS.
3. Edit the dashboard, add **AEG Dishwasher Card**, and select the entities in the visual editor. You can also paste the YAML below into a manual card.

### Manual installation

Download `ha-card-dishwasher.js` from the [latest release](https://github.com/wzsolt/ha-card-dishwasher/releases/latest). Copy it to `/config/www/ha-card-dishwasher.js` and register `/local/ha-card-dishwasher.js` as a **JavaScript Module** dashboard resource. Reload the dashboard. For manual updates, add or change a version query parameter in the resource URL if the browser still serves the old file.

## Configuration

Use the entities supplied by your dishwasher integration. The example uses the `kitchen_dishwasher` entity IDs.

```yaml
type: custom:ha-card-dishwasher
state_entity: sensor.kitchen_dishwasher_state
programme_entity: select.kitchen_dishwasher_programme
cycle_phase_entity: sensor.kitchen_dishwasher_cycle_phase
door_entity: sensor.kitchen_dishwasher_door
connection_entity: binary_sensor.kitchen_dishwasher_connection
alerts_entity: binary_sensor.kitchen_dishwasher_alerts
cycles_run_entity: sensor.kitchen_dishwasher_cycles_run
finishes_at_entity: sensor.kitchen_dishwasher_finishes_at
time_to_end_formatted_entity: sensor.kitchen_dishwasher_time_to_end_formatted
saved_programme_entity: sensor.dishwasher_saved_programme
time_remaining_entity: sensor.dishwasher_time_remaining
progress_percentage_entity: sensor.dishwasher_progress_percentage
```

| Option | Purpose |
| --- | --- |
| `state_entity` | Required. Appliance state, such as `RUNNING`, `PAUSED`, `DELAYED_START` or `END_OF_CYCLE`. |
| `programme_entity` | Programme select entity. The header shows the programme and adds a leaf for Eco. |
| `cycle_phase_entity` | Active phase, such as prewash, rinse, or drying. |
| `door_entity` | Door state. A known closed door is required for animation. |
| `connection_entity` | Binary sensor. An explicit `off` shows the disconnected state. |
| `alerts_entity` | Binary sensor. An `on` state shows a warning. |
| `cycles_run_entity` | Cumulative completed cycle count. |
| `finishes_at_entity` | Timestamp for the estimated finish, displayed in Home Assistant's configured time zone. |
| `time_to_end_formatted_entity` | Remaining time in `H:MM` or `H:MM:SS`, used when remaining seconds are unavailable. |
| `saved_programme_entity` | Template sensor that preserves the last valid programme during the cycle. |
| `time_remaining_entity` | Template sensor with the remaining time in seconds. |
| `progress_percentage_entity` | Template sensor with the estimated progress. The card shows 100% when the appliance reports completion. |

### Save the programme and estimate progress

If the template sensors already exist, select those entities in the card. Otherwise add the blocks under `template:` in [the template sensor example](examples/dishwasher-sensors.yaml) to your existing `template:` list in `configuration.yaml`. If you do not already have a `template:` key, include it once. Replace the raw dishwasher entity IDs with yours, including the numeric `time_to_end` sensor. Check the Home Assistant configuration, reload Template entities, then confirm the entity IDs in **Developer tools → States**. [Home Assistant Template integration](https://www.home-assistant.io/integrations/template/)

The trigger-based sensors run on the Home Assistant server and restore their values after a restart. The progress estimate uses the remaining time captured when a running cycle first reports a positive duration. A cycle that is already running at setup can use only its current remaining time as a baseline. If the programme select is already unavailable and there is no saved programme, the header shows “Programme data unavailable” until a valid selection can be captured.

## Migrate from Button Card

Keep your existing dishwasher template sensors. Install this card, then replace the old card YAML with [the standalone card example](examples/aeg-dishwasher.yaml) and update the entity IDs if they differ. Confirm the programme, progress and door state. The illustrations and animations ship in the JavaScript module.

## Develop and release

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright-core install chromium
npm run test:browser
```

Set `DISHWASHER_CHROMIUM` to use an existing Chromium or Chrome executable. The bundle is built at `dist/ha-card-dishwasher.js`. GitHub Actions runs the checks and publishes the module when a matching version tag is pushed. Update the package version, lockfile and `CHANGELOG.md` before tagging. The HACS Validation workflow verifies the latest stable release and updates the release badge.

The supplied dishwasher WebP illustrations are bundled with the card. The MIT license covers the card code and documentation.
