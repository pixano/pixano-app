/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-smart-segmentation';
import '@material/mwc-icon-button';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-icon';
import { PluginSegmentation } from './segmentation';

/**
 * Plugin segmentation.
 * Reads labels as:
 * { id: 0, mask: Base64 }
 */
export class PluginSmartSegmentation extends PluginSegmentation {

  initDisplay() {
    super.initDisplay();
    const tasks = this.info.tasks;
    const taskName = this.info.taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (!task) {
      return;
    }
    if (task.spec.settings && task.spec.settings.model) {
      this.element.model = task.spec.settings.model;
    }
  }

  get toolDrawer() {
    return html`
        ${super.toolDrawer}
        <mwc-icon-button ?selected=${this.mode === 'smart-create'}
                         icon="add_circle_outline"
                         title="Smart create"
                         @click="${() => this.mode = 'smart-create'}">
                         </mwc-icon-button>
    </div>
    `
  }

  get editor() {
    return html`<pxn-smart-segmentation id="main"
                            mode=${this.mode}
                            maskVisuMode=${this.maskVisuMode}
                            @update=${this.onUpdate}
                            @selection=${this.onSelection}
                            @mode=${this.onModeChange}></pxn-smart-segmentation>`;
  }

}
customElements.define('plugin-smart-segmentation', PluginSmartSegmentation);
