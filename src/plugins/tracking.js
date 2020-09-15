/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

// import { TemplatePlugin } from "../models/template-plugin";
// import { sequence } from '../models/mixins/sequence-mixin';
// import { html } from 'lit-element';
// import '@pixano/graphics-2d/lib/pxn-tracking';
// import '@pixano/graphics-2d/lib/pxn-track-panel';
// import { store, getStoreState } from '../store';
// import { initAnnotations, setAnnotations } from '../actions/annotations';

// export class PluginTracking extends sequence(TemplatePlugin) {

//     static get properties() {
//       const s = super.properties || {};
//       return {
//         ...s,
//         selectedTracks: { type: Object },
//         tracks: {type: Object}
//       };
//     }

//     constructor() {
//         super();
//         this.mode = 'edit';
//         this.selectedTracks = new Set();
//         this.tracks = {};
//         window.addEventListener('keydown', (evt) => {
//             if (evt.key == 'Delete') {
//               this.tracker.deleteBox();
//             }
//             if (evt.key == 'Alt') {
//               this.tracker.mode = 'edit';
//             }
//           });
      
//         window.addEventListener('keyup', (evt) => {
//             if (evt.key == 'Alt') {
//               this.tracker.mode = 'create';
//             }
//         });
//     }

//     initDisplay() {
//         const tasks = getStoreState('application').tasks;
//         const taskName = getStoreState('application').taskName;
//         const task = tasks.find((t) => t.name === taskName);
//         if (this.picker && task) {
//             this.picker.reloadSchema(task.spec.label_schema);
//         }
//     }
    
//     /**
//      * Getter of redux store annotations filtered by current timestamp.
//      * Should be overloaded because tracking annotation are not indexed
//      * by timestamp at first and do not need to be filtred by timestamp.
//      */
//     get annotations() {
//       return JSON.parse(JSON.stringify(getStoreState('annotations')));
//     }

//     /**
//      * Fired on timestamp changed.
//      * Should be empty to overload sequence mixin and not call refresh
//      */
//     onTimestampChange() {}

//     /**
//      * Fired when tracks are updated
//      */
//     onUpdateFromTracking() {
//         this.picker.requestUpdate()
//         this.onUpdate();
//     }
    
//     onUpdateFromPanel() {
//         this.tracker.drawTracks();
//         this.onUpdate();
//     }

//     onUpdate() {
//         store.dispatch(setAnnotations(this.tracks));
//     }
  
//     refresh() {
//         if (!this.getView()) {
//           return;
//         }
//         if (Array.isArray(this.annotations)) {
//             // cast default type array to object
//             store.dispatch(initAnnotations({}));
//         }
//         this.tracks = this.annotations;
        
//     }

//     get tracker() {
//         return this.shadowRoot.querySelector('pxn-tracking');
//     }
    
//     get picker() {
//         return this.shadowRoot.querySelector('pxn-track-panel');
//     }

//     get views() {
//         return [html`
//         <pxn-tracking
//             imageIdx=${this.targetFrameIdx}
//             mode=${this.mode}
//             .tracks=${this.tracks}
//             .selectedTracks=${this.selectedTracks}
//             @selection-track=${() => this.picker.requestUpdate()}
//             @create=${(e) => this.picker.newTrack(e)}
//             @update=${this.onUpdateFromTracking}>
//         </pxn-tracking>
        
//         `]
//     }

//     get toolDrawer() {
//         return html``;
//     }

//     get propertyPanel() {
//         return html`
//         <pxn-track-panel
//             imageIdx=${this.targetFrameIdx}
//             mode=${this.mode}
//             .selectedTracks=${this.selectedTracks}
//             .tracks=${this.tracks}
//             @mode=${(e) => this.mode = e.detail}
//             @update=${this.onUpdateFromPanel}
//             @imageIdx-changed=${() => this.imageIdx = this.picker.imageIdx}>
//         </pxn-track-panel>
//         `
//       }
// }

// customElements.define('plugin-tracking', PluginTracking);
