import closedImage from "./assets/closed.webp";
import openImage from "./assets/open.webp";
import runningImage from "./assets/running.webp";
import runningBaseline from "./assets/running-baseline.webp";
import delayedImage from "./assets/delayed.webp";
import finishedImage from "./assets/finished.webp";
import { CARD_TYPE, discoverEntities, extraFields, normalizeConfig, resolveConfig } from "./config.js";
import { dishwasherView } from "./data.js";
import { DishwasherEditor, loadEditorForm } from "./editor.js";
import { CycleHistory } from "./history.js";
import { labels } from "./text.js";
import { styles } from "./styles.js";

const animations = { running: runningImage, delayed: delayedImage, finished: finishedImage };
const doorIcons = { open: "door-open", closed: "door-closed", unknownDoor: "help-circle-outline" };

const extraIcons = {
  extra_silent_entity: "volume-off",
  extra_power_entity: "lightning-bolt",
  glass_care_entity: "glass-wine",
};

const template = document.createElement("template");
template.innerHTML = `
  <style>${styles}</style>
  <ha-card>
    <div class="dw-setup" hidden></div>
    <div class="dw" hidden>
      <div class="dw-header">
        <div class="dw-emblem" aria-hidden="true"><ha-icon icon="mdi:dishwasher"></ha-icon></div>
        <div class="dw-heading">
          <div class="dw-title"></div>
          <div class="dw-program"></div>
        </div>
        <div class="dw-header-badges">
          <span class="dw-chip dw-eco" role="img" hidden><ha-icon icon="mdi:leaf" aria-hidden="true"></ha-icon></span>
          ${extraFields.map((field) => `
            <span class="dw-chip dw-extra" data-extra="${field}" role="img" hidden>
              <ha-icon icon="mdi:${extraIcons[field]}" aria-hidden="true"></ha-icon>
            </span>`).join("")}
          <span class="dw-chip dw-cycle-count"></span>
        </div>
      </div>
      <div class="dw-body">
        <div class="dw-appliance">
          <picture class="dw-appliance-frame">
            <img alt="">
          </picture>
          <span class="dw-steam" aria-hidden="true"></span>
        </div>
        <div class="dw-detail">
          <div class="dw-headline">
            <span class="dw-percent" hidden><span class="dw-percent-value"></span><span class="dw-percent-unit"> %</span></span>
            <span class="dw-status"></span>
          </div>
          <div class="dw-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" hidden>
            <div class="dw-fill"></div>
          </div>
          <div class="dw-time" hidden></div>
          <div class="dw-phase" hidden><span></span> </div>
          <div class="dw-chips">
            <span class="dw-chip dw-door"><ha-icon aria-hidden="true"></ha-icon> <span></span></span>
            <span class="dw-chip dw-alert dw-warning" hidden><ha-icon icon="mdi:alert-outline" aria-hidden="true"></ha-icon><span></span></span>
          </div>
        </div>
      </div>
    </div>
  </ha-card>`;

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

class DishwasherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
    this.nodes = Object.fromEntries([
      "title", "program", "eco", "cycle-count", "appliance", "appliance-frame", "steam",
      "percent", "percent-value", "status", "track", "fill", "time", "phase", "door", "alert",
    ].map((name) => [name, this.shadowRoot.querySelector(".dw-" + name)]));
    this.extraBadges = [...this.shadowRoot.querySelectorAll("[data-extra]")];
    this.dashboard = this.shadowRoot.querySelector(".dw");
    this.setupMessage = this.shadowRoot.querySelector(".dw-setup");
    this.history = new CycleHistory(() => this.update());
    this.phaseText = this.nodes.phase.appendChild(document.createTextNode(""));
    this.image = this.nodes["appliance-frame"].querySelector("img");
    this.nodes.steam.style.setProperty("--dw-steam-motion", `url("${runningImage}")`);
    this.nodes.steam.style.setProperty("--dw-steam-baseline", `url("${runningBaseline}")`);
  }

  static async getConfigElement() {
    await loadEditorForm();
    return document.createElement(CARD_TYPE + "-editor");
  }

  static getStubConfig(hass) {
    return { type: "custom:" + CARD_TYPE, ...discoverEntities(hass ?? {}) };
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
    this.update();
  }

  set hass(hass) {
    this._hass = hass;
    this.update();
  }

  connectedCallback() {
    this.clock = setInterval(() => this.update(), 30_000);
    this.update();
  }

  disconnectedCallback() {
    clearInterval(this.clock);
    this.history.clear();
  }

  updatePicture(door, animation) {
    if (this.door === door && this.animation === animation) return;
    const { appliance, "appliance-frame": picture } = this.nodes;
    this.door = door;
    this.animation = animation;
    const still = door === "open" ? openImage : closedImage;
    const oldSource = picture.querySelector("source");
    if (animation) {
      const source = oldSource ?? document.createElement("source");
      source.media = "(prefers-reduced-motion: no-preference)";
      source.srcset = animations[animation];
      if (!oldSource) picture.prepend(source);
    } else {
      oldSource?.remove();
    }
    if (this.image.getAttribute("src") !== still) this.image.src = still;
    appliance.className = animation
      ? `dw-appliance dw-appliance-animated dw-appliance-${animation}` : "dw-appliance";
  }

  update() {
    if (!this.config || !this._hass) return;
    const hass = this._hass;
    const config = resolveConfig(hass, this.config);
    this.dashboard.hidden = !config.state_entity;
    this.setupMessage.hidden = Boolean(config.state_entity);
    if (!config.state_entity) {
      this.history.clear();
      setText(this.setupMessage, labels(hass).selectDishwasher);
      return;
    }
    const cycle = this.isConnected ? this.history.update(hass, config) : {};
    const view = dishwasherView(hass, config, Date.now(), cycle);
    const { text, door, percent } = view;
    const nodes = this.nodes;

    this.updatePicture(door, view.animation);
    setText(nodes.title, text.title);
    setText(nodes.program, view.programme);
    nodes.eco.hidden = !view.eco;
    nodes.eco.title = text.eco;
    nodes.eco.setAttribute("aria-label", text.eco);
    for (const badge of this.extraBadges) {
      const field = badge.dataset.extra;
      badge.hidden = !view.extras.includes(field);
      badge.title = text.fields[field];
      badge.setAttribute("aria-label", badge.title);
    }
    nodes["cycle-count"].title = text.cycleCountHelp;
    setText(nodes["cycle-count"], `${text.cycleCount}: ${view.cycles}`);

    nodes.status.classList.toggle("dw-status-large", percent === null);
    setText(nodes.status, view.status);
    nodes.percent.hidden = nodes.track.hidden = percent === null;
    if (percent !== null) {
      setText(nodes["percent-value"], String(percent));
      nodes.track.setAttribute("aria-label", text.progress);
      nodes.track.setAttribute("aria-valuenow", String(percent));
      nodes.fill.style.width = `${percent}%`;
    }

    nodes.time.hidden = !view.timing;
    setText(nodes.time, view.timing);
    nodes.phase.hidden = !view.phase;
    setText(nodes.phase.firstElementChild, text.phase + ":");
    this.phaseText.data = view.phase;

    nodes.door.classList.toggle("dw-warning", door === "open");
    nodes.door.classList.toggle("dw-door-closed", door === "closed");
    nodes.door.firstElementChild.setAttribute("icon", "mdi:" + doorIcons[door]);
    setText(nodes.door.lastElementChild, text[door]);
    nodes.alert.hidden = !view.alert;
    setText(nodes.alert.lastElementChild, text.alert);
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, DishwasherCard);
if (!customElements.get(CARD_TYPE + "-editor")) customElements.define(CARD_TYPE + "-editor", DishwasherEditor);

window.customCards ??= [];
if (!window.customCards.some(({ type }) => type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "AEG Dishwasher Card",
    description: "Programme, progress and door status for an AEG dishwasher.",
    preview: true,
  });
}
