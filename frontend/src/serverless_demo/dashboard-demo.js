/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2021)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import TemplatePage from '@pixano-app/frontend/src/templates/template-page';
import { store, getState } from '@pixano-app/frontend/src/store';
import { updateTaskName } from '@pixano-app/frontend/src/actions/application';

import { pluginsList } from '@pixano-app/frontend/src/plugins/index';

import '@pixano-app/frontend/src/plugins/rectangle';

import '@material/mwc-select';
import '@material/mwc-icon-button';
import '@material/mwc-list/mwc-list-item.js';


class DashboardDemo extends TemplatePage {

	constructor() {
		super();
		console.log("constructor DashboardDemo");
		this.chosenPlugin = false;
		this.isactive = true;
	}
	static get properties() {
		return {
			chosenPlugin: { type: Boolean },
			isactive: { type: Boolean }
		};
	}

	onActivate() {
		console.log("activate DashboardDemo");
	}

	startAnnotating() {
		const taskName = getState('application').taskName;
		console.log("startAnnotating");
		// this.element.input = "image.jpg";
		this.chosenPlugin = true;
		// import('@pixano-app/frontend/src/plugins/rectangle.js').then(() => {console.log("fait ?");}).catch(() => {console.log("erruer!!");});

		
		// const jobObjective = 'to_annotate';
		// this.gotoPage(`/#label/${taskName}/${jobObjective}`);
	}

	static get styles() {
		return [super.styles, css`
			.body {
				flex-flow: wrap;
				display: flex;
				height: 100%;
				width: 100%;
				margin: auto;
			}
			.logo {
				background: whitesmoke;
			}
			.section {
				--mdc-theme-primary: var(--pixano-color);
			}
			#overview {
				flex: 1;
				margin: 0;
				background: var(--mdc-theme-primary);
				--mdc-select-hover-line-color: white;
				color: white;
				flex-direction: row;
			}
			#overview > mwc-select {
				display: flex;
				margin-right: 20px;
				align-items: center;
			}
			#left-panel {
				background: whitesmoke;
				margin: 0;
				width: 80px;
			}
			mwc-linear-progress {
				transform: rotate(-90deg);
				margin-top: calc(60vh + 50px);
				padding-top: 50%;
				width: 60vh;
				transform-origin: left top;
			}
		`]
	}

	get headerContent() {
		if (!this.chosenPlugin) return html`
			<h1 class="display-4">Dashboard: choose your annotation plugin</h1>
			<mwc-button theme="primary" class="dark" @click=${() => this.startAnnotating()}>Start Annotating</mwc-button>
			<mwc-icon-button icon="exit_to_app" title="TEST"></mwc-icon-button>
		`;
		else return html`
			<h1 class="display-4">Annotate</h1>
			<mwc-icon-button icon="exit_to_app" @click=${() => this.chosenPlugin=false} title="Back to plugin choice"></mwc-icon-button>
			<mwc-icon-button icon="file_download" @click=${() => this.element.input = "image.jpg"} title="Download your image"></mwc-icon-button>
		`;
	}

	get topSection() {
		const taskName = getState('application').taskName;
		return html`
		<div id="overview" class="section">
			<h1 class="display-4" style="margin: auto;">Select a plugin: </h1>
			<mwc-select label='Plugin' @selected=${(e) => {
					if (pluginsList[e.detail.index] && pluginsList[e.detail.index] !== taskName) {
						store.dispatch(updateTaskName(pluginsList[e.detail.index]));
					}
				}}>
				${pluginsList.map((p) => html`<mwc-list-item value=${p} ?selected=${taskName === p}>${p}</mwc-list-item>`)
			}
			</mwc-select>
		</div>
		`;
	}

	get body() {
		if (!this.chosenPlugin) return html`
			<div class="body">
				${this.topSection}
			</div>
		`
		else return html`
			<plugin-rectangle  name="canvas"></plugin-rectangle>
		`
		// else return html`
		// 	<pxn-rectangle id="main" ></pxn-rectangle>
		// `
	}
	// ... mwc-icon-button pas fonctionnels non plus ...
// voir la demo existante : charger directement un pxn-rectangle pour voir si çà change + voir comment et quand est chargée l'image

	get element() {
		// return this.shadowRoot.getElementById('pxn-rectangle');
		// return this.shadowRoot.getElementById('plugin-rectangle');
		return this.shadowRoot.getElementById('main');
	}

	// render() {
	// 	return html`
	// 		<div class="main ${this.theme}">
	// 		<div class="header">
	// 			<div class="logo">
	// 				<img id="logo-im" src="images/pixano-mono-grad.svg" alt="Pixano">
	// 			</div>
	// 			<div class="header-menu">
	// 				${this.headerContent}
	// 			</div>
	// 		</div>
	// 		${this.body}        
	// 		</div>
	// 		<pop-up></pop-up>
	// 	`;
	// }
}
customElements.define('dashboard-demo', DashboardDemo);
