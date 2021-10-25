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
import { subtract, union } from '../my-icons';
import { createAnnotation, updateAnnotation, deleteAnnotation } from '../actions/annotations';
import { TemplatePluginInstance } from '../models/template-plugin-instance';
import { commonJson } from '../helpers/utils';

const EditionMode = {
	ADD_TO_INSTANCE: 'add_to_instance',
	REMOVE_FROM_INSTANCE: 'remove_from_instance',
	NEW_INSTANCE: 'new_instance'
};

/**
 * Plugin segmentation.
 * Reads labels as:
 * { id: 0, mask: Base64 }
 */
export class PluginSegmentation extends TemplatePluginInstance {

  static get properties() {
    return {
      ...super.properties,
      maskVisuMode: { type: String },
	  currentEditionMode: { type: String }
    };
  }

  constructor() {
    super();
    this.mode = 'create';
    this.maskVisuMode = 'SEMANTIC';
	this.currentEditionMode = EditionMode.NEW_INSTANCE;
  }

  get toolDrawer() {
    return html`
        <mwc-icon-button ?selected=${this.mode === 'edit'}
                         title="Select/Edit instance"
                         icon="navigation"
                         @click="${() => this.mode = 'edit'}">
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'create'}
                         icon="add_circle_outline"
                         title="Add instance (Polygon)"
                         @click="${() => this.mode = 'create'}">
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'create-brush'}
                         icon="brush"
                         title="Add instance (Brush)"
                         @click="${() => this.mode = 'create-brush'}">
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.getEditionMode()===EditionMode.ADD_TO_INSTANCE}
                         title="Add to instance (Shift)"
                         @click="${() => this.setEditionMode(EditionMode.ADD_TO_INSTANCE)}">
                         ${union}
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.getEditionMode()===EditionMode.REMOVE_FROM_INSTANCE}
                         title="Remove from instance (Ctrl)"
                         @click="${() => this.setEditionMode(EditionMode.REMOVE_FROM_INSTANCE)}">
                         ${subtract}
                         </mwc-icon-button>
        <mwc-icon-button ?selected=${this.mode === 'lock'}
                         icon="lock"
                         title="Lock instances on click"
                         @click="${() => this.mode = 'lock'}">
                         </mwc-icon-button>
        <mwc-icon-button icon="tonality"
                         title="Switch opacity"
                         @click="${() => this.element.toggleMask()}">
                         </mwc-icon-button>
        <mwc-icon-button icon="filter_center_focus"
                         title="Filter isolated"
                         @click="${() => this.element.filterLittle()}">
                         </mwc-icon-button>
        <mwc-icon-button icon="face"
                         ?selected=${this.maskVisuMode === 'INSTANCE'}
                         title="Switch color"
                         @click="${() => this.maskVisuMode = this.maskVisuMode === 'INSTANCE' ? 'SEMANTIC': 'INSTANCE'}">
                         </mwc-icon-button>
    `
  }

  initDisplay() {
    super.initDisplay();
    const taskName = getStoreState('application').taskName;
    const task = getStoreState('application').tasks.find((t) => t.name === taskName);
    const schema = task.spec.label_schema;
    this.element.clsMap = new Map(
      schema.category.map((c) => {
          const color = colorToRGBA(c.color);
          return [c.idx, [color[0], color[1], color[2], c.instance ? 1 : 0]]
      })
    );
    if (!schema.default) {
      schema.default = schema.category[0].name;
    }
    this.element.targetClass = schema.category.find((c) => c.name === schema.default).idx;
  }

  	/**
	 * Invoked on instance selection in the canvas.
	 * @param {CustomEvent} evt 
	 */
	onSelection(evt) {
		this.selectedIds = evt.detail;
		if (this.selectedIds) {//only one id at a time for segmentation
			const annot = this.annotations.filter((a) => JSON.stringify(this.selectedIds)===(a.id));// search the corresponding id 
			const common = commonJson(annot);
			this.attributePicker.setAttributes(common);
		} else {
			// if null, nothing is selected
			this.selectedIds = [];
		}
	}

	/**
	 * Invoked when a new instance is updated (created = updated for segmentation)
	 * @param {CustomEvent} evt 
	 */
	onUpdate(evt) {
		// 1) update annotation info when needed
		const updatedIds = evt.detail;
		const label = this.annotations.find((l) => l.id === JSON.stringify(updatedIds));// search the corresponding id
		if (label) {//id exists in the database, update information
			// nothing to do for annotation infos, only the mask has changed
		} else {// this is a new id
			// create the new label
			let label = {...this.attributePicker.defaultValue};
			// store the stringified values
			const value = this.attributePicker.value;
			Object.keys(label).forEach((key) => {
				label[key] = JSON.parse(JSON.stringify(value[key]));
			});
			label.id = JSON.stringify(updatedIds);
			store.dispatch(createAnnotation(label));
		}
		// 2) update the mask (always id 0)
		const curr = this.annotations.find((l) => l.id === 0);
		const im = this.element.getMask();
		const fn = curr ? updateAnnotation : createAnnotation;
		store.dispatch(fn({ id: 0, mask: im }));
		this.selectedIds = updatedIds;
	}

	/**
	 * Invoked on attribute change from property panel.
	 */
	onAttributeChanged() {
		if (!this.selectedIds.length) {//nothing is selected
			// only set the category acordingly to the selected attribute
			const category =  this.attributePicker.selectedCategory;
			this.element.targetClass = category.idx;
			return;
		}
		// 2) update the mask (always id 0)
		// change category in element
		const category =  this.attributePicker.selectedCategory;
		this.element.targetClass = category.idx;
		this.element.fillSelectionWithClass(category.idx);
		// get the new mask and store it
		const im = this.element.getMask();
		store.dispatch(updateAnnotation({ id: 0, mask: im }));
		// 1) update annotation info from attributes
		const value = this.attributePicker.value;
		const label = this.annotations.find((l) => l.id === JSON.stringify(this.selectedIds));// search the corresponding id
		Object.keys(value).forEach((key) => {
			label[key] = JSON.parse(JSON.stringify(value[key]));
		});
		// category has changed => selectedId has also changed, update it
		const updatedIds = this.element.selectedId;
		label.id = JSON.stringify(updatedIds);
		this.selectedIds = updatedIds;
		// update store
		store.dispatch(updateAnnotation(label));
	}

	/**
	 * Invoked on instance removal
	 * @param {CustomEvent} evt 
	 */
	onDelete(evt) {
		const ids = evt.detail;
		store.dispatch(deleteAnnotation(JSON.stringify(ids)));// delete the corresponding id in the database
	}

  refresh() {
    if (!this.element) {
      return;
    }
    if (!this.annotations.length) {
      this.element.setEmpty();
      return;
    }
    const mask = this.annotations[0].mask;
    if (mask != this.element.getMask()) {
      this.element.setMask(mask);
    }
  }
  
  getEditionMode() {
    if (this.element) return this.element.editionMode;
    else return undefined;
  }
  setEditionMode(editionMode) {
    if (this.element) this.element.editionMode=editionMode;
    this.currentEditionMode = editionMode;
  }

  get editor() {
    return html`<pxn-segmentation id="main"
                            mode=${this.mode}
                            maskVisuMode=${this.maskVisuMode}
                            @update=${this.onUpdate}
                            @selection=${this.onSelection}
                            @delete=${this.onDelete}
                            @mode=${this.onModeChange}></pxn-segmentation>`;//onCreate never really called for segmentation : the mask is updated
  }

}
customElements.define('plugin-segmentation', PluginSegmentation);
