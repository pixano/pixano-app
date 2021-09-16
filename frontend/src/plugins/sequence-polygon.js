/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { PluginPolygon } from './polygon';
import { sequence } from '../models/mixins/sequence-mixin';

export class PluginSequencePolygon extends sequence(PluginPolygon) {}

customElements.define('plugin-sequence-polygon', PluginSequencePolygon);
