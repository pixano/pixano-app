/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d';
import '@material/mwc-icon-button';
import { TemplatePluginInstance } from '../models/template-plugin-instance';
import { store } from '../store';
import { updateAnnotation } from '../actions/annotations';

export class PluginKeypoints extends TemplatePluginInstance {

  constructor() {
    super();
    window.addEventListener('keydown', (evt) => {
      const lowerKey = evt.key.toLowerCase();
      if (lowerKey === 'c') {
        this.swap();
      }
      if (lowerKey === 'h') {
        this.allVisible();
      }
    });
  }

  firstUpdated() {
    super.firstUpdated();
    // To edit skeleton structure:
    // this.element.settings.vertexNames = ['center']
    console.log(this.element.settings)
    this.element.settings.colorFillType = "order";
    this.element.settings.orderedColors = [
      0xffff00, 0xF44336, 0x008000
    ];

  }
  
  allVisible() {
    const selectedLabels = this.element.selectedShapes;
    if (selectedLabels.length === 1) {
      selectedLabels[0].geometry.visibles = selectedLabels[0].geometry.visibles.map(() => true);
      store.dispatch(updateAnnotation(
        {
          ...JSON.parse(JSON.stringify(selectedLabels[0]))
        }));
    }  
  }

  swap() {
    const selectedLabels = this.element.selectedShapes;
    if (selectedLabels.length === 1) {
      const vs = selectedLabels[0].geometry.vertices;
      selectedLabels[0].geometry.vertices = [vs[0], vs[1], vs[4], vs[5], vs[2], vs[3]];
      store.dispatch(updateAnnotation(
        {
          ...JSON.parse(JSON.stringify(selectedLabels[0]))
        }));
    }
  }

  get toolDrawer() {
    return html`
        ${super.toolDrawer}
        <mwc-icon-button icon="swap_horiz"
                          @click="${() => this.swap()}"
                          title="Swap nodes (c)">
                          </mwc-icon-button>
    `
  }

  get editor() {
    return html`<pxn-graph id="main"
                      mode=${this.mode}
                      @create=${this.onCreate}
                      @update=${this.onUpdate}
                      @delete=${this.onDelete}
                      @selection=${this.onSelection}
                      @mode=${this.onModeChange}></pxn-graph>`;
  }
}
customElements.define('plugin-keypoints', PluginKeypoints);
