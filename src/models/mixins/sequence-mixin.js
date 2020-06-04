/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import '@pixano/core/lib/playback-control';
import { clearHistory } from '../../actions/annotations';
import { SequenceLoader } from '../../helpers/data-loader';
import { getStoreState, store } from '../../store';

/**
 * Mixin wrapping editor sequenced views for a plugin class.
 * @param {TemplatePlugin} baseElement 
 */
export const sequence = (baseElement) =>
  class extends baseElement {

    static get properties() {
      const s = super.properties || {};
      return {
        ...s,
        maxFrameIdx: { type: Number },
        targetFrameIdx: { type: Number },
        viewsLength: { type: Number }
      };
    }

    static get styles() {
      const s = super.styles ? super.styles : css``;
      return css`
        ${s}
        #container > * {
          flex: 1 1 25%;
          height: auto;
          width: auto;
        }
        #container {
          display: flex;
          flex-flow: row wrap;
          position: relative;
          width: auto;
          height: calc(100% - 50px);
        }
        playback-control {
          background: var(--theme-color);
          color: var(--font-color);
        }
      `
    }

    static dataType() {
      return `sequence_${super.dataType}`;
    }

    constructor() {
      super();
      this.loader = new SequenceLoader();
      this.onSliderUpdate = this.onSliderChange.bind(this);
      this.pendingLoad = false;
      this.isSequence = true;
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
      const mediaInfo = getStoreState('media').info;
      if (!mediaInfo.children) return;

      this.loader.init(mediaInfo.children || []).then((length) => {
        this.maxFrameIdx = Math.max(length - 1, 0);
        this.loader.abortLoading().then(() => {
          this.loader.load(0).then(() => {
            this.playback.set(0);
          });
        })
      });
    }

    /**
     * Fired on playback slider update.
     * @param {CustomEvent} evt 
     */
    onSliderChange(evt) {
      this.targetFrameIdx = evt.detail;
      if (this.pendingLoad) {
        return;
      }
      this.pendingLoad = true;
      this.loader.peekFrame(this.targetFrameIdx).then((data) => {
        store.dispatch(clearHistory());
        this.pendingLoad = false;
        data = Array.isArray(data) ? data : [data];
        data.forEach((d, idx) => {
          const e = this.getView(idx);
          if (e && d instanceof HTMLImageElement) {
            e.imageElement = d;
          } else if (e) {
            e.pcl = d;
          }
        });
        this.refresh();
      });
    }

    /**
     * Getter of redux store annotations filtered
     * by current timestamp.
     */
    get annotations() {
      const labels = getStoreState('annotations');
      return labels.filter((l) => l.timestamp === this.targetFrameIdx);
    }
  
    /**
     * Returns video playback slider element.
     */
    get playback() {
      return this.shadowRoot.querySelector('playback-control');
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
      <playback-control @update=${this.onSliderUpdate} max=${this.maxFrameIdx}></playback-control>
      `;
    }
};
