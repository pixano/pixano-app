/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import { PluginRectangle } from './rectangle';
import { sequence } from '../templates/sequence-mixin';
import { store } from '../store';
import { setAnnotations } from '../actions/annotations';

export class PluginSequencePointRectangle extends sequence(PluginRectangle) {

	constructor() {
		super();
		this.targetAttribute = 'posture';
		window.addEventListener('keydown', (evt) => {
			if (evt.key === 'x') {
				this.mode = this.mode === 'point' ? 'edit' : 'point';
			}
			if (evt.code == "q") {
				// select occlusion
				const category = this.attributePicker.schema.category[0].properties.find((c) => c.name === "occlusion");
				if (category) {
					this.targetAttribute = category.name;
				}
			}
			if (evt.code == "s") {
				// select occlusion
				const category = this.attributePicker.schema.category[0].properties.find((c) => c.name === "truncation");
				if (category) {
					this.targetAttribute = category.name;
				}
			}
			if (evt.code == "q") {
				// select occlusion
				const category = this.attributePicker.schema.category[0].properties.find((c) => c.name === "posture");
				if (category) {
					this.targetAttribute = category.name;
				}
			}
			if (!isNaN(evt.key)) {
				const attr = this.attributePicker.schema.category[0].properties.find((c) => c.name == this.targetAttribute);
				if (attr == undefined) { return; }
				const num = Math.round(evt.key);
				[...this.element.targetShapes].forEach((s) => {
					if (num < attr.enum.length) {
						s.options[this.targetAttribute] = attr.enum[num];
					}
				});
				this.collect();
				this.updateDisplayOfSelectedProperties();
			}
		});
	}

	get annotations() {
		const annotations = super.annotations;
		return annotations.filter((a) => a.detection != true);
	}

	onPoint(evt) {
		const p = evt.detail;
		const predictions = super.annotations.filter((a) => a.detection);
		if (!predictions.length) {
			console.log('no predictions.')
			return;
		}
		predictions.sort((a, b) => {
			const ax0 = a.geometry.vertices[0];
			const ay0 = a.geometry.vertices[1];
			const acx = 0.5 * (ax0 + a.geometry.vertices[2]);
			const acy = 0.5 * (ay0 + a.geometry.vertices[3]);

			const bx0 = b.geometry.vertices[0];
			const by0 = b.geometry.vertices[1];
			const bcx = 0.5 * (bx0 + b.geometry.vertices[2]);
			const bcy = 0.5 * (by0 + b.geometry.vertices[3]);

			const da = (acx - p.x) * (acx - p.x) + (acy - p.y) * (acy - p.y);
			const db = (bcx - p.x) * (bcx - p.x) + (bcy - p.y) * (bcy - p.y);

			return da - db;
		});
		if (predictions[0] && this.isInside(predictions[0].geometry.vertices, p)) {
			const containedBox = JSON.parse(JSON.stringify(predictions[0]));
			delete containedBox.detection;
			//store.dispatch(updateAnnotation(containedBox));
			store.dispatch(setAnnotations({ annotations: getAnnotations().annotations.map(ann => ann.id === containedBox.id ? containedBox : ann) }));
			this.refresh();
		}
	}

	get editor() {
		return html`<pxn-rectangle id="main"
                              mode=${this.mode}
                              @point=${this.onPoint}
                              @create=${this.onCreate}
                              @update=${this.onUpdate}
                              @delete=${this.onDelete}
                              @selection=${this.onSelection}
                              @mode=${this.onModeChange}></pxn-rectangle>`;
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
            <mwc-icon-button ?selected=${this.mode === 'point'}
                              icon="all_out"
                              title="point"
                              @click="${() => this.mode = 'point'}">
            </mwc-icon-button>
        `
	}

	isInside(box, p) {
		return (
			box[0] <= p.x &&
			p.x <= box[2] &&
			box[1] <= p.y &&
			p.y <= box[3]
		);
	}

}

customElements.define('plugin-sequence-point-rectangle', PluginSequencePointRectangle);