/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d';
import '@material/mwc-icon-button';
import { TemplatePluginInstance } from '../templates/template-plugin-instance';
import { store } from '../store';
import { setAnnotations } from '../actions/annotations';

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
    // console.log(this.element.settings)
    // this.element.settings.colorFillType = "order";
    // this.element.settings.orderedColors = [
    //   0xffff00, 0xF44336, 0x008000
    // ];
    const tasks = this.info.tasks;
    const taskName = this.info.taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (!task) {
      return;
    }
    const inputSettings = task.spec.settings || {};
    this.element.settings.radius = inputSettings.radius || this.element.settings.radius;
    this.element.settings.colorFillType = inputSettings.colorFillType || this.element.settings.colorFillType;
    this.element.settings.nodeColors = inputSettings.nodeColors || this.element.settings.nodeColors;
    this.element.settings.vertexNames = inputSettings.vertexNames || this.element.settings.vertexNames;
    this.element.settings.edges = inputSettings.edges || this.element.settings.edges;
    this.element.settings.edgeColorType = inputSettings.edgeColorType || this.element.settings.edgeColorType;
  }
  
  allVisible() {
    const selectedLabels = this.element.selectedShapes;
    if (selectedLabels.length === 1) {
      selectedLabels[0].geometry.visibles = selectedLabels[0].geometry.visibles.map(() => true);
      this.collect();
    }  
  }

  swap() {
    const selectedLabels = this.element.selectedShapes;
    if (selectedLabels.length === 1) {
      const vs = selectedLabels[0].geometry.vertices;
      selectedLabels[0].geometry.vertices = [vs[0], vs[1], vs[4], vs[5], vs[2], vs[3]];
      this.collect();
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
    return html`<pxn-keypoints id="main"
                      mode=${this.mode}
                      @create=${this.onCreate}
                      @update=${this.onUpdate}
                      @delete=${this.onDelete}
                      @selection=${this.onSelection}
                      @mode=${this.onModeChange}></pxn-keypoints>`;
  }
}
customElements.define('plugin-keypoints', PluginKeypoints);
