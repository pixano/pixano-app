/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
 */

import { html } from "lit-element";
import { setAnnotations, undo, redo } from "../actions/annotations";
import { store, getState, getAnnotations } from "../store";
import { TemplatePluginInstance } from "../templates/template-plugin-instance";

// mimic react setState by providing prevState as update callback argument
const dispatchAnnotations = (arg) => {
  if (arg instanceof Function) {
    const prevState = getAnnotations().annotations;
    const nextState = arg(prevState);
    store.dispatch(setAnnotations({ annotations: nextState }));
  } else store.dispatch(setAnnotations({ annotations: arg }));
};

export class PluginKeypointsAtlas extends TemplatePluginInstance {
  constructor() {
    super();
    this.atlas = new Image();
    this.lastMousePosition = { x: 0, y: 0 };
    this.imageIndex = -1;
    this.keypointIndex = 0; // [0-2]
  }

  // 3 clicks / image
  setNextImageIndex() {
    this.imageIndex = ~~((getAnnotations().annotations || []).length / 3);
  }

  setNextkeypointIndex() {
    this.keypointIndex = (getAnnotations().annotations || []).length % 3;
  }

  get label() {
    return (
      this.attributePicker.schema.category[this.keypointIndex] || { name: "" }
    );
  }

  get firstLabelModifier() {
    const formField =
      this.attributePicker.shadowRoot.querySelector(`mwc-formfield`);
    if (!formField) return null;
    const name = formField.getAttribute("label");
    const isActive =
      typeof formField.querySelector("mwc-checkbox").getAttribute("checked") ===
      "string";
    return isActive ? name : null;
  }

  firstUpdated() {
    this.shadowRoot.querySelector(".editor").style = `
       display: flex;
       flex-direction: row;
       justify-content: center;
       align-items: stretch;
     `;
    const tasks = this.info.tasks;
    const taskName = this.info.taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (!task) return;
    const { imagesPerAtlas = 50 } = task.spec.settings;
    this.imagesPerAtlas = imagesPerAtlas;
    this.canvas = this.shadowRoot.querySelector("#frame");
    this.sizeCanvas();
    this.dispatchEvent(new Event("ready"));
  }

  onActivate() {
    super.onActivate();
    this.attributePicker.setAttribute(
      "shortcuts",
      JSON.stringify([
        ["SHIFT", "Toggle label modifier"],
        ["TAB", "Skip image"],
        ["z", "Undo"],
        ["r", "Redo"],
      ])
    );
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    this.attributePicker.showDetails = true;
    this.attributePicker.shadowRoot
      .querySelectorAll(".category")
      .forEach((el) => {
        el.style.pointerEvents = "none";
      });
    const atlasPath = getState().media.info.path;
    this.atlas.src = atlasPath;
    this.atlas.addEventListener("load", async () => {
      this.sizeCanvas();
      this.attributePicker.setCategory(this.label.name);
      this.setNextImageIndex();
      this.draw();
      this.unsubscriber = store.subscribe(() => {
        this.draw();
        this.attributePicker.setCategory(this.label.name);
      });
    });
  }

  disconnectedCallback() {
    this.unsubscriber();
    document.removeEventListener("keydown", this.onKeyDown);
  }

  sizeCanvas() {
    this.canvas.style.aspectRatio = `${this.atlas.width} / ${
      this.atlas.height / this.imagesPerAtlas
    }`;
    const canvasBox = this.canvas.getBoundingClientRect();
    this.canvas.width = canvasBox.width;
    this.canvas.height = canvasBox.height;
    this.zoom = this.canvas.width / this.atlas.width;
  }

  onKeyDown(e) {
    const cleanupFn = (() => {
      switch (e.key) {
        case "Shift": {
          const checkbox = this.attributePicker.shadowRoot.querySelector(
            `mwc-formfield > mwc-checkbox`
          );
          checkbox.setAttribute("checked", "");
          return () => checkbox.removeAttribute("checked");
        }
        case "Tab": {
          dispatchAnnotations((annotations) => {
            annotations[this.imageIndex * 3 + 0] =
              annotations[this.imageIndex * 3 + 1] =
              annotations[this.imageIndex * 3 + 2] =
                { x: null, y: null, modifier: null };
            return annotations;
          });
          return () => void 0;
        }
        case "z": {
          store.dispatch(undo());
          return () => void 0;
        }
        case "r": {
          store.dispatch(redo());
          return () => void 0;
        }
        default:
          return () => void 0;
      }
    })();
    document.addEventListener("keyup", cleanupFn, { once: true });
  }

