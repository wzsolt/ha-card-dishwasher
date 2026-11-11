import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { parse } from "yaml";

const bundle = fileURLToPath(new URL("../dist/ha-card-dishwasher.js", import.meta.url));
import { fixture } from "./fixture.js";

const shortConfig = parse(readFileSync(new URL("../examples/aeg-dishwasher.yaml", import.meta.url), "utf8"));
const tag = "ha-card-dishwasher";

async function mount(page, config = fixture, recorder = false) {
  await page.clock.install({ time: new Date("2026-11-11T09:00:00Z") });
  await page.setContent('<style>body { font: 16px Roboto, sans-serif; }</style><main></main>');
  await page.evaluate(() => {
    customElements.define("ha-card", class extends HTMLElement {});
    customElements.define("ha-icon", class extends HTMLElement {});
    customElements.define("ha-form", class extends HTMLElement {});
  });
  await page.addScriptTag({ path: bundle, type: "module" });
  await page.evaluate(({ config, fixture, tag, recorder }) => {
    window.card = document.createElement(tag);
    window.card.setConfig(config);
    window.updateCard = (values) => {
      for (const [field, state] of Object.entries(values)) {
        window.states[fixture[field]] = { state, last_changed: "2026-11-11T08:00:00Z" };
      }
      window.card.hass = {
        states: { ...window.states }, config: { time_zone: "Europe/Budapest" }, locale: { language: "hu" },
        ...(recorder ? { callWS: window.callWS } : {}),
      };
    };
    window.states = {};
    window.calls = [];
    window.callWS = async (request) => {
      window.calls.push(request);
      const at = (time, s, a) => ({ lu: Date.parse("2026-11-11T" + time + "Z") / 1000, s, a });
      return {
        [fixture.state_entity]: [at("07:00:00", "READY_TO_START"), at("08:00:00", "RUNNING")],
        [fixture.programme_entity]: [at("07:59:00", "ECO"), at("07:59:59", "unavailable")],
        [fixture.time_to_end_entity]: [at("08:00:05", "120", { unit_of_measurement: "min" })],
      };
    };
    window.updateCard({
      state_entity: "RUNNING", door_entity: "CLOSED", cycle_phase_entity: "RINSE",
      programme_entity: "unavailable", saved_programme_entity: "ECO",
      cycles_run_entity: "123", progress_percentage_entity: "62", time_remaining_entity: "4440",
      finishes_at_entity: "2026-11-11T10:14:00Z", connection_entity: "on", time_to_end_entity: "4440",
    });
    document.querySelector("main").append(window.card);
  }, { config, fixture, tag, recorder });
}

test("renders the reference layout and preserves the animation across data updates", async (t) => {
  const browser = await chromium.launch({ executablePath: process.env.DISHWASHER_CHROMIUM });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 490, height: 420 } });
  await mount(page);
  assert.equal(await page.locator(".dw-program").textContent(), "Eco");
  assert.equal(await page.locator(".dw-eco").isVisible(), true);
  assert.equal(await page.locator(".dw-cycle-count").textContent(), "Ciklusok: 123");
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), "62");
  assert.equal(await page.locator(".dw-time").textContent(), "Vége 11:14 · 1 óra 14 perc van hátra");
  assert.equal(await page.locator(".dw-phase").textContent(), "Fázis: Öblítés");
  assert.equal(await page.locator(".dw-door").evaluate((node) => getComputedStyle(node).color), "rgb(234, 109, 98)");

  const progress = await page.getByRole("progressbar").boundingBox();
  const timing = await page.locator(".dw-time").boundingBox();
  const phase = await page.locator(".dw-phase").boundingBox();
  assert.ok(progress.y < timing.y && timing.y < phase.y);
  const steam = await page.locator(".dw-steam").boundingBox();
  const frame = await page.locator(".dw-appliance-frame").boundingBox();
  assert.ok(steam.height > 0 && Math.abs(steam.y + steam.height - frame.y) < 1);
  await page.evaluate(() => {
    const root = window.card.shadowRoot;
    window.source = root.querySelector("source");
    window.image = root.querySelector("picture img");
    window.pictureChanges = 0;
    new MutationObserver((changes) => {
      window.pictureChanges += changes.length;
    }).observe(root.querySelector("picture"), { subtree: true, attributes: true, childList: true });
    window.updateCard({ progress_percentage_entity: "63", time_remaining_entity: "4380" });
  });
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), "63");
  assert.equal(await page.evaluate(() => {
    const root = window.card.shadowRoot;
    return window.pictureChanges === 0 && root.querySelector("source") === window.source
      && root.querySelector("picture img") === window.image;
  }), true);

  const running = await page.locator("picture source").getAttribute("srcset");
  await page.evaluate(() => window.updateCard({ state_entity: "DELAYED_START" }));
  assert.equal(await page.locator(".dw-appliance-delayed").count(), 1);
  const delayed = await page.locator("picture source").getAttribute("srcset");
  await page.evaluate(() => window.updateCard({ state_entity: "END_OF_CYCLE" }));
  assert.equal(await page.locator(".dw-appliance-finished").count(), 1);
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), "100");
  const finished = await page.locator("picture source").getAttribute("srcset");
  assert.equal(new Set([running, delayed, finished]).size, 3);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => {
    const img = window.card.shadowRoot.querySelector("picture img");
    return img.complete && img.currentSrc === img.src;
  });
  assert.equal(await page.locator(".dw-steam").isVisible(), false);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const closed = await page.locator("picture img").getAttribute("src");
  await page.evaluate(() => window.updateCard({
    state_entity: "RUNNING", cycle_phase_entity: "DOOR_DRYING", door_entity: "OPEN", alerts_entity: "on",
  }));
  assert.equal(await page.locator("picture source").count(), 0);
  assert.notEqual(await page.locator("picture img").getAttribute("src"), closed);
  assert.match(await page.locator(".dw-phase").textContent(), /Szárítás nyitott ajtóval/);
  assert.equal(await page.locator(".dw-alert").isVisible(), true);

  await page.evaluate(() => window.updateCard({ connection_entity: "off", door_entity: "CLOSED" }));
  assert.equal(await page.locator(".dw-status").textContent(), "Nincs kapcsolat");
  assert.equal(await page.locator("picture source").count(), 0);
  assert.equal(await page.locator(".dw-alert").isVisible(), false);

  await page.setViewportSize({ width: 240, height: 420 });
  assert.equal(await page.locator("ha-card").evaluate((node) => node.scrollWidth <= node.clientWidth), true);
});

