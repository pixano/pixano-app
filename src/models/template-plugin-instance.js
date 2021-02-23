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
import { store, getStoreState } from '../store';
import { createAnnotation,
         updateAnnotation,
         deleteAnnotation } from '../actions/annotations';
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
      const label = {...this.annotations.find((l) => l.id === id)};
      const shape = [...this.element.shapes].find((s) => s.id === id);
      label.options = {};
      Object.keys(value).forEach((key) => {
        label[key] = JSON.parse(JSON.stringify(value[key]));
        shape[key] = label[key];
      });
      shape.color = this._colorFor(label.category);
      store.dispatch(updateAnnotation(label));
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
    if (this.selectedIds.length) {
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
    let { color, ...newAnnotation } = {
      ...JSON.parse(JSON.stringify(newObject)),
      ...this.attributePicker.defaultValue,
      id: Math.random().toString(36)
    };
    if (this.isSequence) {
      newAnnotation.timestamp = this.targetFrameIdx;
    }
    store.dispatch(createAnnotation(newAnnotation));
    this.updateObjectFromAnnotation(newObject, newAnnotation);
  }

  /**
   * Clone object from annotation without deep copy.
   * @param {any} object 
   * @param {any} annotation 
   */
  updateObjectFromAnnotation(object, annotation) {
    Object.keys(annotation).forEach((key) => {
      object[key] = JSON.parse(JSON.stringify(annotation[key]));
    });
    object.color = this._colorFor(annotation.category);
  }

  /**
   * Invoked on instance removal
   * @param {CustomEvent} evt 
   */
  onDelete(evt) {
    const ids = evt.detail;
    ids.forEach((id) => {
      store.dispatch(deleteAnnotation(id));
    });
  }

  /**
   * Invoked on shape change
   * @param {CustomEvent} evt 
   */
  onUpdate(evt) {
    const updatedIds = evt.detail;
    const new_shapes = [...this.element.shapes].filter((s) => updatedIds.includes(s.id));
    new_shapes.forEach((s) => {
      const s2 = JSON.parse(JSON.stringify(s));
      delete s2.color;
      store.dispatch(updateAnnotation(s2));
    });
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
      `
  }

}
customElements.define('template-plugin-instance', TemplatePluginInstance);
