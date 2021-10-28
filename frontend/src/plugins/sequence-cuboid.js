/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginCuboid } from './cuboid';
import { sequence } from '../templates/sequence-mixin';
import { store, getAnnotations } from '../store';
import { setAnnotations } from '../actions/annotations';

export class PluginSequenceCuboid extends sequence(PluginCuboid) {

    /**
     * Save current state to redux database (to keep history)
     * Overwrite method to change .shapes to .editableCuboids.
     * @param {CustomEvent} evt 
     */
    collect() {
        const shapes = [...this.element.editableCuboids].map(({color, ...s}) => s);
        let allAnnotations = getAnnotations().annotations;
        allAnnotations = allAnnotations.filter((a) => a.timestamp !== this.targetFrameIdx);
        allAnnotations = [...allAnnotations, ...shapes];
        store.dispatch(setAnnotations({ annotations: allAnnotations }));
    }
}

customElements.define('plugin-sequence-cuboid', PluginSequenceCuboid);
