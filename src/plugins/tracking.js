/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { TemplatePlugin } from "../models/template-plugin";
import { sequence } from '../models/mixins/sequence-mixin';
import { html } from 'lit-element';
import '@pixano/graphics-2d';
import { store, getStoreState } from '../store';
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
        this.selectedTracks = new Set();
        this.tracks = {};
    }

    initDisplay() {
      const tasks = getStoreState('application').tasks;
      const taskName = getStoreState('application').taskName;
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
      return JSON.parse(JSON.stringify(getStoreState('annotations')));
    }

    /**
     * Fired on timestamp changed.
     * Should be empty to overload sequence mixin and not call refresh
     */
    onTimestampChange() {}

    onUpdate() {
        store.dispatch(setAnnotations(this.tracks));
    }
  
    refresh() {
        if (!this.element) {
          return;
        }
        if (Array.isArray(this.annotations)) {
            // cast default type array to object
            store.dispatch(initAnnotations({}));
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
