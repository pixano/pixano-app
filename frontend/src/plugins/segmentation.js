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
import { store, getState } from '../store';
import '../helpers/attribute-picker';
import { subtract, union } from '../my-icons';
import { setAnnotations } from '../actions/annotations';
import { TemplatePluginInstance } from '../templates/template-plugin-instance';
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
                         title="Switch instance/semantic"
                         @click="${() => this.maskVisuMode = this.maskVisuMode === 'INSTANCE' ? 'SEMANTIC': 'INSTANCE'}">
                         </mwc-icon-button>
    `
  }

  initDisplay() {
    super.initDisplay();
    const taskName = getState('application').taskName;
    const task = getState('application').tasks.find((t) => t.name === taskName);
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
		const updatedIds = evt.detail;
		let frame = this.annotations;
		// 1) update the mask (always id 0)
		let mask = frame.find((l) => l.id === 0);
		if (!mask) {
			mask = {id: 0, mask: this.element.getMask()};//if the mask already exists => just overwrite the previous mask
			frame.push(mask);//otherwise(first time), create it
		} else {
			mask.mask = this.element.getMask();
		}
		// 2) update annotation info when needed
		let label = frame.find((l) => l.id === JSON.stringify(updatedIds));// search the corresponding id
		if (label) {//id exists in the database, update information
			// nothing to do for annotation infos, only the mask has changed
		} else {// this is a new id
			// create the new label
			label = {...this.attributePicker.defaultValue};
			// store the stringified values
			const value = this.attributePicker.value;
			Object.keys(label).forEach((key) => {
				label[key] = JSON.parse(JSON.stringify(value[key]));
			});
			label.id = JSON.stringify(updatedIds);
			frame.push(label)
		}
		// 3) store the new annotation structure
		store.dispatch(setAnnotations({annotations: frame}));
		// selectedId has also changed, update it
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
		let frame = this.annotations;
		// 1) update the mask (always id 0)
		// change category in element
		const category =  this.attributePicker.selectedCategory;
		this.element.targetClass = category.idx;
		this.element.fillSelectionWithClass(category.idx);
		// get the new mask and store it
		let mask = frame.find((l) => l.id === 0);
		mask.mask = this.element.getMask();//just overwrite the previous mask
		// 2) update annotation info from attributes
		const value = this.attributePicker.value;
		let label = frame.find((l) => l.id === JSON.stringify(this.selectedIds));// search the corresponding id
		Object.keys(value).forEach((key) => {
			label[key] = JSON.parse(JSON.stringify(value[key]));
		});
		// category has changed => selectedId has also changed, update it
		const updatedIds = this.element.selectedId;
		label.id = JSON.stringify(updatedIds);
		this.selectedIds = updatedIds;
		// 3) store the new annotation structure
		store.dispatch(setAnnotations({annotations: frame}));
	}

	/**
	 * Invoked on instance removal
	 * @param {CustomEvent} evt 
	 */
	onDelete(evt) {
		const ids = evt.detail;
		let frame = this.annotations;
		// 1) update the mask (always id 0)
		// get the new mask and store it
		let mask = frame.find((l) => l.id === 0);
		mask.mask = this.element.getMask();//just overwrite the previous mask
		// 2) update annotation info (= delete corresponding id)
		frame = frame.filter((l) => l.id !== JSON.stringify(ids))
		// 3) store the new annotation structure
		store.dispatch(setAnnotations({annotations: frame}));
	}

	refresh() {//get back annotation into element
		if (!this.element) {
			return;
		}
		// 1) get back the mask into element
		let mask = this.annotations.find((l) => l.id === 0);
		if (!mask) this.element.setEmpty();
		else this.element.setMask(mask.mask);
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

	collect() {
		console.log("should not be called")
	}

}
customElements.define('plugin-segmentation', PluginSegmentation);
