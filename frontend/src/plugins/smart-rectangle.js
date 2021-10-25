/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-smart-rectangle';
import { store } from '../store';
import { createAnnotation } from '../actions/annotations';
import { TemplatePluginInstance } from '../models/template-plugin-instance';

export class PluginSmartRectangle extends TemplatePluginInstance {

    onCreate(evt) {
      const newObject = evt.detail;
      let { color, ...newAnnotation } = {
        ...JSON.parse(JSON.stringify(newObject))
      };
      if (!newAnnotation.categoryName) {
        newAnnotation = {...newAnnotation, ...this.attributePicker.defaultValue}
      }
      store.dispatch(createAnnotation(newAnnotation));
      this.updateObjectFromAnnotation(newObject, newAnnotation);
    }

    get toolDrawer() {
      return html`
          ${super.toolDrawer}
          <mwc-icon-button icon="flare"
                          @click="${() => this.mode = 'smart-create'}"
                          title="Smart mode">
                          </mwc-icon-button>
      `
    }

    get editor() {
      return html`
        <pxn-smart-rectangle id="main"
                    mode=${this.mode}
                    @create=${this.onCreate}
                    @update=${this.onUpdate}
                    @delete=${this.onDelete}
                    @mode=${this.onModeChange}
                    @selection=${this.onSelection}></pxn-smart-rectangle>
      `;
    }
}
customElements.define('plugin-smart-rectangle', PluginSmartRectangle);

