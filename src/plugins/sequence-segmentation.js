/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginSegmentation } from './segmentation';
import { sequence } from '../models/mixins/sequence-mixin';
import { store } from '../store';
import { createAnnotation,
    updateAnnotation } from '../actions/annotations';
/**
 * Plugin segmentation.
 * Reads labels as:
 * { id: string, timestamp: number, mask: Base64 }
 */
export class PluginSequenceSegmentation extends sequence(PluginSegmentation) {

      onUpdate() {
        const curr = this.annotations.find((l) => l.timestamp === this.targetFrameIdx);
        const im = this.getView().getMask();
        const fn = curr ? updateAnnotation : createAnnotation;
        store.dispatch(fn(
          {
            id: this.targetFrameIdx,
            timestamp: this.targetFrameIdx,
            mask: im
          }));
      }

      refresh() {
        if (!this.getView()) {
          return;
        }
        const curr = this.annotations.find((l) => l.timestamp === this.targetFrameIdx);
        if (!curr) {
          this.getView().setEmpty();
          return;
        }
        if (curr.mask != this.getView().getMask()) {
          this.getView().setMask(curr.mask);
        }
      }

}

customElements.define('plugin-sequence-segmentation', PluginSequenceSegmentation);
