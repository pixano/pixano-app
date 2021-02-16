/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-polygon';
import { TemplatePluginInstance } from '../models/template-plugin-instance';

export class PluginPolygon extends TemplatePluginInstance {

  constructor(){
    super()
    this.isOpenedPolygon = true;
  }

  get toolDrawer() {
    return html`
        <mwc-icon-button ?selected=${this.mode === 'edit'}
                          title="Edit"
                          icon="navigation"
                          @click="${() => this.mode = 'edit'}">
        </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'create'}
                          icon="add_circle_outline"
                          title="Create polygon"
                          @click="${() => {this.element.isOpenedPolygon = false; this.mode = 'create'}}">
        </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'create'}
                          icon="add_circle_outline"
                          title="Create line"
                          @click="${() => {this.element.isOpenedPolygon = true; this.mode = 'create'}}">
        </mwc-icon-button>
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
                        isOpenedPolygon=${this.isOpenedPolygon}
                        @create=${this.onCreate}
                        @update=${this.onUpdate}
                        @delete=${this.onDelete}
                        @selection=${this.onSelection}
                        @mode=${this.onModeChange}></pxn-polygon>`;
  }
}
customElements.define('plugin-polygon', PluginPolygon);
