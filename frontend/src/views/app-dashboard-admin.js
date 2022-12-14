/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import { until } from '../../node_modules/lit-html/directives/until.js';
import TemplatePage from '../templates/template-page';
import { store, getState } from '../store';
import { GET } from '../actions/requests';
import {
	updateTaskName,
	updateFilters,
	fetchRangeResults,
	putResultStatus,
	resetResultStatus
} from '../actions/application';
import { logout } from '../actions/user';
import { getValue, format } from '../helpers/utils';

import '@material/mwc-dialog';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-check-list-item';
import '@material/mwc-select';
import '@material/mwc-linear-progress';
import '@material/mwc-icon-button';
import '@material/mwc-checkbox';
import '@material/mwc-slider';

class AppDashboardAdmin extends TemplatePage {
	static get properties() {
		return {
			jobs: { type: Array },
			nbSelectedRows: { type: Number },
			newStatus: { type: String },
			page: { type: Number },
			resultsLength: { type: Number },
			pageSize: { type: Number },
			items: { type: Array },
			similarityLevel: { type: Number }
		};
	}

	constructor() {
		super();
		this.nbSelectedRows = 0;

		this.pageSize = 100;
		this.page = 1;
		this.resultsLength = 1;
		this.sorts = [];
		this.items = [];
		this.pageSizes = [5, 100, 200];
		this.globalCounter = 0;
		this.doneCounter = 0;
		this.toValidateCounter = 0;

		// ELISE
		this.similarityLevel = 80;//similarity in %
		this.SemanticSearchLastValue = "";
		this.elise_running_check_requested = true;
		this.elise_isRunning_val = false;

		this.statusMap = new Map([['', ['', '', '']],
		['to_annotate', ['to annotate', 'create', 'blue']],
		['to_validate', ['to validate', 'youtube_searched_for', 'orange']],
		['to_correct', ['to correct', 'thumb_down', 'red']],
		['discard', ['do NOT annotate', 'highlight_off', 'red']],
		['skip', ['to annotate (skipped)', 'create', 'blue']],
		['done', ['done', 'done', 'green']]]);
		this.assignedMap = new Map([['', ''],
		['true', 'in progress'],
		['false', 'idle']]);
	}

	/**
	 * Get all results from database with given task and filters.
	 */
	async getResults() {
		try {
			const data = await store.dispatch(fetchRangeResults(this.page, this.pageSize));
			this.resultsLength = data.counter;
			this.globalCounter = data.globalCounter;
			this.doneCounter = data.doneCounter;
			this.toValidateCounter = data.toValidateCounter;
			return data.results;
		} catch (err) {
			return [];
		}
	}

	onActivate() {
		this.stateChanged(getState());
		store.dispatch(updateFilters({}));//refresh filters (don't take filters last search on tasks)
		this.SemanticSearchLastValue="";
		if (this.table) this.refreshGrid();//don't refresh if no task has been created for now
	}

	/**
	 * Refresh the grid from the database
	 * state.
	 */
	async refreshGrid() {
		this.table.items.forEach((e) => e.selected = false);
		this.tableCheckbox.checked = false;
		this.nbSelectedRows = 0;
		this.table.layout();
		await this.getResults().then((res) => {
			this.items = res;
		});
	}

	stateChanged(state) {
		this.username = state.user.currentUser.username;
	}

	/**
	 * Update redux filter states and refresh grid.
	 * @param {String} key 
	 * @param {String} value 
	 */
	async updateFilter(key, value) {
		const oldFilters = getState('application').filters
		if (oldFilters[key] !== value) {
			const newFilters = { ...oldFilters, [key]: value };
			store.dispatch(updateFilters(newFilters));
			await this.refreshGrid();
		}
	}

	/**
	 * Update the new objective to be given
	 * to selected row items if the user
	 * confirms.
	 * @param {string} new_status 
	 */
	onTagAs(new_status) {
		this.newStatus = new_status;
		this.shadowRoot.getElementById('dialog-change-jobs-status').open = true;
	}

	/**
	 * Force objective update for selected
	 * row items.
	 */
	async tagAs() {
		const resultIds = this.table.items
			.filter((el) => el.selected)
			.map(el => el.id);
		await store.dispatch(putResultStatus(resultIds, this.newStatus));
		this.refreshGrid();
	}

