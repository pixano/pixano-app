/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { getStoreState } from '../../store';

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
      const mediaInfo = getStoreState('media').info;
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
      return this.element.targetFrameIdx;
    }

    /**
     * Getter of redux store annotations filtered
     * by current timestamp.
     */
    get annotations() {
      const labels = getStoreState('annotations');
      return labels.filter((l) => l.timestamp === this.targetFrameIdx);
    }
};
