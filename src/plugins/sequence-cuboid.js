/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginCuboid } from './cuboid';
import { sequence } from '../models/mixins/sequence-mixin';

export class PluginSequenceCuboid extends sequence(PluginCuboid) {}

customElements.define('plugin-sequence-cuboid', PluginSequenceCuboid);