	/**
	 * Force annotator freeing of selected
	 * row items.
	 */
	async onDeallocate() {
		const resultIds = this.table.items
			.filter((el) => el.selected)
			.map(el => el.id);
		await store.dispatch(resetResultStatus(resultIds));
		this.refreshGrid();
	}

	/**
	 * Start validating jobs.
	 */
	startValidating() {
		const taskName = getState('application').taskName;
		if (taskName) {
			this.gotoPage(`/#label/${taskName}/to_validate`);
		}
	}

	/**
	 * Start annotating/correcting jobs.
	 */
	startAnnotating() {
		const taskName = getState('application').taskName;
		if (taskName) {
			this.gotoPage(`/#label/${taskName}/to_annotate`);
		}
	}

	/**
	 * Start exploring a data from a given data id.
	 * @param {string} id 
	 */
	explore(id) {
		const taskName = getState('application').taskName;
		this.gotoPage(`/#explore/${taskName}/${id}`);
	}

	gotoProjectManager() {
		this.gotoPage('/#project-manager');
	}

	gotoDatasetsManager() {
		this.gotoPage('/#datasets-manager');
	}

	gotoUserManager() {
		this.gotoPage('/#user-manager');
	}

	onExplore(evt, item) {
		// prevent item selection
		evt.stopPropagation();
		this.explore(item);
	}

	/**
	 * Fired when a row is selected/unselected.
	 */
	onItemSelected(evt) {
		this.nbSelectedRows = evt.detail.index.size;
		const shouldIndeterminate = this.nbSelectedRows > 0 && this.nbSelectedRows < this.table.items.length;
		this.tableCheckbox.indeterminate = shouldIndeterminate;
		this.tableCheckbox.checked = shouldIndeterminate ? false : this.nbSelectedRows > 0;
	}

	get pageEnd() {
		return Math.min(this.resultsLength, (this.page) * this.pageSize);
	}

	/**
	 * Invoked when global grid checkbox is updated.
	 */
	onTableGlobalCheckboxChange() {
		// set all items as selected
		this.table.items.forEach((i) => i.selected = this.tableCheckbox.checked);
		this.nbSelectedRows = this.tableCheckbox.checked ? this.table.items.length : 0;
		this.table.layout();
	}

	/**
	 * Triggered when last page button is clicked.
	 */
	onLastPage() {
		if (this.pageEnd < this.resultsLength) {
			this.page = Math.ceil(this.resultsLength / this.pageSize);
			this.refreshGrid();
		}
	}

	/**
	 * Triggered when next page button is clicked.
	 */
	onNextPage() {
		if (this.pageEnd < this.resultsLength) {
			this.page += 1;
			this.refreshGrid();
		}
	}

	/**
	 * Triggered when previous page button is clicked.
	 */
	onPreviousPage() {
		if (this.page > 1) {
			this.page -= 1;
			this.refreshGrid();
		}
	}

	/**
	 * Triggered when first page button is clicked.
	 */
	onFirstPage() {
		if (this.page > 1) {
			this.page = 1;
			this.refreshGrid();
		}
	}

	/**
	 * Triggered when number per page is updated.
	 */
	onPageSelection(evt) {
		this.pageSize = this.pageSizes[evt.detail.index]
		this.refreshGrid();
	}

 	/********** Elise calls *************/
	async isEliseRunning() {// ELISE : test if running ... perform GET only if check requested (checking every times causes UI freeze...)
		if (this.elise_running_check_requested) {
			this.elise_isRunning_val = GET(`/api/v1/elise/isrunning`);
			this.elise_running_check_requested = false;
		}
		return this.elise_isRunning_val;
	}

