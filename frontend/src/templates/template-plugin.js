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
import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL, getBlob } from "firebase/storage";

function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export class TemplatePlugin extends LitElement  {

  static get styles() {
    return PluginStyle;
  }

  static get properties() {
    return {
      mode: { type: String }
    };
  }

  constructor() {
    super();
    const firebaseConfig = {
      apiKey: "AIzaSyB6DBxN_eymkda8qGu0uFN1rUjDFql8wSo",
      authDomain: "valeo-cp1816-dev.firebaseapp.com",
      projectId: "valeo-cp1816-dev",
      storageBucket: "valeo-cp1816-dev.appspot.com",
      messagingSenderId: "998782652816",
      appId: "1:998782652816:web:e7d46cd8f0c65e29656315",
      measurementId: "G-LQS226E657"
    };
    const firebaseApp = initializeApp(firebaseConfig);

    // Get a reference to the storage service, which is used to create references in your storage bucket
    this.storage = getStorage(firebaseApp);
  }

  getImage(path = "images/my_image.jpg") {
    path = path.replace("https://storage.cloud.google.com/valeo-cp1816-dev.appspot.com/", "");
    return new Promise((resolve, reject) => {
      return getBlob(ref(this.storage, path))
      .then((url) => {
        blobToBase64(url).then((base64) => {
          resolve(base64);
        })
      })
      .catch((error) => {
        console.log('catch', error)
        reject("Failed to download!!!")
      });
    });
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
   * Recompute labels to be displayed from
   * the redux store
   */
  initDisplay() {
    const tasks = getState('application').tasks;
    const taskName = getState('application').taskName;
    const task = tasks.find((t) => t.name === taskName);
    if (this.attributePicker && task) {
      this.attributePicker.reloadSchema(task.spec.label_schema);
    }
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
  newData() {
    const media = getState('media');
    const path = media.info.path;
    this.getImage(path).then((blob) => {
      this.element.input = blob;
    });
    
    this.element.addEventListener('load', () => {
      // refresh annoations on media loaded
      this.refresh();
    });
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

  render() {
    return html`
        <div class="drawer">${this.toolDrawer}</div>
        <div class="editor">${this.editor}</div>
        <div class="properties-panel">${this.propertyPanel}</div>
    `;
  }
}
customElements.define('template-plugin', TemplatePlugin);
