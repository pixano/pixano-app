/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d';
import { sequence } from '../templates/sequence-mixin';
import { store, getState } from '../store';
import { TemplatePlugin } from "../templates/template-plugin";
import { setAnnotations } from '../actions/annotations';

export class PluginTrackingPoint extends sequence(TemplatePlugin) {

  static get properties() {
    const s = super.properties || {};
    return {
      ...s,
      selectedTracks: { type: Object },
      tracks: { type: Object }
    };
  }

  /**
   * Handle new media to display
   */
  newData() {
    const mediaInfo = getState('media').info;
    if (!mediaInfo.children) {
      return;
    }
    const paths = mediaInfo.children.map((c) => c.path);
    this.element.input = paths;
    const onLoad = () => {
      // refresh annoations on media loaded
      this.refresh();
      this.element.removeEventListener('load', onLoad);
    };
    this.element.addEventListener('load', onLoad);
  }

  constructor() {
    super();
    this.targetAttribute = 'posture';
    window.addEventListener('keydown', (evt) => {
      if (evt.key === 'x') {
        this.element.mode = this.element.mode === 'point' ? 'edit' : 'point';
      }
      if (evt.key == "q") {
        // select occlusion
        const category = this.element.categories[0].properties.find((c) => c.name === "occlusion");
        if (category) {
          this.targetAttribute = category.name;
        }
      }
      if (evt.key == "d") {
        // select truncation
        const category = this.element.categories[0].properties.find((c) => c.name === "truncation");
        if (category) {
          this.targetAttribute = category.name;
        }
      }
      if (evt.key == "f") {
        // select occlusion
        const category = this.element.categories[0].properties.find((c) => c.name === "posture");
        if (category) {
          this.targetAttribute = category.name;
        }
      }
      if (!isNaN(evt.key)) {
        const attr = this.element.categories[0].properties.find((c) => c.name == this.targetAttribute);
        if (attr == undefined) { return; }
        const num = Math.round(evt.key);
        [...this.element.selectedTracks].forEach((t) => {
          t.keyShapes[this.element.timestamp].labels[this.targetAttribute] = attr.enum[num];
        });
        this.element.requestUpdate();
        store.dispatch(setAnnotations({annotations: this.tracks}));
      }
    });
  }

  /**
   * Recompute labels to be displayed from
   * the redux store
   */
  initDisplay() {
    const tasks = getState('application').tasks;
    const taskName = getState('application').taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (this.element && task.spec.label_schema) {
      this.element.categories = task.spec.label_schema.category;
    }
  }

  refresh() {
    if (!this.element) {
      return;
    }
    this.tracks = this.annotations || {};
  }

  onUpdate() {
    store.dispatch(setAnnotations({annotations: this.tracks}));
  }

  /**
   * Getter of redux store annotations filtered by current timestamp.
   * Should be overloaded because tracking annotation are not indexed
   * by timestamp at first and do not need to be filtred by timestamp.
   */
  get annotations() {
    return getAnnotations().annotations;
  }

  get detections() {
    const detections = getState('detections');
    if (detections) {
      return detections.filter((l) => l.timestamp === this.targetFrameIdx); // && l.detection);
    } else {
      return [];
    }
    
  }

  onPoint(evt) {
    console.log('on point', this.detections)
    const p = evt.detail;
    const predictions = this.detections.filter((d) => isInside(d.geometry.vertices, p));
    if (!predictions.length) {
      console.log('no predictions.')
      return;
    }
    predictions.sort((a, b) => {
      const ax0 = a.geometry.vertices[0];
      const ay0 = a.geometry.vertices[1];
      const acx = 0.5 * (ax0 + a.geometry.vertices[2]);
      const acy = 0.5 * (ay0 + a.geometry.vertices[3]);

      const bx0 = b.geometry.vertices[0];
      const by0 = b.geometry.vertices[1];
      const bcx = 0.5 * (bx0 + b.geometry.vertices[2]);
      const bcy = 0.5 * (by0 + b.geometry.vertices[3]);

      const da = (acx - p.x) * (acx - p.x) + (acy - p.y) * (acy - p.y);
      const db = (bcx - p.x) * (bcx - p.x) + (bcy - p.y) * (bcy - p.y);

      return da - db;
    });
    if (predictions[0]) {
      const containedBox = predictions[0];
      console.log('Got prediction.')
      // remove detection field in detection for info that its been used
      // it is useless in the annotation object
      delete containedBox.detection;
      // if there is a selected track, add keyshape
      // else create a new track
      if (this.element.selectedTracks.size) {
        const currentTrack = this.element.selectedTracks.values().next().value;
        this.element.addNewKeyShapes([
          {
            ...JSON.parse(JSON.stringify(containedBox)),
            id: currentTrack.id
          }
        ]);
      } else {
        this.element.newTrack({ 
          detail: JSON.parse(JSON.stringify(containedBox))
        });
      }
    } else {
      console.log('no predictions.')
    }
  }

  render() {
    return html`<pxn-tracking id="main"
                            .tracks = ${this.tracks}
                            @point=${this.onPoint}
                            @create-track=${this.onUpdate}
                            @selection-track=${() => {}}
                            @update-tracks=${this.onUpdate}
                            @delete-track=${this.onUpdate}></pxn-tracking>`;
  }

}

customElements.define('plugin-tracking-point', PluginTrackingPoint);


export function isInside(box, p) {
  return (
    box[0] <= p.x &&
    p.x <= box[2] &&
    box[1] <= p.y &&
    p.y <= box[3]
  );
}
