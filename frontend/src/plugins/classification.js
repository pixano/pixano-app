/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2021)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-classification';
import '@pixano/core/lib/attribute-picker';
import { TemplatePlugin } from '../templates/template-plugin';
import { store } from '../store';
import { setAnnotations } from '../actions/annotations';


export class PluginClassification extends TemplatePlugin {

	/**
	 * If an ES6 class contains a static getter property but the class itself
	 * is un-used, it will correctly be removed from the bundle.
	 */
	static dataType() {
		return 'image';
	}

	refresh() {
		if (!this.element) return;
		this.attributePicker.showDetail = true;// exception for classification: always show details
		if (this.annotations.length===0) {// initialize to default
			this.attributePicker.setAttributes(this.attributePicker.defaultValue);
			store.dispatch(setAnnotations({annotations: [this.attributePicker.value]}));//Save current state to redux database (to keep history)
		} else {
			this.element.annotations = JSON.parse(JSON.stringify(this.annotations));
			this.attributePicker.setAttributes(this.element.annotations[0]);
		}
	}

	/**
	 * Invoked on attribute change from
	 * property panel.
	 */
	onAttributeChanged() {
		const value = this.attributePicker.value;
		store.dispatch(setAnnotations({annotations: [value]}));//Save current state to redux database (to keep history)
	}

	/**
	 * Implement property panel content, details always visible
	 */
	get propertyPanel() {
		return html`<attribute-picker @update=${this.onAttributeChanged}></attribute-picker>`
	}

	get editor() {
		return html`<pxn-classification id="main"></pxn-classification>`;
	}
}
customElements.define('plugin-classification', PluginClassification);
