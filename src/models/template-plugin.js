/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html } from 'lit-element';
import { getStoreState } from '../store';
import { PluginStyle } from './plugin-style';

export class TemplatePlugin extends LitElement  {

  static get styles() {
    return PluginStyle;
  }

  static get properties() {
    return {
      mode: { type: String }
    };
  }

  /**
   * Invoked each time the user goes to the plugin page
   */
  onActivate() {
    this.initDisplay();
  }

  /**
   * Recompute labels to be displayed from
   * the redux store
   */
  initDisplay() {
    const tasks = getStoreState('application').tasks;
    const taskName = getStoreState('application').taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (this.attributePicker && task) {
      this.attributePicker.reloadSchema(task.spec.label_schema);
    }
  }

  _colorFor(cat) {
    return this.attributePicker._colorFor(cat);
  }

  /**
   * Invoked when user mode changes from the canvas.
   * Repercute to parent mode.
   */
  onModeChange() {
    if (this.getView()) {
      this.mode = this.getView().mode;
    }
  }

  /**
   * Getter of attribute picker
   */
  get attributePicker() {
    return this.shadowRoot.querySelector('attribute-picker');
  }

  render() {
    return html`
        <div class="drawer">${this.toolDrawer}</div>
        <div class="editor">${this.editor}</div>
        <div class="properties-panel">${this.propertyPanel}</div>
    `;
  }
}
customElements.define('template-plugin', TemplatePlugin);
