/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d';
import { PluginTracking } from './tracking';

export class PluginSmartTracking extends PluginTracking {

	get element() {
		return this.shadowRoot.querySelector('pxn-smart-tracking');
	}

	render() {
		return html`<pxn-smart-tracking
                              .tracks = ${this.tracks}
                              @create-track=${this.onUpdate}
                              @selection-track=${(e) => console.log('selection track', e.detail)}
                              @update-tracks=${this.onUpdate}
                              @delete-track=${this.onUpdate}></pxn-smart-tracking>`;
	}
}

customElements.define('plugin-smart-tracking', PluginSmartTracking);