	async onSearchSimilar(task_name, data_id) {
		// ELISE : search for similar images
		const tasks = getState('application').tasks;
		const task = tasks.find((task) => task.name === task_name);
		const resultIds = await GET(`/api/v1/elise/datasets/${task.dataset.id}/similarity/${data_id}/level/${this.similarityLevel}`);
		// we get the resulting list
		// first check
		if (resultIds.length===0) {// impossible in the case of similarity => inconsistant database
			this.errorPopup("inconsistant database");
			return;// nothing else to do
		}
		// update filters according to this list
		await this.updateFilter('data_id', resultIds.join(';'));
		// last check
		if (this.items.length===0) {// error 431 Request Header Fields Too Large (=resultIds.length too big)
			this.errorPopup("Too much matching images, no filter applied.");// ... TODO : use something else then GET to handle this problem and show the real answer OR show a message to the user
			this.updateFilter('data_id', '');// reinit filters for data_id
		}
	}

	async onSemanticSearch(task_name, keywords) {
		// ELISE : semantic search
		const tasks = getState('application').tasks;
		const task = tasks.find((task) => task.name === task_name);
		const dataset_id = task.dataset.id;
		// traduce keywords to be usable by Elise // TODO: when Elise will implement them directly, delete this part
		let keywords4Elise = '';
		let resultIds = [];
		// Keyword AND
		const k_and = keywords.replaceAll(" AND ", " ");// ELISE interpretes natively spaces as and
		// Keyword >
		let k_repeat = k_and.split(">");// "car car" will be interpreted by Elise as at list two cars
		for (let r=0; r<k_repeat.length-1; r++) {
			if (k_repeat.length<=r+1) {
				this.errorPopup("Error while interpreting a '>' sign.");
				return;// nothing else to do
			}
			const before = k_repeat[r].split(" ").filter(o=>o);
			const after = k_repeat[r+1].split(" ").filter(o=>o);
			const repeat = parseInt(after[0]);
			const word = before[before.length-1];
			after.shift();//consume
			before.pop();
			if (!repeat) {
				this.errorPopup("Error while interpreting a '>' sign.");
				return;// nothing else to do
			}
			keywords4Elise = before.join(' ')+' ';
			keywords4Elise += (word+' ').repeat(repeat)+' ';
			keywords4Elise += after.join(' ');
			k_repeat[r+1] = keywords4Elise;
		}
		if (k_repeat.length===1) keywords4Elise = k_and;
		// Keyword OR
		const k_div = keywords4Elise.split(" OR ");// divide in as much requests as needed
		for (let i=0; i<k_div.length; i++) {// using OR is like dividing the request in peaces
			const results = await GET(`/api/v1/elise/datasets/${dataset_id}/semanticsearch/${k_div[i]}`).catch(err => {
					this.errorPopup("Error in semantic search\n",err);
					return;// nothing else to do
				});
			resultIds.push(...results);
				
		}
		resultIds = [...new Set(resultIds)];//supress doubles
		// we get the resulting list
		// first check
		if (resultIds.length===0) {
			this.errorPopup("Nothing was found.\nDid you use existing keywords ?");
			return;// nothing else to do
		}
		// update filters according to this list
		await this.updateFilter('data_id', resultIds.join(';'));
		// last check
		if (this.items.length===0) {// error 431 Request Header Fields Too Large (=resultIds.length too big)
			this.errorPopup("Too much matching images, no filter applied.");// ... TODO : use something else then GET to handle this problem and show the real answer OR show a message to the user
			this.updateFilter('data_id', '');// reinit filters for data_id
		}
	}
	/********** end of Elise calls *************/

