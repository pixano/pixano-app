/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import { getStoreState } from '../../store';
import { Loader } from '../../helpers/data-loader';

/**
 * Mixin wrapping editor views for a plugin class.
 * @param {LitElement} baseElement 
 */
export const views = (baseElement) =>
  class extends baseElement {

    static get properties() {
      const s = super.properties || {};
      return {
        ...s,
        viewsLength: { type: Number }
      };
    }

    static get styles() {
      const s = super.styles ? super.styles : css``;
      return css`
        ${s}
        #container > * {
          flex: 1 1 25%;
          height: inherit;
          width: auto;
        }
        #container {
          display: flex;
          flex-flow: row wrap;
          position: relative;
          width: auto;
          height: 100%;
        }
      `
    }

    constructor() {
      super();
      this.loader = new Loader();
      this.isSequence = false;
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
    }

    /**
     * Handle new media to display
     */
    newData() {
      const media = getStoreState('media');
      let path = media.info.path;
      path = Array.isArray(path) ? path : [path];
      this.loader.load(path).then((data) => {
        path.forEach((p, idx) => {
          const e = this.getView(idx);
          if (e) {
            if (p.split('.').pop() == 'bin') {
              e.pcl = data[idx];
            } else {
              e.imageElement = data[idx];
            }
          }
        });
        this.refresh();
      }); 
    }

    /**
     * Getter of redux store annotations
     */
    get annotations() {
      return getStoreState('annotations');
    }

    /**
     * Get canvas view of the plugin in which to insert
     * a media/annotations.
     * @param {number|undefined} idx Index of the view
     */
    getView(idx) {
      idx = idx || 0;
      return this.shadowRoot.querySelectorAll('#container > *')[idx];
    }

    /**
     * Returns the editor view(s) for the renderer.
     */
    get editor() {
      return html`
      <div id="container">
        ${this.views}
      </div>
      `;
    }
};
