export const styles = `
:host { display: block; }

ha-card {
  background: #1b1b1b;
  color: #ededed;
  border: 1px solid #383838;
  border-radius: 13px;
  box-shadow: none;
  padding: 12px;
  cursor: default;
}

[hidden] { display: none !important; }

.dw {
  --dw-accent: #10a3df;
  --dw-blue-text: #85cbed;
  --dw-muted: #b4b4b4;
  text-align: left;
  line-height: 1.25;
  white-space: normal;
}

.dw-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.dw-emblem {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--dw-accent);
  background: #132f3a;
}

.dw-emblem ha-icon { --mdc-icon-size: 23px; }

.dw-heading { flex: 1 1 7rem; min-width: 0; }

.dw-header-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;
  white-space: nowrap;
}

.dw-title { font-size: 17px; font-weight: 600; }

.dw-program {
  margin-top: 2px;
  color: var(--dw-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.dw-body {
  display: grid;
  grid-template-columns: clamp(52px, 17%, 76px) minmax(0, 1fr);
  align-items: center;
  column-gap: clamp(8px, 3%, 12px);
  min-height: 86px;
}

.dw-appliance, .dw-appliance-frame {
  display: block;
  min-width: 0;
}

.dw-appliance-frame img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 151 / 172;
  object-fit: contain;
}

.dw-steam { display: none; }

@media (prefers-reduced-motion: no-preference) {
  .dw-appliance-animated {
    --dw-crop-left: 27;
    --dw-crop-width: 76;
    --dw-canvas-height: 232;
    position: relative;
    aspect-ratio: var(--dw-crop-width) / 96;
  }
  .dw-appliance-animated .dw-appliance-frame {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .dw-appliance-running {
    --dw-steam-height: 19;
    margin-top: calc(100% * var(--dw-steam-height) / var(--dw-crop-width));
  }
  .dw-appliance-delayed, .dw-appliance-finished {
    --dw-crop-left: 26;
    --dw-crop-width: 84;
  }
  .dw-appliance-finished {
    --dw-canvas-height: 343;
  }
  .dw-appliance-animated .dw-appliance-frame img {
    /* Show y=73–169 of the 492-pixel-wide reference animations. */
    position: absolute;
    top: 0;
    left: calc(-100% * var(--dw-crop-left) / var(--dw-crop-width));
    width: calc(100% * 492 / var(--dw-crop-width));
    max-width: none;
    aspect-ratio: auto;
    transform: translateY(calc(-100% * 73 / var(--dw-canvas-height)));
  }
  .dw-appliance-running .dw-steam {
    /* The first frame cancels the source header in the strip from y=54 to y=73. */
    display: block;
    position: absolute;
    inset-inline: 0;
    bottom: 100%;
    height: calc(100% * var(--dw-steam-height) / 96);
    background-image: var(--dw-steam-motion), var(--dw-steam-baseline);
    background-size: calc(100% * 492 / var(--dw-crop-width)) auto;
    background-position:
      calc(100% * var(--dw-crop-left) / (492 - var(--dw-crop-width)))
      calc(100% * 54 / (var(--dw-canvas-height) - var(--dw-steam-height)));
    background-repeat: no-repeat;
    background-blend-mode: difference, normal;
    mix-blend-mode: screen;
    pointer-events: none;
  }
}

.dw-detail { min-width: 0; }

.dw-headline {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 8px;
}

.dw-percent { font-size: 30px; font-variant-numeric: tabular-nums; }

.dw-percent-unit { font-size: 15px; color: var(--dw-muted); }

.dw-status { font-size: 13px; font-weight: 600; color: var(--dw-blue-text); }

.dw-status-large { font-size: 23px; font-weight: 500; }

.dw-track {
  height: 4px;
  margin-top: 5px;
  border-radius: 99px;
  overflow: hidden;
  background: #343434;
}

.dw-fill {
  height: 100%;
  background: var(--dw-accent);
  border-radius: inherit;
  transition: width 250ms ease-out;
}

.dw-phase, .dw-time {
  margin-top: 5px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.dw-phase span, .dw-time { color: var(--dw-muted); }

.dw-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.dw-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 99px;
  background: #2c2c2c;
  color: #c3c3c3;
  font-size: 11px;
  font-weight: 500;
}

.dw-chip ha-icon { --mdc-icon-size: 13px; }

.dw-warning { background: #483617; color: #ffd88b; }

.dw-door-closed { background: #342421; color: #ea6d62; }

.dw-eco { background: #21372a; color: #7ed89c; }
.dw-extra { background: #153544; color: #85cbed; }

.dw-cycle-count { background: #153544; color: #85cbed; font-variant-numeric:
tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  .dw-fill { transition: none; }
}
`;
