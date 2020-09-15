/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-polygon';
import { TemplatePluginInstance } from '../models/template-plugin-instance';

export class PluginPolygon extends TemplatePluginInstance {

  get toolDrawer() {
    return html`
        ${super.toolDrawer}
        <mwc-icon-button icon="call_merge"
                         @click="${() => this.element.merge()}"
                         title="Group polygons">
                         </mwc-icon-button>
        <mwc-icon-button icon="call_split"
                         @click="${() => this.element.split()}"
                         title="Split polygon">
                         </mwc-icon-button>
    `
  }

  get editor() {
    return html`<pxn-polygon id="main"
                        mode=${this.mode}
                        @create=${this.onCreate}
                        @update=${this.onUpdate}
                        @delete=${this.onDelete}
                        @selection=${this.onSelection}
                        @mode=${this.onModeChange}></pxn-polygon>`;
  }
}
customElements.define('plugin-polygon', PluginPolygon);
