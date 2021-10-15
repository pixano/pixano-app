/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-rectangle';
import { TemplatePluginInstance } from '../models/template-plugin-instance';

export class PluginRectangle extends TemplatePluginInstance {

    /**
     * If an ES6 class contains a static getter property but the class itself
     * is un-used, it will correctly be removed from the bundle.
     */
    static dataType() {
      return 'image';
    }

    get editor() {
      return html`<pxn-rectangle id="main"
                            mode=${this.mode}
                            @create=${this.onCreate}
                            @update=${this.onUpdate}
                            @delete=${this.onDelete}
                            @selection=${this.onSelection}
                            @mode=${this.onModeChange}></pxn-rectangle>`;
    }
}
customElements.define('plugin-rectangle', PluginRectangle);