  newData() {
    const atlasPath = getState().media.info.path;
    this.atlas.src = atlasPath;
    this.atlas.addEventListener("load", async () => {
      this.sizeCanvas();
      this.attributePicker.setCategory(this.label.name);
      this.setNextImageIndex();
      this.draw();
      this.unsubscriber = store.subscribe(() => {
        this.draw();
        this.attributePicker.setCategory(this.label.name);
      });
    });
  }

  drawImage() {
    const ctx = this.canvas.getContext("2d");
    ctx.drawImage(
      this.atlas,
      0,
      -(this.imageIndex * (this.atlas.height / this.imagesPerAtlas)) *
        this.zoom,
      this.atlas.width * this.zoom,
      this.atlas.height * this.zoom
    );
  }

  drawTarget() {
    const ctx = this.canvas.getContext("2d");
    ctx.beginPath();
    const radius = 6;
    ctx.arc(
      this.lastMousePosition.x,
      this.lastMousePosition.y,
      radius,
      0,
      2 * Math.PI,
      false
    );
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.fillRect(0 - 1, this.lastMousePosition.y - 1, this.canvas.width, 2);
    ctx.fillRect(this.lastMousePosition.x - 1, 0 - 1, 2, this.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "32px sans-serif";
    const text = `${this.label.name} ${
      this.firstLabelModifier ? ` (${this.firstLabelModifier})` : ""
    }`;
    const x = this.lastMousePosition.x - (text.length + 1) * 16;
    const y = this.lastMousePosition.y - 12;
    ctx.lineWidth = 3.2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  drawKeypoints() {
    const ctx = this.canvas.getContext("2d");
    for (let i = 0; i < 3; i++) {
      const point = getAnnotations().annotations[this.imageIndex * 3 + i];
      if (point) {
        ctx.beginPath();
        const radius = 6;
        ctx.arc(
          point.x * this.canvas.width,
          point.y * this.canvas.height,
          radius,
          0,
          2 * Math.PI,
          false
        );
        ctx.fillStyle = "red";
        ctx.fill();
      }
    }
  }

  drawCounter() {
    const ctx = this.canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.font = "32px sans-serif";
    const x = 16;
    const y = 32;
    ctx.lineWidth = 3.2;
    const text = `${this.imageIndex + 1} / ${this.imagesPerAtlas}`;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  draw() {
    this.drawImage();
    this.drawCounter();
    this.drawKeypoints();
    this.drawTarget();
  }

  onClick(e) {
    // normalize x, y coords
    const x = e.offsetX / this.canvas.width;
    const y = e.offsetY / this.canvas.height;
    const kptIdx = this.keypointIndex;
    const imgIdx = this.imageIndex;
    dispatchAnnotations((annotations) => {
      return annotations.length > imgIdx * 3 + kptIdx
        ? annotations.map((annotation, index) =>
            index === imgIdx * 3 + kptIdx
              ? {
                  x,
                  y,
                  modifier: this.firstLabelModifier,
                }
              : annotation
          )
        : [...annotations, { x, y, modifier: this.firstLabelModifier }];
    });
    // update counters
    this.keypointIndex += 1;
    if (this.keypointIndex === 3) {
      this.keypointIndex = 0;
      this.imageIndex += 1;
    }
    this.attributePicker.setCategory(this.label.name);
    this.draw();
  }

  onMouseMove(e) {
    this.lastMousePosition = { x: e.offsetX, y: e.offsetY };
    this.draw();
  }

  get toolDrawer() {
    return html`
      ${super.toolDrawer}
      <mwc-icon-button
        icon="arrow_upward"
        @click=${() => {
          if (this.imageIndex > 0) {
            this.imageIndex -= 1;
            this.keypointIndex = 0;
            this.attributePicker.setCategory(this.label.name);
            this.draw();
          }
        }}
      ></mwc-icon-button>
      <mwc-icon-button
        icon="arrow_downward"
        @click=${() => {
          if (
            this.imageIndex <
            ~~((getAnnotations().annotations || []).length / 3)
          ) {
            this.imageIndex += 1;
            this.keypointIndex = 0;
            this.attributePicker.setCategory(this.label.name);
            this.draw();
          }
        }}
      ></mwc-icon-button>
    `;
  }

  get editor() {
    return html`<canvas
      id="frame"
      @click=${this.onClick}
      @mousemove=${this.onMouseMove}
      style="height: 100%;"
    ></canvas>`;
  }
}
customElements.define("plugin-keypoints-atlas", PluginKeypointsAtlas);
