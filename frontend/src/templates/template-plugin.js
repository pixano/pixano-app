/**
 * Template of plugin page to inherit if you want to create
 * your own plugin.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html } from 'lit-element';
import { getState, getAnnotations } from '../store';
import { PluginStyle } from './plugin-style';
// add by Tom
import { GET, PUT } from '../actions/requests';


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
     * Invoked after the element’s template has been created.
     */
    firstUpdated() {
      this.dispatchEvent(new Event('ready'));
    }

    /**
     * Invoked when the plugin is launched.
     * Trigger display of data from the redux store.
     */
    onActivate() {
      if (this.initDisplay) {
        this.initDisplay();
      }
      this.newData();
      // add by Tom
      this.startTime = window.performance.now();
    }

    onDesactivate() {
      super.onDesactivate();
      console.log("on Deactivate")
    }

  /**
   * Recompute labels to be displayed from
   * the redux store
   */
  async initDisplay() {
    const tasks = getState('application').tasks;
    const taskName = getState('application').taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (this.attributePicker && task) {
      this.attributePicker.reloadSchema(task.spec.label_schema);
    }
    // add by Tom
    const media = getState('media');

    const data_id = media.info.id
    const data_info = await GET(`/api/v1/tasks/${taskName}/results/${data_id}`);

    this.element.addEventListener('load', async () => {
      // add by Tom
      var end = window.performance.now();
      var time = end - this.startTime;

      data_info.loading_time_cumulated += time;
      await PUT(`/api/v1/tasks/${taskName}/results/${data_id}`, data_info);

       this.refresh();
     });
  }

  get info() {
    return getState('application');
  }

  /**
   * Getter of redux store annotations
   */
  get annotations() {
    return getAnnotations().annotations;
  }

  /**
   * Handle new media to display
   */
   async newData() {
    const media = getState('media');
    const path = media.info.path;
    this.element.input = path;
   }

  // TODO: bundle attributes into an element
  _colorFor(cat) {
    return this.attributePicker._colorFor(cat);
  }

  /**
   * Invoked when user mode changes from the canvas.
   * Repercute to parent mode.
   */
  onModeChange() {
    if (this.element) {
      this.mode = this.element.mode;
    }
  }

  /**
   * Getter of attribute picker
   */
  get attributePicker() {
    return this.shadowRoot.querySelector('attribute-picker');
  }

  get element() {
    return this.shadowRoot.getElementById('main');
  }

  // add by Tom : commentPanel
  render() {
    return html`
        <div class="drawer">${this.toolDrawer}</div>
        <div class="editor">${this.editor}</div>
        <div class="properties-panel">${this.propertyPanel}</div>
        <div class="comment-panel">${this.commentPanel}</div>
    `;
  }
}
customElements.define('template-plugin', TemplatePlugin);
