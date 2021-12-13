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

export class PluginLabelsAtlas extends TemplatePluginInstance {
  constructor() {
    super();
    this.atlas = new Image();
    this.imageIndex = -1;
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

  setNextImageIndex() {
    this.imageIndex = Math.min(this.imageIndex + 1, this.imagesPerAtlas - 1);
  }

  onActivate() {
    super.onActivate();
    const tasks = this.info.tasks;
    const taskName = this.info.taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (!task) return;
    this.imageIndex = getAnnotations().annotations.length || 0;
    this.shortcuts = task.spec.settings.shortcuts;
    this.attributePicker.setAttribute(
      "shortcuts",
      JSON.stringify([
        ["SPACE", "Skip image"],
        ["z", "Undo"],
        ["r", "Redo"],
        ...this.shortcuts.map(({ key, label }) => [key, label]),
      ])
    );
    document.addEventListener("keyup", this.onKeyUp.bind(this));
    this.attributePicker.shadowRoot
      .querySelectorAll(".category")
      .forEach((el) =>
        el.addEventListener("click", this.onCategoryClick.bind(this))
      );

    const atlasPath = getState().media.info.path;
    this.atlas.src = atlasPath;
    this.atlas.addEventListener("load", async () => {
      this.sizeCanvas();
      this.draw();
      this.unsubscriber = store.subscribe(() => {
        this.draw();
      });
    });
  }

  disconnectedCallback() {
    this.unsubscriber();
    document.removeEventListener("keyup", this.onKeyUp);
    this.attributePicker.shadowRoot
      .querySelectorAll(".category")
      .forEach((el) => el.removeEventListener("click", this.onCategoryClick));
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

  onCategoryClick(e) {
    dispatchAnnotations((annotations) => {
      annotations[this.imageIndex] = e.currentTarget.id;
      return annotations;
    });
    this.setNextImageIndex();
    this.draw();
    this.attributePicker.setCategory(null);
  }

  onKeyUp(e) {
    if (e.repeat) return;
    if (e.key === " ") {
      dispatchAnnotations((annotations) => {
        annotations[this.imageIndex] = null;
        return annotations;
      });
      this.setNextImageIndex();
      this.draw();
    } else {
      const shortcut = this.shortcuts.find(
        ({ key }) => `${key}`.toLowerCase() === e.key.toLowerCase()
      );
      if (shortcut) {
        dispatchAnnotations((annotations) => {
          annotations[this.imageIndex] = shortcut.label;
          return annotations;
        });
        this.setNextImageIndex();
      }
    }
    this.draw();
  }

  newData() {
    const atlasPath = getState().media.info.path;
    this.atlas.src = atlasPath;
    this.atlas.addEventListener("load", async () => {
      this.sizeCanvas();
      this.draw();
      this.unsubscriber = store.subscribe(() => {
        this.draw();
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

  onSelection(e) {
    super.onSelection(e);
    console.log(e);
  }

  drawLabel() {
    const labelName = (getAnnotations().annotations || [])[this.imageIndex];
    const category = this.attributePicker.schema.category.find(
      ({ name }) => name === labelName
    );
    if (category) {
      const ctx = this.canvas.getContext("2d");
      ctx.font = "32px sans-serif";
      const x = 16;
      const y = ctx.canvas.height - 16;
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(category.name, x, y);
      ctx.fillStyle = category.color || "#ffffff";
      ctx.fillText(category.name, x, y);
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
    this.drawLabel();
    this.drawCounter();
  }

  get toolDrawer() {
    return html`
      ${super.toolDrawer}
      <mwc-icon-button
        icon="arrow_upward"
        @click=${() => {
          if (this.imageIndex > 0) {
            this.imageIndex--;
            this.draw();
          }
        }}
      ></mwc-icon-button>
      <mwc-icon-button
        icon="arrow_downward"
        @click=${() => {
          if (this.imageIndex < (getAnnotations().annotations || []).length) {
            this.setNextImageIndex();
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
customElements.define("plugin-labels-atlas", PluginLabelsAtlas);
