/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginSegmentation } from './segmentation';
import { sequence } from '../templates/sequence-mixin';
import { getAnnotations, store } from '../store';
import { setAnnotations } from '../actions/annotations';
/**
 * Plugin segmentation.
 * Reads labels as:
 * { id: string, timestamp: number, mask: Base64 }
 */
export class PluginSequenceSegmentation extends sequence(PluginSegmentation) {

	/**
	 * Save current state to redux database (to keep history)
	 * Overwrite because mask api is different from instances.
	 * @param {CustomEvent} evt 
	 */
	collect() {
		const mask = {
			id: this.targetFrameIdx,
			mask: this.element.getMask(),
			timestamp: this.targetFrameIdx
		}
		let allAnnotations = getAnnotations().annotations;
		allAnnotations = allAnnotations.filter((a) => a.timestamp !== this.targetFrameIdx);
		allAnnotations = [...allAnnotations, mask];
		store.dispatch(setAnnotations({ annotations: allAnnotations }));
	}

	onUpdate() {
		this.collect();
	}

	refresh() {
		if (!this.element) {
			return;
		}
		const curr = this.annotations.find((l) => l.timestamp === this.targetFrameIdx);
		if (!curr) {
			this.element.setEmpty();
			return;
		}
		if (curr.mask != this.element.getMask()) {
			this.element.setMask(curr.mask);
		}
	}

}

customElements.define('plugin-sequence-segmentation', PluginSequenceSegmentation);
