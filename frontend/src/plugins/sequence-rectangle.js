/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginRectangle } from './rectangle';
import { sequence } from '../models/mixins/sequence-mixin';

export class PluginSequenceRectangle extends sequence(PluginRectangle) {}

customElements.define('plugin-sequence-rectangle', PluginSequenceRectangle);