test("short YAML recovers the programme and estimated progress through Recorder", async (t) => {
  const browser = await chromium.launch({ executablePath: process.env.DISHWASHER_CHROMIUM });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await mount(page, shortConfig, true);
  await page.getByText("Eco", { exact: true }).waitFor();
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), "38");
  const calls = await page.evaluate(() => window.calls);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "history/history_during_period");
  assert.ok(calls[0].entity_ids.includes(fixture.time_to_end_entity));
  assert.ok(calls[0].entity_ids.includes(fixture.programme_entity));
  assert.ok(!calls[0].entity_ids.includes(fixture.saved_programme_entity));
  await page.evaluate(() => window.updateCard({ cycles_run_entity: "124" }));
  assert.equal(await page.evaluate(() => window.calls.length), 1);
});

test("editor discovers settings from the selected device and preserves manual overrides", async (t) => {
  const browser = await chromium.launch({ executablePath: process.env.DISHWASHER_CHROMIUM });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await mount(page);
  const result = await page.evaluate(async ({ config, fixture }) => {
    const editor = await window.card.constructor.getConfigElement();
    const state = fixture.state_entity;
    const ids = [state, fixture.programme_entity, fixture.time_to_end_entity];
    const hass = {
      ...window.card._hass,
      states: { ...window.states, "sensor.second_dishwasher_state": { state: "IDLE" } },
      entities: Object.fromEntries(ids.map((entity_id) => [entity_id, { entity_id, device_id: "kitchen" }])),
    };
    editor.setConfig({ type: config.type, grid_options: { columns: 9 } });
    editor.hass = hass;
    const form = editor.shadowRoot.querySelector("ha-form");
    const changes = [];
    editor.addEventListener("config-changed", (event) => changes.push(event.detail.config));
    const edit = (overrides) => {
      form.data = { ...form.data, ...overrides };
      form.dispatchEvent(new CustomEvent("value-changed", { detail: { value: form.data } }));
    };
    const ambiguous = form.data.state_entity;
    edit({ device_id: "kitchen" });
    edit({ time_to_end_entity: " sensor.other_duration " });
    return {
      ambiguous, changes, label: form.computeLabel(form.schema[0]),
      stub: window.card.constructor.getStubConfig(window.card._hass),
    };
  }, { config: shortConfig, fixture });
  assert.equal(result.ambiguous, undefined);
  assert.equal(result.label, "Mosogatógép");
  assert.equal(result.changes[0].state_entity, fixture.state_entity);
  assert.equal(result.changes[0].programme_entity, fixture.programme_entity);
  assert.equal(result.changes[0].time_to_end_entity, fixture.time_to_end_entity);
  assert.equal(result.changes[1].time_to_end_entity, "sensor.other_duration");
  assert.deepEqual(result.changes[1].grid_options, { columns: 9 });
  assert.equal(result.stub.state_entity, fixture.state_entity);
  assert.equal(result.stub.programme_entity, fixture.programme_entity);
});
