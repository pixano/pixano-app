/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import TemplatePage from '../templates/template-page';
import { store, getState } from '../store';
import { installRouter } from 'pwa-helpers/router.js';
import { updateTaskName, fetchResult, fetchBackwardResult, fetchForwardResult } from '../actions/application';
import '@material/mwc-icon';
import '@material/mwc-icon-button';


export class AppExplore extends TemplatePage {

	static get properties() {
		return {
			pluginName: { type: String },
			dataPath: { type: String }
		};
	}

	constructor() {
		super();
		installRouter(this._locationChanged.bind(this));
		this.dataPath = '';
	}

	/**
	 * Activate from url on url change.
	 */
	_locationChanged() {
		if (this.active) {
			this.onActivate();
		}
	}

	onActivate() {
		const paths = window.location.hash.split('/');
		const taskName = decodeURI(paths[1]);
		const dataId = paths[2];
		store.dispatch(updateTaskName(taskName));
		const task = getState('application').tasks.find((t) => t.name === taskName);
		this.pluginName = task.spec.plugin_name;

		this.launchPlugin(this.pluginName).then((mod) => {
			store.dispatch(fetchResult(dataId)).then(() => {
				mod.onActivate();
				this.dataPath = this.path;
			});
		});
	}

	/**
	 * Get or import and create plugin.
	 * @param {String} pluginName 
	 */
	add(pluginName) {
		if (this.pluginContainer.firstElementChild &&
			this.pluginContainer.firstElementChild.tagName.toLowerCase() === `plugin-${pluginName}`.toLowerCase()) {
			return Promise.resolve(this.pluginContainer.firstElementChild);
		}
		return new Promise((resolve) => {
			if (this.pluginContainer.firstElementChild) {
				let el = this.el;
				el.remove();
			}
			const newElement = document.createElement(`plugin-${pluginName}`);
			this.pluginContainer.appendChild(newElement);
			newElement.addEventListener('ready', () => {
				return resolve(newElement);
			})
		});
	}

	/**
	 * Import plugin from its filename.
	 * @param {string} pluginName 
	 */
	launchPlugin(pluginName) {
		return new Promise((resolve) => {
			const filename = `${pluginName}`;
			import("../plugins/" + filename + ".js").then(() => {
				return this.add(pluginName).then((res) => {
					resolve(res);
				})
			});
		});
	}

	/**
	 * Generic method to handle next/previous data request.
	 * @param {*} fetchFn 
	 */
	goNext(fetchFn) {
		const currentDataId = getState('application').dataId;
		store.dispatch(fetchFn()).then(() => {
			this.el.newData();
			// Store new url with correct id if new
			const appState = getState('application');
			const nextDataId = appState.dataId;
			if (nextDataId !== currentDataId) {
				const page = '/#explore/' + appState.taskName + '/' + nextDataId;
				window.history.pushState({}, '', encodeURI(page));
				this.dataPath = this.path;
			}
		});
	}

	/**
	 * Go to previous data.
	 */
	goBackward() {
		this.goNext(fetchBackwardResult);
	}

	/**
	 * Go to next data.
	 */
	goForward() {
		this.goNext(fetchForwardResult);
	}

	get pluginContainer() {
		try {
			return this.shadowRoot.getElementById('plugin-container');
		} catch {
			return null;
		}
	}

	/**
	 * Getter for faster retrieval of
	 * the plugin.
	 */
	get el() {
		try {
			return this.pluginContainer.firstElementChild;
		} catch {
			return null;
		}
	}

	static get styles() {
		return [super.styles, css`
        .header {
          display: flex;
          -webkit-touch-callout: none; /* iOS Safari */
            -webkit-user-select: none; /* Safari */
              -khtml-user-select: none; /* Konqueror HTML */
                -moz-user-select: none; /* Old versions of Firefox */
                -ms-user-select: none; /* Internet Explorer/Edge */
                    user-select: none; /* Non-prefixed version, currently
                                          supported by Chrome, Opera and Firefox */
        }
        #plugin-container {
          height: calc(100% - 50px);
        }
      `]
	}

	get path() {
		const media = getState('media');
		const task = media.info.path.replace('//', '/');
		return task;
	}

	get headerContent() {
		return html`
      <mwc-icon-button style="margin: 0;" icon="keyboard_backspace" @click=${() => this.goHome()}></mwc-icon-button>
      <h1>${this.pluginName}-explore</h1>
      <p style="user-select: text;">${this.dataPath}</p>
      <mwc-icon-button icon="arrow_back"
                       @click=${() => this.goBackward()}
                       title="Previous"></mwc-icon-button>
      <mwc-icon-button icon="arrow_forward"
                       @click=${() => this.goForward()}
                       title="Next"></mwc-icon-button>
      `
	}

	get body() {
		return html`
        <div id="plugin-container"></div>
      `
	}
}
customElements.define('app-explore', AppExplore);
