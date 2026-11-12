# AEG Dishwasher Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5)](https://github.com/wzsolt/ha-card-dishwasher#install)
[![GitHub Actions](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/card.yml/badge.svg?branch=main)](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/card.yml)
[![Lint](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/lint.yml/badge.svg?branch=main&event=push)](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/lint.yml)
[![HACS Validation](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/hacs.yml/badge.svg?branch=main)](https://github.com/wzsolt/ha-card-dishwasher/actions/workflows/hacs.yml)
[![Release](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwzsolt%2Fha-card-dishwasher%2Frelease-badge%2Frelease.json)](https://github.com/wzsolt/ha-card-dishwasher/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A read-only dashboard card for an AEG dishwasher in Home Assistant 2026.10 or later. It shows the programme, phase, estimated progress, finish time, selected extras, door and alerts. The illustration animates when a cycle is running, scheduled or finished with the door closed. The card respects reduced-motion preferences and displays labels in Hungarian or English.

The card reads dishwasher data from Home Assistant entities provided by the [AEG integration maintained by Renaud Allard](https://github.com/renaudallard/homeassistant_aeg).

This is an independent community project. The AEG name and logo belong to AEG.

## Install

1. In HACS, open **Custom repositories** and add `https://github.com/wzsolt/ha-card-dishwasher` as a **Dashboard** repository.
2. Download **AEG Dishwasher Card** and reload the dashboard. If you manage resources in YAML, register the JavaScript module URL shown by HACS.
3. Edit the dashboard, add **AEG Dishwasher Card**, and select your dishwasher in the visual editor. If one dishwasher is recognized, the card picker pre-fills its configuration. You can also paste the YAML below into a manual card.

### Manual installation

Download `ha-card-dishwasher.js` from the [latest release](https://github.com/wzsolt/ha-card-dishwasher/releases/latest). Copy it to `/config/www/ha-card-dishwasher.js` and register `/local/ha-card-dishwasher.js` as a **JavaScript Module** dashboard resource. Reload the dashboard. For manual updates, add or change a version query parameter in the resource URL if the browser still serves the old file.

## Configuration

Choose the dishwasher in the visual editor to populate its entity mappings. If several dishwashers are present, select one device or its appliance state sensor. Discovery uses matching entity IDs and the Home Assistant device and entity registries. Review the populated fields and select any entities the card could not identify. Explicit YAML settings take precedence over discovery.

The following dashboard YAML uses the appliance state sensor to identify the other entities for a `kitchen_dishwasher` installation. The [example file](examples/aeg-dishwasher.yaml) is ready to paste into a manual card.

```yaml
type: custom:ha-card-dishwasher
state_entity: sensor.kitchen_dishwasher_state
```

Use `device_id` or `state_entity` to choose the appliance in YAML. If a single dishwasher is recognized, `type: custom:ha-card-dishwasher` is enough. These options are available for manual mappings.

| Option | Purpose |
| --- | --- |
| `device_id` | Home Assistant device ID for discovering the appliance and its entities. |
| `state_entity` | Appliance state, such as `RUNNING`, `PAUSED`, `DELAYED_START` or `END_OF_CYCLE`. |
| `programme_entity` | Programme select entity. The header shows the programme and adds a leaf for Eco. |
| `extra_silent_entity` | Extra Silent switch. |
| `extra_power_entity` | Extra Power switch. |
| `glass_care_entity` | Glass Care switch. |
| `cycle_phase_entity` | Active phase, such as prewash, rinse, or drying. |
| `door_entity` | Door state. A known closed door is required for animation. |
| `connection_entity` | Binary sensor. An explicit `off` shows the disconnected state. |
| `alerts_entity` | Binary sensor. An `on` state shows a warning. |
| `cycles_run_entity` | Cumulative completed cycle count. |
| `finishes_at_entity` | Timestamp for the estimated finish, displayed in Home Assistant's configured time zone. |
| `time_to_end_entity` | Numeric remaining time from the appliance. The card reads the sensor unit and defaults to seconds when absent. |
| `time_to_end_formatted_entity` | Remaining time in `H:MM` or `H:MM:SS`, used when the numeric countdown is unavailable. |

### Programme, extras and estimated progress

Before a cycle, the card shows the selected programme and the active extras. If changing an extra causes the programme selector to report `unknown` or `unavailable`, the card looks up its last valid selection. From delayed start or the start of a running cycle through completion, the header shows the programme and extras selected at that transition. Extra Silent, Extra Power and Glass Care each have an icon when selected.

The card reads the last three days of [Home Assistant Recorder](https://www.home-assistant.io/integrations/recorder/) history. Recorder must retain the appliance state, programme selector, the extra switches you want to recover, and at least one timing entity for the estimate. The data comes from Home Assistant even when the dashboard was closed during the change. If history is incomplete, the card shows the readings it can recover. The estimate is capped at 99% until the appliance reports completion.

### Migrate from v0.1 or Button Card

Update the card and replace the old dashboard YAML with the short example above, or choose the device again in the visual editor. This setup uses the appliance entities and Recorder and requires no template entries in `configuration.yaml`.

Existing card YAML can still use `saved_programme_entity`, `time_remaining_entity`, and `progress_percentage_entity` as overrides. If you want to remove your old template sensors, first check whether another card or automation uses them. The [legacy template example](examples/dishwasher-sensors.yaml) remains available for those setups.

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
