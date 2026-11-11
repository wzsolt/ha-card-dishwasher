import { entityFields, normalizeConfig } from "./config.js";
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
const schema = fields.map((name) => ({
  name, required: name === "state_entity",
  selector: { entity: { filter: { domain: entityFields[name] } } },
}));

export class DishwasherEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.form = document.createElement("ha-form");
    this.form.schema = schema;
    this.shadowRoot.append(this.form);
    this.form.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this.config = normalizeConfig({ ...this.config, ...Object.fromEntries(
        fields.map((field) => [field, event.detail.value[field]]),
      ) });
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: this.config }, bubbles: true, composed: true,
      }));
    });
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
    this.form.data = Object.fromEntries(fields.map((field) => [field, this.config[field]]));
  }

  set hass(hass) {
    const text = labels(hass);
    if (this.text !== text) {
      this.text = text;
      this.form.computeLabel = ({ name }) => text.fields[fields.indexOf(name)] ?? name;
    }
    this.form.hass = hass;
  }
}
