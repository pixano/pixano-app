/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { store, getAnnotations, getState } from '../store';
import { setAnnotations } from '../actions/annotations';

/**
 * Mixin wrapping editor sequenced views for a plugin class.
 * @param {TemplatePlugin} baseElement 
 */
export const sequence = (baseElement) =>
	class extends baseElement {

		static dataType() {
			return `sequence_${super.dataType}`;
		}

		/**
		 * Handle new media to display
		 */
		newData() {
			const mediaInfo = getState('media').info;
			if (!mediaInfo.children) {
				return;
			}
			const paths = mediaInfo.children.map((c) => c.path);
			this.element.input = paths;
			this.element.addEventListener('load', () => {
				// refresh annoations on media loaded
				this.refresh();
			});
		}

		get isSequence() {
			return true;
		}

		get targetFrameIdx() {
			return this.element.frameIdx;
		}

		/**
		 * Getter of redux store annotations filtered
		 * by current timestamp.
		 */
		get annotations() {
			const labels = getAnnotations().annotations || [];
			return labels.filter((l) => l.timestamp === this.targetFrameIdx);
		}

		/**
		 * Save current state to redux database (to keep history)
		 * Overwrite because elements generally only trace the current
		 * frame content.
		 * @param {CustomEvent} evt 
		 */
		collect() {
			const shapes = [...this.element.shapes].map(({ color, ...s }) => s);
			let allAnnotations = getAnnotations().annotations || [];
			allAnnotations = allAnnotations.filter((a) => a.timestamp !== this.targetFrameIdx);
			allAnnotations = [...allAnnotations, ...shapes];
			store.dispatch(setAnnotations({ annotations: allAnnotations }));
		}
	};
