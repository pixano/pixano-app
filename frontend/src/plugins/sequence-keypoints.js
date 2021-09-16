/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginKeypoints } from './keypoints';
import { sequence } from '../models/mixins/sequence-mixin';

export class PluginSequenceKeypoints extends sequence(PluginKeypoints) {}

customElements.define('plugin-sequence-keypoints', PluginSequenceKeypoints);
