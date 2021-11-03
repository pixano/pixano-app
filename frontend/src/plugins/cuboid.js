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
import { store } from '../store';
import { setAnnotations } from '../actions/annotations';
import { TemplatePluginInstance } from '../templates/template-plugin-instance';


export class PluginCuboid extends TemplatePluginInstance {

    refresh() {
      if (!this.element) {
        return;
      }
      const shapes = JSON.parse(JSON.stringify(this.annotations.map((l) => {
        const color = this._colorFor(l.categoryName);
        return { ...l, color: colorAnyToHexNumber(color) };
      })));
      this.element.editableCuboids = shapes;
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
     * Invoked on attribute change from
     * property panel.
     */
    onAttributeChanged() {
      const value =  this.attributePicker.value;
      this.selectedIds.forEach((id) => {
        const shape = [...this.element.editableCuboids].find((s) => s.id === id);
        shape.options = shape.options || {};
        Object.keys(value).forEach((key) => {
          shape[key] = JSON.parse(JSON.stringify(value[key]));
        });
        shape.color = this._colorFor(shape.categoryName);
        this.collect();
      });
    }

    /**
     * Save current state to redux database (to keep history).
     * Overwrite method to change .shapes to .editableCuboids
     * @param {CustomEvent} evt 
     */
    collect() {
      const shapes = [...this.element.editableCuboids].map(({color, ...s}) => s);
      store.dispatch(setAnnotations({annotations: shapes}));
    }

    get editor() {
      return [
        html`<pxn-cuboid-editor id="main"
        mode=${this.mode}
        @create=${this.onCreate}
        @update=${this.onUpdate}
        @delete=${this.onDelete}
        @selection=${this.onSelection}
        @mode=${this.onModeChange}></pxn-cuboid-editor>`];
    }

    get toolDrawer() {
      return html`
          ${super.toolDrawer}
          <mwc-icon-button icon="3d_rotation" @click=${() => {
            const obj = this.element.rotate();
            if (obj) {
              this.collect();
            }
          }}></mwc-icon-button>
          <mwc-icon-button icon="swap_horiz" @click=${() => {
            const obj = this.element.swap();
            if (obj) {
              this.collect();
            }
          }}></mwc-icon-button>
          <mwc-icon-button @click="${() => this.element.toggleView()}">${camera}</mwc-icon-button>
      `
    }
}
customElements.define('plugin-cuboid', PluginCuboid);
