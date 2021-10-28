/**
 * Template plugin that handles shape instances
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import '@material/mwc-icon-button';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-icon';
import { commonJson } from '../helpers/utils';
import { store } from '../store';
import { setAnnotations } from '../actions/annotations';
import '../helpers/attribute-picker';
import { TemplatePlugin } from './template-plugin';

export class TemplatePluginInstance extends TemplatePlugin  {
  static get properties() {
    return {
      ...super.properties,
      selectedIds: { type: Array }
    };
  }
  
  constructor(){
    super();
    this.mode = 'edit';
    this.selectedIds = [];
  }

  /**
   * Invoked on attribute change from
   * property panel.
   */
  onAttributeChanged() {
    const value =  this.attributePicker.value;
    this.selectedIds.forEach((id) => {
      const shape = [...this.element.shapes].find((s) => s.id === id);
      shape.options = shape.options || {};
      Object.keys(value).forEach((key) => {
        shape[key] = JSON.parse(JSON.stringify(value[key]));
      });
      shape.color = this._colorFor(shape.category);
      this.collect();
    });
  }

  refresh() {
    if (!this.element) {
      return;
    }
    // need to make immutable variable as not to change directly
    // the redux store
    this.element.shapes = JSON.parse(JSON.stringify(this.annotations.map((l) => {
      return {...l, color: this._colorFor(l.category)}
    })));
  }

  /**
   * Invoked on instance selection in the canvas.
   * @param {CustomEvent} evt 
   */
  onSelection(evt) {
    this.selectedIds = evt.detail;
    this.updateDisplayOfSelectedProperties();
  }

  /**
   * Display in the property panel
   * the labels of the selected instances.
   */
  updateDisplayOfSelectedProperties() {
    if (this.selectedIds && this.selectedIds.length) {
      const shapes = this.annotations.filter((s) => this.selectedIds.includes(s.id));
      const common = commonJson(shapes);
      this.attributePicker.setAttributes(common);
    }
  }

  /**
   * Invoked on instance creation
   * @param {CustomEvent} evt 
   */
  onCreate(evt) {
    const newObject = evt.detail;
    newObject.id = Math.random().toString(36);
    // add attributes to object without deep copy
    Object.entries(this.attributePicker.defaultValue).forEach(([key, value]) => {
      newObject[key] = JSON.parse(JSON.stringify(value));
    });
    // add timestamp to object
    if (this.isSequence) {
      newObject.timestamp = this.targetFrameIdx;
    }
    newObject.color = this._colorFor(newObject.category);
    this.collect();
  }

  /**
   * Invoked on instance update
   * @param {CustomEvent} evt 
   */
  onUpdate() {
    this.collect();
  }

  /**
   * Invoked on instance removal
   * @param {CustomEvent} evt 
   */
  onDelete() {
    this.collect();
  }

  /**
   * Save current state to redux database (to keep history)
   * @param {CustomEvent} evt 
   */
  collect() {
    const shapes = [...this.element.shapes].map(({color, ...s}) => s);
    store.dispatch(setAnnotations({annotations: shapes}));
  }

  /**
   * Implement property panel content
   */
  get propertyPanel() {
    return html`
        <attribute-picker ?showDetail=${this.selectedIds.length === 0}
                            @update=${this.onAttributeChanged}></attribute-picker>
    `
  }

  /**
   * Default implementation of tool drawer
   */
  get toolDrawer() {
      return html`
          <mwc-icon-button ?selected=${this.mode === 'edit'}
                            title="Edit"
                            icon="navigation"
                            @click="${() => this.mode = 'edit'}">
          </mwc-icon-button>
          <mwc-icon-button ?selected=${this.mode === 'create'}
                            icon="add_circle_outline"
                            title="Create"
                            @click="${() => this.mode = 'create'}">
          </mwc-icon-button>
          <mwc-icon-button icon="tonality"
						   title="Hide/Show labels"
						   @click="${() => this.element.toggleLabels()}">
          </mwc-icon-button>
      `
  }

}
customElements.define('template-plugin-instance', TemplatePluginInstance);