	static get styles() {
		return [super.styles, css`
      progress {
        width: 75%;
        margin-left: 10px;
        margin-bottom: 30px;
      }
	  mwc-check-list-item {
        height: 100px;
      }
      #pages {
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      #overview {
        width: 100%;
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
      .group_buttons {
        flex: 1 auto;
      }
      button[selected] {
        background: red;
      }
      .section {
        --mdc-theme-primary: var(--pixano-color);
      }
      .body {
        flex-flow: wrap;
        display: flex;
        height: 100%;
        width: 100%;
        margin: auto;
      }
      .list-item {
        width: 100%;
        position: absolute;
        display: flex;
        top: 0;
      }
      .path {
        direction: rtl;
        user-select: text;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .path > span {
        unicode-bidi: plaintext;
      }
      .list-header {
        display: flex;
        background: whitesmoke;
        box-shadow: #8e8e8e 0px -1px 0px inset;
      }
      .list-header > mwc-checkbox {
        padding-left: 14px;
        display: flex;
        align-items: center;
      }
      .list-header > div {
        flex: 1;
      }
      #time-header {
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .list-item > p {
        flex: 1;
        text-align: center;
        margin: auto;
        overflow: hidden;
      }
      .list-item > div {
        flex: 1;
        text-align: center;
        margin: auto;
        overflow: hidden;
      }
      .status {
        margin-top: auto;
        margin-bottom: auto;
        margin-right: 10px;
      }
      .green {
        color: green;
      }
      .orange {
        color: orange;
      }
      .red {
        color: red;
      }
      #page-size {
        width: 80px;
        padding-left: 10px;
        padding-right: 10px;
        --mdc-menu-item-height: 30px;
        --mdc-theme-surface: aliceblue;
        --mdc-list-vertical-padding: 0px;
      }
      mwc-linear-progress {
        transform: rotate(-90deg);
        margin-top: calc(60vh + 50px);
        padding-top: 50%;
        width: 60vh;
        transform-origin: left top;
      }
      #starter {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
      }
      .custom-counter li > p {
        font-weight: bold;
        color: var(--primary-color);
        padding: 10px;
        cursor: pointer;
      }
      .custom-counter {
        margin: 0;
        padding: 0;
        list-style-type: none;
      }
      .custom-counter li {
        counter-increment: step-counter;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
      }
      .custom-counter li::before {
        content: counter(step-counter);
        margin-right: 15px;
        font-size: 80%;
        background-color: rgb(0,200,200);
        color: white;
        font-weight: bold;
        padding: 3px 8px;
        border-radius: 3px;
      }
    `]
	}

	get table() {
		return this.shadowRoot.getElementById('table');
	}

	get tableCheckbox() {
		return this.shadowRoot.getElementById('table-checkbox');
	}

	get headerContent() {
		return html`
			<h1 class="display-4">Dashboard Admin</h1>
			<mwc-button theme="primary" class="dark" @click=${() => this.startValidating()}> START VALIDATING </mwc-button>
			<mwc-button theme="primary" class="dark" @click=${() => this.startAnnotating()}> START ANNOTATIONS </mwc-button>
			
			<div class="right-header-content">
				<mwc-button theme="primary" class="dark" @click=${() => this.gotoDatasetsManager()}> DATASETS </mwc-button>
				<mwc-button theme="primary" class="dark" @click=${() => this.gotoProjectManager()}> TASKS </mwc-button>
				<mwc-button theme="primary" class="dark" @click=${() => this.gotoUserManager()}> USERS </mwc-button>
				<div class="unselectable" style="margin: 10px;">${this.username}</div>
				<mwc-icon-button icon="exit_to_app"
							@click=${() => store.dispatch(logout())}
							title="Log out"></mwc-icon-button>
			</div>
		`;
	}

	styleMap(show) {
		return show ? 'visibility: visible' : 'visibility: hidden;';
	}

	/**
	 * Display table row
	 * Status | Data Id | Annotator | Validator | State | Time | Thumbnail | Search Similar
	 */
	listitem(item) {
		const v = this.statusMap.get(item.status);
		return html`
			<mwc-check-list-item left id=${item.data_id}>
				<div class="list-item">
					<p style="display: flex;">
						<mwc-icon class="status ${v[2]}">${v[1]}</mwc-icon>
						${v[0]}
					</p>
					<div title=${item.path}><p class="path"><span>${item.path}</span></p></div>
					<p>${item.annotator}</p>
					<p>${item.validator}</p>
					<p>${this.assignedMap.get(item.in_progress.toString())}</p>
					<p>${format(item.cumulated_time)}</p>
					<p><img src="data:image/jpg;base64,${item.thumbnail}" @click=${(evt) => this.onExplore(evt, item.data_id)}></p>
					${until(this.isEliseRunning().then(isRunning => isRunning
						? html`<p><mwc-icon-button icon="search_off" @click=${() => this.onSearchSimilar(item.task_name, item.data_id)}></mwc-icon-button></p>`
						: html``), html``)}
					<p></p>
				</div>
			</mwc-check-list-item>
			<li divider role="separator"></li>
		`;
	}

