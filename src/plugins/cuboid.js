/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-3d';
import '@material/mwc-icon-button';
import { colorAnyToHexNumber } from '@pixano/core/lib/utils';
import { camera } from '../my-icons.js';
import { views } from '../models/mixins/views-mixin';
import { store } from '../store';
import { updateAnnotation, deleteAnnotation } from '../actions/annotations';
import { TemplatePluginInstance } from '../models/template-plugin-instance';


export class PluginCuboid extends views(TemplatePluginInstance) {

    get views() {
      return [
        html`<pxn-cuboid-editor mode=${this.mode}
        @create=${this.onCreate}
        @update=${this.onUpdate}
        @delete=${this.onDelete}
        @selection=${this.onSelection}
        @mode=${this.onModeChange}></pxn-cuboid-editor>`];
    }

    updateObjectFromAnnotation(object, annotation) {
      Object.keys(annotation).forEach((key) => {
        object[key] = JSON.parse(JSON.stringify(annotation[key]));
      });
      const color = this._colorFor(annotation.category);
      object.color = colorAnyToHexNumber(color);
    }

    refresh() {
      if (!this.getView()) {
        return;
      }
      const shapes = JSON.parse(JSON.stringify(this.annotations.map((l) => {
        const color = this._colorFor(l.category);
        return { ...l, color: colorAnyToHexNumber(color) };
      })));
      this.getView().editableCuboids = shapes;
    }

    /**
     * Invoked on instance selection in the canvas.
     * @param {CustomEvent} evt 
     */
    onSelection(evt) {
      this.selectedIds = evt.detail.map((p) => p.id);
      this.updateDisplayOfSelectedProperties();
    }

    /**
     * Invoked on shape change
     * @param {CustomEvent} evt 
     */
    onUpdate(evt) {
      const ann = JSON.parse(JSON.stringify(evt.detail));
      delete ann.color;
      store.dispatch(updateAnnotation(ann));
    }

    /**
     * Invoked on attribute change from
     * property panel.
     */
    onAttributeChanged() {
      const value =  this.attributePicker.value;
      this.selectedIds.forEach((id) => {
        const label = {...this.annotations.find((l) => l.id === id)};
        const shape = [...this.getView().editableCuboids].find((s) => s.id === id);
        label.options = {};
        Object.keys(value).forEach((key) => {
          label[key] = JSON.parse(JSON.stringify(value[key]));
          shape[key] = label[key];
        });
        shape.color = this._colorFor(label.category);
        store.dispatch(updateAnnotation(label));
      });
    }

    /**
     * Invoked on instance removal
     * @param {CustomEvent} evt 
     */
    onDelete(evt) {
      const shape = evt.detail;
      if (shape.id) {
        store.dispatch(deleteAnnotation(shape.id));
      }
    }

    get toolDrawer() {
      return html`
          ${super.toolDrawer}
          <mwc-icon-button icon="3d_rotation" @click=${() => {
            const obj = this.getView().rotate();
            if (obj) {
              store.dispatch(updateAnnotation({...obj}));
            }
          }}></mwc-icon-button>
          <mwc-icon-button icon="swap_horiz" @click=${() => {
            const obj = this.getView().swap();
            if (obj) {
              store.dispatch(updateAnnotation({...obj}));
            }
          }}></mwc-icon-button>
          <mwc-icon-button @click="${() => this.getView().toggleView()}">${camera}</mwc-icon-button>
      `
    }
}
customElements.define('plugin-cuboid', PluginCuboid);