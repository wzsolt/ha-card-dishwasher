import { discoverEntities, entityFields, legacyFields, normalizeConfig } from "./config.js";
import { labels } from "./text.js";

export async function loadEditorForm() {
  if (customElements.get("ha-form")) return;
  const helpers = await window.loadCardHelpers?.();
  if (helpers && !customElements.get("hui-entities-card")) {
    await helpers.createCardElement({ type: "entities", entities: [] });
  }
  await customElements.get("hui-entities-card")?.getConfigElement?.();
}

const fields = Object.keys(entityFields);
const deviceField = { name: "device_id", selector: { device: {} } };

export class DishwasherEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.form = document.createElement("ha-form");
    this.shadowRoot.append(this.form);
    this.form.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this.change(event.detail.value);
    });
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.form.hass = hass;
    this.render();
  }

  render() {
    if (!this.config || !this._hass) return;
    const text = labels(this._hass);
    const visible = fields.filter((field) => !legacyFields.includes(field) || this.config[field]);
    const signature = visible.join(",");
    if (this.text !== text || this.signature !== signature) {
      this.text = text;
      this.signature = signature;
      this.form.computeLabel = ({ name }) => text.fields[name] ?? name;
      this.form.schema = [deviceField, ...visible.map((name) => ({
        name, selector: { entity: { filter: { domain: entityFields[name] } } },
      }))];
    }
    const current = { ...discoverEntities(this._hass, this.config), ...this.config };
    const data = Object.fromEntries(["device_id", ...visible].map((field) => [field, current[field]]));
    this.renderedData = data;
    if (!this.form.data || Object.keys(data).some((field) => data[field] !== this.form.data[field])) {
      this.form.data = data;
    }
  }

  change(data) {
    let next = { ...this.config };
    const previous = this.renderedData ?? {};
    if (data.device_id !== previous.device_id || data.state_entity !== previous.state_entity) {
      for (const field of fields) delete next[field];
      delete next.device_id;
      if (data.device_id !== previous.device_id) next.device_id = data.device_id;
      else next.state_entity = data.state_entity;
    } else {
      for (const field of fields) {
        if (data[field] !== previous[field]) next[field] = data[field];
      }
    }
    next = normalizeConfig(next);
    this.config = { ...discoverEntities(this._hass, next), ...next };
    this.render();
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this.config }, bubbles: true, composed: true,
    }));
  }
}
