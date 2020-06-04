/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@pixano/graphics-2d/lib/pxn-segmentation';
import '@material/mwc-icon-button';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-icon';
import { colorToRGBA } from '@pixano/core/lib/utils';
import { store, getStoreState } from '../store';
import '../helpers/attribute-picker';
import { views } from '../models/mixins/views-mixin';
import { subtract, union } from '../my-icons';
import { createAnnotation,
         updateAnnotation } from '../actions/annotations';
import { TemplatePlugin } from '../models/template-plugin';

/**
 * Plugin segmentation.
 * Reads labels as:
 * { id: 0, mask: Base64 }
 */
export class PluginSegmentation extends views(TemplatePlugin) {

  static get properties() {
    return {
      ...super.properties,
      maskVisuMode: { type: String }
    };
  }

  constructor() {
    super();
    this.mode = 'select';
    this.maskVisuMode = 'INSTANCE';
    this.selectedIds = [0,0,0];
    window.addEventListener('keydown', (evt) => {
      if (evt.key === 'Alt') {
        this.mode = this.mode === 'create' ? 'select' : 'create';
      }
    });
  }

  get views() {
    return [
      html`<pxn-segmentation mode=${this.mode}
                            maskVisuMode=${this.maskVisuMode}
                            @update=${this.onUpdate}
                            @selection=${this.onSelection}
                            @mode=${this.onModeChange}></pxn-segmentation>`];
  }

  get toolDrawer() {
    return html`
        <mwc-icon-button ?selected=${this.mode === 'select'}
                         title="Edit"
                         icon="navigation"
                         @click="${() => this.mode = 'select'}">
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'create'}
                         icon="add_circle_outline"
                         title="Create"
                         @click="${() => this.mode = 'create'}">
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'edit-add'}
                         title="Union"
                         @click="${() => this.mode = 'edit-add'}">
                         ${union}
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'edit-remove'}
                         title="Subtract"
                         @click="${() => this.mode = 'edit-remove'}">
                         ${subtract}
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'lock'}
                         icon="lock"
                         title="Lock instances on click"
                         @click="${() => this.mode = 'lock'}">
                         </mwc-icon-button>
        <mwc-icon-button icon="tonality"
                         title="Switch opacity"
                         @click="${() => this.getView().toggleMask()}">
                         </mwc-icon-button>
        <mwc-icon-button icon="filter_center_focus"
                         title="Filter isolated"
                         @click="${() => this.getView().filterLittle()}">
                         </mwc-icon-button>
        <mwc-icon-button icon="face"
                         ?selected=${this.maskVisuMode === 'INSTANCE'}
                         title="Switch color"
                         @click="${() => this.maskVisuMode = this.maskVisuMode === 'INSTANCE' ? 'SEMANTIC': 'INSTANCE'}">
                         </mwc-icon-button>
    </div>
    `
  }

  initDisplay() {
    super.initDisplay();
    const taskName = getStoreState('application').taskName;
    const task = getStoreState('application').tasks.find((t) => t.name === taskName);
    const schema = task.spec.label_schema;
    this.getView().clsMap = new Map(
      schema.category.map((c) => {
          const color = colorToRGBA(c.color);
          return [c.idx, [color[0], color[1], color[2], c.instance ? 1 : 0]]
      })
    );
    this.getView().targetClass = schema.category.find((c) => c.name === schema.default).idx;
  }

  onUpdate() {
    const curr = this.annotations.find((l) => l.id === 0);
    const im = this.getView().getMask();
    const fn = curr ? updateAnnotation : createAnnotation;
    store.dispatch(fn(
      {
        id: 0,
        mask: im
      }));
  }

  onSelection(evt) {
    this.selectedIds = evt.detail;
    this.updateDisplayOfSelectedProperties();
  }

  updateDisplayOfSelectedProperties() {
    if (this.selectedIds && this.selectedIds.length) {
      this.attributePicker.setAttributesIdx(this.selectedIds[2]);
    } else {
      this.attributePicker.setAttributesIdx();
    }
  }

  onAttributeChanged() {
    const value =  this.attributePicker.selectedCategory;
    this.getView().targetClass = value.idx;
    if (this.selectedIds && this.selectedIds.length
        && (this.selectedIds[0] != 0 || this.selectedIds[1] != 0 || this.selectedIds[2] != 0)) {
      this.getView().fillSelectionWithClass(value.idx);
      this.onUpdate();
    }
  }

  get propertyPanel() {
    return html`
        <attribute-picker @update=${this.onAttributeChanged}></attribute-picker>
    `
  }

  refresh() {
    if (!this.getView()) {
      return;
    }
    if (!this.annotations.length) {
      this.getView().setEmpty();
      return;
    }
    const mask = this.annotations[0].mask;
    if (mask != this.getView().getMask()) {
      this.getView().setMask(mask);
    }
  }

}
customElements.define('plugin-segmentation', PluginSegmentation);
