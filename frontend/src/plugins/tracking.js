/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { TemplatePlugin } from "../templates/template-plugin";
import { sequence } from '../templates/sequence-mixin';
import { html } from 'lit-element';
import '@pixano/graphics-2d';
import { store, getState, getAnnotations } from '../store';
import { initAnnotations, setAnnotations } from '../actions/annotations';

export class PluginTracking extends sequence(TemplatePlugin) {

    static get properties() {
      const s = super.properties || {};
      return {
        ...s,
        selectedTracks: { type: Object },
        tracks: {type: Object}
      };
    }

    constructor() {
      super();
      this.mode = 'edit';
      this.tracks = {};
      ////// CUSTOM
      this.targetAttribute = 'posture';
      window.addEventListener('keydown', (evt) => {
        const currId = [...this.element.selectedTrackIds][0];
        if (currId) {
          const currProps = currId ? this.element.categories.find((c) => c.name == this.tracks[currId].category).properties : undefined;
          if (evt.key == "q") {
            // select occlusion
            const category = currProps.find((c) => c.name === "occlusion");
            if (category) {
              this.targetAttribute = category.name;
            }
          }
          if (evt.key == "d") {
            // select truncation
            const category = currProps.find((c) => c.name === "truncation");
            if (category) {
              this.targetAttribute = category.name;
            }
          }
          if (evt.key == "f") {
            // select occlusion
            const category = currProps.find((c) => c.name === "posture");
            if (category) {
              this.targetAttribute = category.name;
            }
          }
          if (!isNaN(evt.key)) {
            const attr = currProps.find((c) => c.name == this.targetAttribute);
            if (attr == undefined) { return; }
            const num = Math.round(evt.key);
            [...this.element.selectedTrackIds].forEach((tid) => {
              this.tracks[tid].keyShapes[this.element.timestamp].labels[this.targetAttribute] = attr.enum[num];
            });
            this.element.requestUpdate();
            store.dispatch(setAnnotations({annotations: this.tracks}));
          }
        }
      });
    }

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

    initDisplay() {
      const tasks = getState('application').tasks;
      const taskName = getState('application').taskName;
      const task = tasks.find((t) => t.name === taskName);
      if (this.element && task.spec.label_schema) {
        this.element.categories = task.spec.label_schema.category;
      }
    }
    
    /**
     * Getter of redux store annotations filtered by current timestamp.
     * Should be overloaded because tracking annotation are not indexed
     * by timestamp at first and do not need to be filtred by timestamp.
     */
    get annotations() {
      return getAnnotations().annotations;
    }

    /**
     * Fired on timestamp changed.
     * Should be empty to overload sequence mixin and not call refresh
     */
    onTimestampChange() {}

    onUpdate() {
      store.dispatch(setAnnotations({annotations: this.tracks}));
    }
  
    refresh() {
        if (!this.element) {
          return;
        }
        if (Array.isArray(this.annotations)) {
            // cast default type array to object
            store.dispatch(initAnnotations({annotations: {}}));
        }
        this.tracks = this.annotations; 
    }

    get element() {
        return this.shadowRoot.querySelector('pxn-tracking');
    }

    render() {
        return html`<pxn-tracking
                              .tracks = ${this.tracks}
                              @create-track=${this.onUpdate}
                              @selection-track=${(e) => console.log('selection track', e.detail)}
                              @update-tracks=${this.onUpdate}
                              @delete-track=${this.onUpdate}></pxn-tracking>`;
    }
}

customElements.define('plugin-tracking', PluginTracking);
