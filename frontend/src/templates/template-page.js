/**
 * Simple HTML page template with common utilies such as:
 * - on page arrival/departure
 * - ability to go to another page
 * - pop up error dialog
 * - decomposition of page sections (logo, header, drawer, main, ...)
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html, css } from 'lit-element';
import { navigate, getPixanoVersion } from '../actions/application';
import { store, getState } from '../store';
import { until } from 'lit-html/directives/until.js';

import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-checkbox';
import '@material/mwc-button';
import '@material/mwc-radio';
import '@material/mwc-formfield';
import '@material/mwc-linear-progress';
import '@material/mwc-tab';
import '@material/mwc-tab-bar';
import '@material/mwc-textfield';
import '@material/mwc-dialog';
import '../helpers/pop-up';


export default class TemplatePage extends LitElement {
	static get properties() {
		return {
			active: { type: Boolean },
			theme: { type: String }
		};
	}

	constructor() {
		super();
		this.loaded = false;
		this.theme = 'black';
	}

	/**
	 * Fired when the composant is loaded.
	 * Make sure you do not override this method
	 * within child classes by calling super.
	 */
	firstUpdated() {
		this.loaded = true;
		const pref = getState('user').currentUser.preferences;
		if (pref && pref.theme) {
			this.theme = pref.theme;
		}
	}

	/**
	 * Invoked each time user goes to page
	 */
	onActivate() {

	}

	/**
	 * Invoked each time user leaves page
	 */
	onDesactivate() {

	}

	updated(changedProperties) {
		if (changedProperties.has('active')) {
			// make sure the composant is loaded
			// before calling the activated/desactivated method
			if (this.loaded) {
				if (this.active) {
					this.onActivate();
				} else {
					this.onDesactivate();
				}
			}
		}
	}

	/**
	 * Go to page
	 * @param {string} page e.g. /#dashboard-admin or /
	 */
	gotoPage(page) {
		window.history.pushState({}, '', encodeURI(page));
		store.dispatch(navigate(page));
	}

	/**
	 * Go to home page
	 */
	goHome() {
		// cancel current job ?
		const state = getState();
		const role = (state.user && state.user) ? state.user.currentUser.role : '';
		let page = '';
		if (role === 'admin') {
			page = '/#dashboard-admin';
		} else if (role === 'user') {
			page = '/#dashboard-user';
		} else {
			return;
		}
		window.history.pushState({}, '', encodeURI(page));
		store.dispatch(navigate(page));
	}

	/**
	 * Generic pop up
	 * @param {string} message 
	 */
	errorPopup(message, options = ['ok']) {
		this.popUp.message = message;
		this.popUp.buttons = options;
		return this.popUp.prompt();
	}

	static get styles() {
		return css`
      :host {
        height: 100%;
        overflow: auto;
        --leftPanelWidth: 55px;
        --headerHeight: 50px;
        --pixano-color: #79005D;
        --primary-color: #79005D;
        --secondary-color: #FF5C64;
        --theme-color: whitesmoke;
        --font-color: black;
        font-size: 15px;
        color: var(--font-color);
        
      }
      .black {
        --theme-color: rgb(51, 51, 51);
        --font-color: white;
        --primary-color: white;
        --secondary-color: black;
      }
      .main {
        height: 100%;
        position: relative;
        display:flex;
        flex-direction: column;
      }
      .header {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: var(--headerHeight);
        color: var(--font-color);
        background-color: var(--theme-color);
      }
      .header h1 {
        margin: auto auto auto 0;
        padding-left: 20px;
      }
      .logo {
        width: var(--leftPanelWidth);
        cursor: pointer;
        display: flex;
        align-items: center;        
      }
      #logo-im {
        width: 60%;
        margin:auto;
      }
      .header-menu {
        display: flex;
        flex-direction: row;
        width: calc(100% - var(--leftPanelWidth));
        padding-left: 0;
      }
      .header-menu > mwc-button {
        margin: 0px;
        margin-right: 20px;
        align-items: center;
        display: flex;
      }
      .right-header-content {
        margin: auto;
        margin-right: 20px;
        align-items: center;
        display: flex;
      }
      .header-menu > mwc-icon-button {
        margin: 0px;
        margin-right: 20px;
        align-items: center;
        display: flex;
      }
      .body {
        display: flex;
        flex-direction: row;
        height: calc(100% - var(--headerHeight));
      }
      .left-panel {
        background: #333;
        width: var(--leftPanelWidth);
        flex: 0 0 var(--leftPanelWidth);
      }
      .page {
        display: block;
        width: calc(100% - var(--leftPanelWidth));
        overflow-y: auto;
        height: 100%;
        position: relative;
      }
      .page[active] {
        display: block;      
      }
      .section {
        margin: 20px;
        font-size: small;
        display: flex;
        flex-direction: column;
      }
      h1 {
        font-size: 20px;
        margin-left: 20px;
        font-weight: 300;
      }
      h2 {
        font-size: 20px;
      }
      h3 {
        font-size: 14px;
      }
      mwc-icon-button,
      mwc-icon-button-toggle {
        color: #6d6d6d;
      }
      mwc-icon-button:hover,
      mwc-icon-button-toggle:hover {
        color: var(--secondary-color);
      }
      mwc-icon-button[selected] {
        color: var(--secondary-color);
      }
      .tooltip {
        position: relative;
        display: inline-block;
        border-bottom: 0px dotted black;
      }      
      mwc-tab-bar {
        padding-top: 20px;
      }
      mwc-textfield {
        --mdc-theme-primary: #79005D;
        --mdc-theme-secondary: #FF5C64;
      }
      
      mwc-button {
        --mdc-theme-primary: var(--primary-color);
        --mdc-theme-on-primary: white;
      }
     
      mwc-linear-progress {
        --mdc-theme-primary: var(--primary-color);
      }
      .group_buttons {
        display: flex;
        flex-direction: row;
      }
      .unselectable {
        -webkit-user-select: none;  
        -moz-user-select: none;    
        -ms-user-select: none;      
        user-select: none;
      }
    `;
	}

	get popUp() {
		return this.shadowRoot.querySelector('pop-up');
	}

	get leftPanelContent() {
		return html``
	}

	get headerContent() {
		return html` `
	}

	get pageContent() {
		return html``
	}

	get pageDiv() {
		return html`
    <div class="page">
      ${this.pageContent}
  </div>`
	}

	get leftPanel() {
		return html`
      <div class="left-panel">
        ${this.leftPanelContent}
      </div>`
	}

	get body() {
		return html`
    <div class="body">
      ${this.leftPanel}
      ${this.pageDiv}
    </div>`
	}

	/**
	 * Element template to be renderer on screen.
	 */
	render() {
		return html`
			<div class="main ${this.theme}">
				<div class="header">
					<div class="logo">
					${until(getPixanoVersion()
						.then(v => html`<img id="logo-im" src="images/pixano-mono-grad.svg" alt="Pixano" title="${v.app}" @click=${() => this.goHome()}>`)
						,html`<img id="logo-im" src="images/pixano-mono-grad.svg" alt="Pixano" @click=${() => this.goHome()}>`
					)}
					</div>
					<div class="header-menu">
						${this.headerContent}
					</div>
				</div>
				${this.body}        
			</div>
			<pop-up></pop-up>
    `;
	}
}

