/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import TemplatePage from '../templates/template-page';
import { store, getState } from '../store';
import { updateTaskName } from '../actions/application';
import { fetchRangeResults } from '../actions/application';
import { logout } from '../actions/user';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list-item.js';


// we need to connect to the store in order to listen
// to state changes
// we would not need it in case we only dispatch actions
class AppDashboardUser extends TemplatePage {

	constructor() {
		super();
		this.globalCounter = 0;
		this.doneCounter = 0;
	}
	static get properties() {
		return {
			doneCounter: { type: Number },
			globalCounter: { type: Number }
		};
	}

	async getResults() {
		try {
			const data = await store.dispatch(fetchRangeResults(this.page, this.pageSize));
			this.globalCounter = data.globalCounter;
			this.doneCounter = data.doneCounter;
			return data.results;
		} catch (err) {
			return [];
		}
	}

	onActivate() {
		this.getResults();
	}

	startAnnotating() {
		const taskName = getState('application').taskName;
		const jobObjective = 'to_annotate';
		this.gotoPage(`/#label/${taskName}/${jobObjective}`);
	}

	logOut() {
		const labelPath = '/#login';
		this.gotoPage(labelPath);
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
		return html`
      <h1 class="display-4">Dashboard</h1>
      <mwc-button theme="primary" class="dark" @click=${() => this.startAnnotating()}>Start Annotating</mwc-button>
      <mwc-icon-button icon="exit_to_app"
                       @click=${() => store.dispatch(logout())}
                       title="Log out"></mwc-icon-button>
    `
	}

	get leftSection() {
		return html`
    <div id="left-panel" class="section">
      <mwc-icon-button icon="refresh"
                  style="margin-left: auto; margin-right: auto;"
                  @click="${this.getResults.bind(this)}"
                  title="Refresh">
      </mwc-icon-button>
      <mwc-linear-progress progress="${this.doneCounter / this.globalCounter}"></mwc-linear-progress>
      <div style="margin: auto;">
        <p>${this.doneCounter}</p>
        <p>-</p>
        <p>${this.globalCounter}</p>
      </div>
    </div>
    `;
	}

	get topSection() {
		const taskName = getState('application').taskName;
		const tasks = getState('application').tasks;
		return html`
    <div id="overview" class="section">
      <h1 class="display-4" style="margin: auto;">Select a task: </h1>
      <mwc-select label='Task' @selected=${(e) => {
				if (tasks[e.detail.index] && tasks[e.detail.index].name !== taskName) {
					store.dispatch(updateTaskName(tasks[e.detail.index].name));
					this.getResults();
				}
			}}>
        ${tasks.map((p) => html`<mwc-list-item value=${p.name}
                                                ?selected=${taskName === p.name}>${p.name}</mwc-list-item>`)
			}
      </mwc-select>
    </div>
    `;
	}

	get body() {
		return html`
      <div class="body">
          ${this.leftSection}
          ${this.topSection}
      </div>
    `
	}
}
customElements.define('app-dashboard-user', AppDashboardUser);