	get tableHeader() {
		const filters = getState('application').filters;
		const statusList = [...this.statusMap.entries()];
		const assignedList = [...this.assignedMap.entries()];
		return html`
			<div class="list-header">
				<mwc-checkbox id="table-checkbox" @change=${this.onTableGlobalCheckboxChange.bind(this)}></mwc-checkbox>
				<div style="display: flex; align-items: center;">
					<mwc-select label="status"
								style="position: absolute;"
								icon="filter_list"
								@selected=${(evt) => { if (evt.detail.index!==-1) this.updateFilter('status', statusList[evt.detail.index][0]); }}>
					${statusList.map(([k, v]) => {
						return html`<mwc-list-item ?selected=${filters.status == k} value=${k}>${v[0]}</mwc-list-item>`;
					})}
					</mwc-select>
				</div>
				<div>
					<mwc-textfield label="Path" icon="filter_list" @input=${(evt) => this.updateFilter('path', getValue(evt))}></mwc-textfield>
				</div>
				<div>
					<mwc-textfield label="annotator" icon="filter_list" @input=${(evt) => this.updateFilter('annotator', getValue(evt))}></mwc-textfield>
				</div>
				<div>
					<mwc-textfield label="validator" icon="filter_list" @input=${(evt) => this.updateFilter('validator', getValue(evt))}></mwc-textfield>
				</div>
				<div style="display: flex; align-items: center;">
					<mwc-select label="state"
								icon="filter_list"
								style="position: absolute;"
								@selected=${(evt) => { if (evt.detail.index!==-1) this.updateFilter('in_progress', assignedList[evt.detail.index][0]); }}>
					${assignedList.map((s) => {
						return html`<mwc-list-item ?selected=${filters.in_progress === s[0]} value=${s[0]}>${s[1]}</mwc-list-item>`;
					})}
					</mwc-select>
				</div>
				<div id="time-header">Time</div>
				<div id="time-header">Preview</div>
				${until(this.isEliseRunning().then(isRunning => isRunning
					? html`
					<div style="flexDirection: 'column'">
						Similarity Level
						<div style="display: flex; align-items: center; flexDirection: 'row'">
						0
						<mwc-slider value=${this.similarityLevel} min="0" max="100" @input=${(evt) => this.similarityLevel=evt.detail.value}></mwc-slider>
						100%
						</div>
						${this.similarityLevel.toFixed(2)}%
					</div>`
					: html``), html``)}
				<div style="flex: 0.5"></div>
			</div>
		`;
	}

	/**
	 * Table pagination.
	 */
	get pagination() {
		return html`
			<div id="pages">
				<div>Rows per page:</div>
				<mwc-select id="page-size" outlined @selected=${this.onPageSelection.bind(this)}>
					${this.pageSizes.map((s) => html`<mwc-list-item value=${s}
									?selected=${this.pageSize === s}>${s}</mwc-list-item>`)}
				</mwc-select>
				<div>${(this.page - 1) * this.pageSize + 1}-${this.pageEnd} of ${this.resultsLength}</div>
				<mwc-icon-button 
					icon="first_page"
					?disabled=${this.page === 1}
					style="z-index: 10;"
					@click="${this.onFirstPage.bind(this)}"></mwc-icon-button>
				<mwc-icon-button 
					icon="chevron_left"
					?disabled=${this.page === 1}
					@click="${this.onPreviousPage.bind(this)}"></mwc-icon-button>
				<mwc-icon-button 
					icon="chevron_right"
					?disabled=${this.pageEnd === this.resultsLength}
					@click="${this.onNextPage.bind(this)}"></mwc-icon-button>
				<mwc-icon-button icon="last_page"
								?disabled=${this.pageEnd === this.resultsLength}
								@click="${this.onLastPage.bind(this)}"></mwc-icon-button>
			</div>
		`;
	}

