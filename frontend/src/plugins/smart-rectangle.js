/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-smart-rectangle';
import { store } from '../store';
import { TemplatePluginInstance } from '../templates/template-plugin-instance';
import { increase, decrease } from '@pixano/core/lib/style';

export class PluginSmartRectangle extends TemplatePluginInstance {

	/**
	 * Invoked on instance creation.
	 * Overwrite to keep automatic category if present
	 * @param {CustomEvent} evt 
	 */
	onCreate(evt) {
		const newObject = evt.detail;
		newObject.id = Math.random().toString(36);
		// add attributes to object without deep copy
		Object.entries(this.attributePicker.defaultValue).forEach(([key, value]) => {
			// do not overwrite category if it was automatically found
			if (key != 'category' || !newObject.category) {
				newObject[key] = JSON.parse(JSON.stringify(value));
			}
		});
		newObject.color = this._colorFor(newObject.category);
		// add timestamp to object
		if (this.isSequence) {
			newObject.timestamp = this.frameIdx;
		}
		this.collect();
	}


	get toolDrawer() {
		return html`
          ${super.toolDrawer}
          <mwc-icon-button icon="flare"
                          @click="${() => this.mode = 'smart-create'}"
                          title="Smart mode">
                          </mwc-icon-button>
          <mwc-icon-button title="ROI increase (+)" @click=${() => this.element.roiUp()}>${increase}</mwc-icon-button>
          <mwc-icon-button title="ROI decrease (-)" @click=${() => this.element.roiDown()}>${decrease}</mwc-icon-button>
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

