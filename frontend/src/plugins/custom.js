/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html } from 'lit-element';
import { setAnnotations } from '../actions/annotations';
import { store, getState, getAnnotations } from '../store';

export class PluginCustom extends LitElement {

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
      this.newData();
      // Test saving and retrieving annotations
      this.saveAnnotations();
      this.getAnnotation();
    }

    /**
     * Handle new media to display
     */
    newData() {
      const media = getState('media');
      const path = media.info.path;
      console.log('Image path: ', path);
    }

    saveAnnotations() {
      store.dispatch(setAnnotations({annotations: [{stuff: "1"}]}));
    }

    getAnnotation() {
      const annotations = getAnnotations().annotations;
      console.log('annotations', annotations);
    }

    get editor() {
      return html`Insert your code`;
    }
}
customElements.define('plugin-custom', PluginCustom);