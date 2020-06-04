/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-smart-rectangle';
import { store } from '../store';
import { createAnnotation } from '../actions/annotations';
import { views } from '../models/mixins/views-mixin';
import { TemplatePluginInstance } from '../models/template-plugin-instance';

export class PluginSmartRectangle extends views(TemplatePluginInstance) {

    onCreate(evt) {
      const newObject = evt.detail;
      let { color, ...newAnnotation } = {
        ...JSON.parse(JSON.stringify(newObject))
      };
      if (!newAnnotation.category) {
        newAnnotation = {...newAnnotation, ...this.attributePicker.defaultValue}
      }
      store.dispatch(createAnnotation(newAnnotation));
      this.updateObjectFromAnnotation(newObject, newAnnotation);
    }

    get toolDrawer() {
      return html`
          <mwc-icon-button ?selected=${this.mode === 'edit'}
                            title="Edit"
                            icon="navigation"
                            @click="${() => this.mode = 'edit'}">
          </mwc-icon-button>
          <mwc-icon-button ?selected=${this.mode === 'create'}
                            icon="add_circle_outline"
                            title="Create"
                            @click="${() => this.mode = 'create'}">
          </mwc-icon-button>
          <mwc-icon-button icon="flare"
                          @click="${() => this.mode = 'smart-create'}"
                          title="Smart mode">
                          </mwc-icon-button>
      `
    }

    get views() {
      return html`
        <pxn-smart-rectangle
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