	get dialog() {
		return html`
			<mwc-dialog heading="Change status" id="dialog-change-jobs-status">
				<div>Change status to '${this.newStatus}' for ${this.nbSelectedRows} selected jobs? <br>
				</div>
				<mwc-button
					slot="primaryAction"
					dialogAction="ok"
					@click=${() => this.tagAs()}>
				Ok
				</mwc-button>
				<mwc-button
					slot="secondaryAction"
					dialogAction="cancel">
				Cancel
				</mwc-button>
			</mwc-dialog>
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
							this.refreshGrid();
						}
					}}>
					${tasks.map((p) => html`<mwc-list-item value=${p.name} ?selected=${taskName === p.name}>${p.name}</mwc-list-item>`)}
				</mwc-select>
			</div>
		`;
	}

	get leftSection() {
		return html`
			<div id="left-panel" class="section" title="To annotate: ${this.globalCounter - this.toValidateCounter - this.doneCounter} \n To validate: ${this.toValidateCounter}\n Done: ${this.doneCounter}">
				<mwc-icon-button icon="refresh"
							style="margin-left: auto; margin-right: auto;"
							@click="${() => this.refreshGrid()}"
							title="Refresh">
				</mwc-icon-button>
				<mwc-linear-progress progress="${this.doneCounter / this.globalCounter}"
									buffer="${(this.doneCounter + this.toValidateCounter) / this.globalCounter}"></mwc-linear-progress>
				<div style="margin: auto;">
					<p>${this.doneCounter}</p>
					<p>-</p>
					<p>${this.globalCounter}</p>
				</div>
			</div>
		`;
	}

	get mainSection() {
		return html`
			<div class="section" style="flex: 1;">
				<h1 class="display-4">Label Status</h1>
				<div style="display: flex;">
					<div class="group_buttons" style=${this.styleMap(this.nbSelectedRows > 0)}>
						${[...this.statusMap.entries()].splice(1).map(([k, v]) => html`
								<mwc-icon-button icon=${v[1]}
											title="Tag as ${v[0]}"
											@click=${() => this.onTagAs(k)}>
								</mwc-icon-button>`
						)}
						<mwc-icon-button icon="settings_backup_restore"
											title="Unassign job"
											@click=${() => this.onDeallocate()}>
						</mwc-icon-button>
					</div>
					${until(this.isEliseRunning().then(isRunning => isRunning
						? html`
						<div style="text-align: right; "flexDirection: 'row'">
							<label for="eliseinput">Filter by content :</label><input type="search" id="eliseinput" value=${this.SemanticSearchLastValue} placeholder="contained classe(s)" title="Use keywords 'AND','OR','>' to separate classes">
							<mwc-icon-button icon="filter_list_alt" title="filter based on input keywords" @click=${() => { this.SemanticSearchLastValue=this.shadowRoot.getElementById("eliseinput").value; this.onSemanticSearch(this.items.at(0).task_name,this.SemanticSearchLastValue)}}></mwc-icon-button>
							<mwc-icon-button icon="delete" title="empty filter" @click=${() => { this.SemanticSearchLastValue=""; this.updateFilter('data_id', ''); }}></mwc-icon-button>
						</div>`
						: html``), html``)}
				</div>
				${this.tableHeader}
				<mwc-list id='table' multi @selected=${this.onItemSelected.bind(this)} style="height: 55vh; overflow-y: auto;">
					<li divider role="separator"></li>
					${this.items.map(this.listitem.bind(this))}
				</mwc-list>
				${this.pagination}
			</div>
		`;
	}

	get body() {
		const numTasks = getState('application').tasks.length;
		return numTasks
			? html`
				<div class="body">
					${this.topSection}
					${this.leftSection}
					${this.mainSection}
				</div>
				${this.dialog}`
			: html`
				<div id="starter">
					<ol class="custom-counter">
						<li>Configure your dataset(s) in the <p @click=${this.gotoDatasetsManager}> DATASETS </p> menu</li>
						<li>Configure your annotation project in the <p @click=${this.gotoProjectManager}> TASKS </p> menu</li>
						<li>[Optional] Configure the users for the project in the <p @click=${this.gotoUserManager}> USER </p> menu</li>
						<li>Start <p @click=${this.gotoUserManager}> ANNOTATING </p></li>
					</ol>
				</div>`;
	}
}
customElements.define('app-dashboard-admin', AppDashboardAdmin);
