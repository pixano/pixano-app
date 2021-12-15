/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2021)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-classification';
import { TemplatePlugin } from '../templates/template-plugin';
import '../helpers/attribute-picker';
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
		if (this.annotations.length===0) this.attributePicker.setAttributes(this.attributePicker.defaultValue);// initialize to default
		else {
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
		return html`<attribute-picker ?showDetail=true @update=${this.onAttributeChanged}></attribute-picker>`
	}

	get editor() {
		return html`<pxn-classification id="main"></pxn-classification>`;
	}
}
customElements.define('plugin-classification', PluginClassification);
