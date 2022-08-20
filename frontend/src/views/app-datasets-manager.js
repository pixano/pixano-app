/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import TemplatePage from '../templates/template-page';
import { store, getState } from '../store';
import { logout } from '../actions/user';
import { getValue } from '../helpers/utils';
import { until } from '../../node_modules/lit-html/directives/until.js';
import { GET } from '../actions/requests';


import '@material/mwc-button';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-textfield';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-check-list-item';
import '@material/mwc-slider';

import {
	updateDatasetId,
	getDatasets,
	fetchRangeDatas,
	importDataset,
	createDatasetFrom,
	importFromKafka,
	deleteDataset
} from '../actions/media';

import {
	updateFilters,
	getTasks
} from '../actions/application';


class AppDatasetsManager extends connect(store)(TemplatePage) {
	static get properties() {
		return {
			datasets: { type: Array },
			datasetIdx: { type: Number },
			pathOrURL: { type: String },
			nbSelectedRows: { type: Number },
			items: { type: Array }
		};
	}

	constructor() {
		super();
		this.datasets = [];
		this.datasetIdx = -1;
		this.pathOrURL = "undetermined";
		this.default_path = "";
		this.nbSelectedRows = 0;

		// ELISE
		this.similarityLevel = 0;//similarity in %
		this.SemanticSearchLastValue="";

		this.pageSize = 100;
		this.page = 1;
		this.resultsLength = 1;
		this.items = [];
		this.pageSizes = [5, 100, 200];
		this.globalCounter = 0;
	}

	/******************* Utility functions *******************/

	/**
	 * Refresh the grid from the database state.
	 * => refresh datasets list and selected id
	 * => refresh displayed table and items
	 */
	async refreshGrid() {
		store.dispatch(getDatasets())
			.then((datasets) => {
				// refresh table selections
				this.table.items.forEach((e) => e.selected = false);
				this.tableCheckbox.checked = false;
				this.nbSelectedRows = 0;
				this.table.layout();
				// refresh datasets list
				this.datasets = datasets
				// refresh displayed items
				if (this.datasets.length) {
					if (this.datasetIdx===-1) this.datasetIdx = 0;//select the first one if nothing was selected
					store.dispatch(updateDatasetId(this.datasets[this.datasetIdx].id));
					store.dispatch(fetchRangeDatas(this.page, this.pageSize))
						.then((data) => {
							this.resultsLength = data.counter;
							this.globalCounter = data.globalCounter;
							this.items = data.results;
						})
						.catch((err) => {
							this.errorPopup("Error while fetching data :\n"+err, ["home"]).then(() => this.goHome());
						});
				} else {
					store.dispatch(updateDatasetId(''));
					this.datasetIdx = -1;
					this.resultsLength = 0;
					this.globalCounter = 0;
					this.items = [];
				}
			})
			.catch((err) => {
				this.errorPopup("Error while getting datasets :\n"+err, ["home"]).then(() => this.goHome());
			});
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
	
	get pageEnd() {
		return Math.min(this.resultsLength, (this.page) * this.pageSize);
	}

	/******************* EVENTS handlers *******************/

	onActivate() {
		store.dispatch(updateFilters({}));//refresh filters (don't take filters last search on tasks)
		this.SemanticSearchLastValue="";
		if (this.table) this.refreshGrid();//don't refresh if no dataset has been created for now
		this.shadowRoot.getElementById('filter-field').value = "";
	}

 	/********** Elise calls *************/
	 async isEliseRunning() {// ELISE : test if running
		return GET(`/api/v1/elise/isrunning`);
	}

	async onSearchSimilar(dataset_id, data_id) {
		// ELISE : search for similar images
		const resultIds = await GET(`/api/v1/elise/datasets/${dataset_id}/similarity/${data_id}/level/${this.similarityLevel}`);
		// we get the resulting list
		// first check
		if (resultIds.length===0) {// impossible in the case of similarity => inconsistant database
			this.errorPopup("inconsistant database");
			return;// nothing else to do
		}
		// update filters according to this list
		await this.updateFilter('id', resultIds.join(';'));
		// last check
		if (this.items.length===0) {// error 431 Request Header Fields Too Large (=resultIds.length too big)
			this.errorPopup("Too much matching images, no filter applied.");// ... TODO : use something else then GET to handle this problem and show the real answer OR show a message to the user
			this.updateFilter('id', '');// reinit filters for data_id
		}
	}

	async onSemanticSearch(dataset_id, keywords) {
		// ELISE : semantic search
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
		await this.updateFilter('id', resultIds.join(';'));
		// last check
		if (this.items.length===0) {// error 431 Request Header Fields Too Large (=resultIds.length too big)
			this.errorPopup("Too much matching images, no filter applied.");// ... TODO : use something else then GET to handle this problem and show the real answer OR show a message to the user
			this.updateFilter('id', '');// reinit filters for data_id
		}
	}
	/********** end of Elise calls *************/

	/******************* BUTTONS handlers *******************/

	/**
	 * Fired when clic on new dataset
	 */
	onAddDataset() {
		const browserElem = this.shadowRoot.getElementById('dialog-new-dataset');
		browserElem.open = true;
	}
	/**
	 * Fired when adding a new dataset
	 */
	addDataset() {
		const ioPath = this.shadowRoot.getElementById('io-path').value;
		const ioName = this.shadowRoot.getElementById('io-name').value;
		const iodata_type = this.shadowRoot.getElementById('io-data_type').value;
		store.dispatch(importDataset(ioPath,ioName,iodata_type, this.pathOrURL === 'URL'))
			.then(() => {
				this.datasetIdx = this.datasets.length;//select the newly created dataset
				this.onActivate();
			})
			.catch(error => this.errorPopup(error.message));
	}

	/**
	 * Fired when clic on new dataset from current selection
	 */
	onCreateDatasetFromSelection() {
		// get name dialog
		const browserElem = this.shadowRoot.getElementById('dialog-new-dataset-name');
		browserElem.open = true;
	}
	/**
	 * Fired when creating new dataset from current selection
	 */
	createDatasetFromSelection() {
		const ioName = this.shadowRoot.getElementById('io-name2').value;
		// get data_ids from selection
		const data_ids = this.items.map((item) => item.id);
		const refDatasetId = getState('media').datasetId;//current dataset id for ref
		store.dispatch(createDatasetFrom(ioName,refDatasetId,data_ids))
			.then(() => {
				this.datasetIdx = this.datasets.length;//select the newly created dataset
				this.onActivate();
			})
			.catch(error => this.errorPopup(error.message));
	}

	/**
	 * Fired when clic on import from kafka
	 */
	onImportFromKafka() {
		store.dispatch(importFromKafka())
			.then(() => {
				this.datasetIdx = this.datasets.length;//select the newly created dataset
				this.onActivate();
			})
			.catch(error => this.errorPopup(error.message));
	}

	/**
	 * Fired when user wants to delete a dataset.
	 */
	onRemoveDataset() {
		// verify first if a task is using this dataset => if yes, don't allow deleting this dataset
		store.dispatch(getTasks()).then(() => {
			const datasetId = getState('media').datasetId;
			const tasks = getState('application').tasks;
			const correspondingTask = tasks.find((task) => task.dataset.id === datasetId);
			if (correspondingTask) this.errorPopup("Dataset '"+datasetId+"' is used by the task '"+correspondingTask.name+"'.\nPlease delete this task first.", ["TASKS"]).then(() => this.gotoPage('/#project-manager'));
			else {
				const dialog = this.shadowRoot.getElementById('dialog-remove-dataset');
				if (dialog) dialog.open = true;
			}
		});
	}

	/**
	 * Fired when remiving a new dataset
	 */
	removeDataset() {
		store.dispatch(deleteDataset(getState('media').datasetId))
			.then(() => {
				this.datasetIdx = -1;
				this.onActivate();
			})
			.catch(error => this.errorPopup(error.message));
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
	 * Fired when a row is selected/unselected.
	 */
	onItemSelected(evt) {
		this.nbSelectedRows = evt.detail.index.size;
		const shouldIndeterminate = this.nbSelectedRows > 0 && this.nbSelectedRows < this.table.items.length;
		this.tableCheckbox.indeterminate = shouldIndeterminate;
		this.tableCheckbox.checked = shouldIndeterminate ? false : this.nbSelectedRows > 0;
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
	
	/******************* selector getters *******************/

	get table() {
		return this.shadowRoot.getElementById('table');
	}

	get tableCheckbox() {
		return this.shadowRoot.getElementById('table-checkbox');
	}

	/******************* RENDERING  *******************/

	static get styles() {
		return [super.styles, css`
			.section {
				border: 1px solid #e5e5e5;
				--mdc-theme-primary: var(--pixano-color);
			}
			#dataset-page {
				max-width: 1380px;
				margin: auto;
				position: absolute;
				left: 0px;
				right: 0;
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
			mwc-button {
				--mdc-button-outline-color: var(--pixano-color);
				--mdc-theme-primary: var(--pixano-color);
			}
			.multi {
				--mdc-theme-primary: grey;
			}
			.list-header {
				display: flex;
				background: whitesmoke;
				box-shadow: #8e8e8e 0px -1px 0px inset;
			}
			.list-header > mwc-checkbox {
				padding-left: 14px;
			}
			.list-header > div {
				flex: 1;
				align-items: center;
				justify-content: center;
			}
			#time-header {
			  z-index: 2;
			  display: flex;
			  align-items: center;
			  justify-content: center;
			}
			mwc-check-list-item {
				height: 100px;
			}
			.list-item {
				width: 100%;
				position: absolute;
				display: flex;
				flex-direction: row;
				justify-content: center;
				top: 0;
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
		`]
	}

	/**
	* Tabel header
	*/
	get tableHeader() {
		return html`
			<div class="list-header">
				<mwc-checkbox id="table-checkbox" @change=${this.onTableGlobalCheckboxChange.bind(this)}></mwc-checkbox>
				<div></div>
				<div>
					<mwc-textfield label="Path" icon="filter_list" id="filter-field" @input=${(evt) => this.updateFilter('path', getValue(evt))}></mwc-textfield>
				</div>
				<div></div>
				<div id="time-header">Preview</div>
				<div></div>
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
			</div>
		`;
	}
	/**
	* Table row
	*/
	listitem(item) {
		return html`
			<mwc-check-list-item left id=${item.id}>
				<div class="list-item">
					<p></p>
					<div title=${item.path}><span>${item.path}</span></div>
					<p></p>
					<img src="data:image/jpg;base64,${item.thumbnail}">
					<p></p>
					${until(this.isEliseRunning().then(isRunning => isRunning
						? html`<p><mwc-icon-button icon="search_off" @click=${() => this.onSearchSimilar(item.dataset_id, item.data_id)}></mwc-icon-button></p>`
						: html``), html``)}
				</div>
			</mwc-check-list-item>
			<li divider role="separator"></li>
		`;
	}
	/**
	 * Table pagination
	 */
	get pagination() {
		return html`
			<div id="pages">
				<div>Rows per page:</div>
				<mwc-select id="page-size" outlined @selected=${this.onPageSelection}>
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

	get headerContent() {
		return html`
			<mwc-icon-button style="margin: 0;" icon="keyboard_backspace" @click=${() => this.goHome()}></mwc-icon-button>
			<h1 class="display-4">Datasets Manager</h1>
			<mwc-icon-button icon="exit_to_app"
							@click=${() => store.dispatch(logout())}
							title="Log out"></mwc-icon-button>`
	}

	get datasetSelectionSection() {
		const datasetId = getState('media').datasetId;
		return html`
			<div id="overview" class="section">
				<h1 class="display-4" style="margin: auto;">Select a dataset: </h1>
				<mwc-select label='Dataset' @selected=${(e) => {
						if (this.datasets[e.detail.index] && this.datasets[e.detail.index].id !== datasetId) {
							this.datasetIdx = e.detail.index;
							this.refreshGrid();
						}
					}}>
					${this.datasets.map((p) => html`<mwc-list-item value=${p.id} ?selected=${datasetId === p.id}>${p.id}</mwc-list-item>`)}
				</mwc-select>
				<mwc-icon-button ?disabled=${this.datasetIdx===-1} style="color: tomato" icon="delete" @click="${this.onRemoveDataset}"></mwc-icon-button>
			</div>
			${this.dialogRemoveDataset}
		`;
	}

	get addDatasetSection() {
		return html`
			<mwc-button outlined
					class="newDataset"
					type="button"
					icon="add"
					title="Add new dataset"
					@click="${this.onAddDataset}">
				New Dataset
			</mwc-button>
			<mwc-button outlined
					class="newDataset"
					type="button"
					icon="add"
					title="Create a new dataset from the current selection"
					@click="${this.onCreateDatasetFromSelection}">
				Dataset from selection
			</mwc-button>
			<mwc-button outlined
					class="newDataset"
					type="button"
					icon="add"
					title="Import a new dataset from Kafka"
					@click="${this.onImportFromKafka}">
				Import from Kafka
			</mwc-button>
		`;
	}

	get datasetsGridSection() {
		return html`
			<div class="section" style="flex: 1;">
				${this.tableHeader}
				<mwc-list id='table' multi @selected=${this.onItemSelected.bind(this)} style="height: 55vh; overflow-y: auto;">
					<li divider role="separator"></li>
					${this.items.map(this.listitem.bind(this))}
				</mwc-list>
				${this.pagination}
			</div>
		`;
	}

	get pageContent() {
		return html`
			<div id="dataset-page">
				${this.datasetSelectionSection}
				${this.addDatasetSection}
				${until(this.isEliseRunning().then(isRunning => isRunning
					? html`
					<div style="text-align: right; "flexDirection: 'row'">
						<label for="eliseinput">Filter by content :</label><input type="search" id="eliseinput" value=${this.SemanticSearchLastValue} placeholder="contained classe(s)" title="Use keywords 'AND','OR','>' to separate classes">
						<mwc-icon-button icon="filter_list_alt" title="filter based on input keywords" @click=${() => { this.SemanticSearchLastValue=this.shadowRoot.getElementById("eliseinput").value; this.onSemanticSearch(this.items.at(0).dataset_id,this.SemanticSearchLastValue)}}></mwc-icon-button>
						<mwc-icon-button icon="delete" title="empty filter" @click=${() => { this.SemanticSearchLastValue=""; this.updateFilter('id', ''); }}></mwc-icon-button>
					</div>`
					: html``), html``)}
				${this.datasetsGridSection}
			</div>
			${this.dialogNewDataset}
			${this.dialogNewDatasetName}
		`;
	}

	/******************* dialogs *******************/

	get dialogNewDataset() {
		return html`
			<mwc-dialog heading="Add a new Dataset" id="dialog-new-dataset"><div style="text-align: center; height: 45em">
				<div> Choose a location type </div>
				<div><mwc-select style="width: 16em" id='mwc-select' label="location type" @selected=${(evt) => {
						if (evt.detail.index == -1) {//reinitialize dialog
							this.shadowRoot.getElementById('dialog-new-dataset_enabled').hidden = true;
						} else {
							switch (evt.detail.index) {
								case 0://local path
									this.default_path = "relative/path/to/data/";
									this.pathOrURL = 'Path';
									break;
								case 1://URL
									this.default_path = "http://path/to/data/";
									this.pathOrURL = 'URL';
									break;
							}
							//enable dialog second part
							this.shadowRoot.getElementById('dialog-new-dataset_enabled').hidden = false;//disable dialog second part
						}
					}}>
					<mwc-list-item twoline value="0"><span> Local path -</span>
						<span slot="secondary">(Use a relative path to workspace)</span>
					</mwc-list-item>
					<mwc-list-item twoline value="1"><span> URL -</span>
						<span slot="secondary">(Use a remote address)</span>
					</mwc-list-item>
				</mwc-select></div>
				<p></p>
				<div id='dialog-new-dataset_enabled' hidden>
					<div> Enter ${this.pathOrURL.toLowerCase()} of dataset </div>
					<div><mwc-textfield id="io-path" label="${this.pathOrURL} of dataset" value=${this.default_path} dialogInitialFocus></mwc-textfield></div>
					<p></p>
					<div> Enter a name for this dataset </div>
					<div><mwc-textfield id="io-name" label="dataset name" value="my_dataset"></mwc-textfield></div>
					<p></p>
					<div> Enter the type of data to load </div>
					<div><mwc-select style="width: 25em" id='io-data_type' label="data type"
						helper="using sequence-* will consider every sub-folder as a video/image sequence"
							<mwc-list-item></mwc-list-item>
							<mwc-list-item twoline value="image" selected><span> images -</span>
								<span slot="secondary">(folder(s) containing images)</span>
							</mwc-list-item>
							<mwc-list-item twoline value="pcl"><span> pointclouds -</span>
								<span slot="secondary">(folder(s) containing pointcloud files)</span>
							</mwc-list-item>
							<mwc-list-item twoline value="pcl_image"><span> pointclouds + images -</span>
								<span slot="secondary">(folder(s) containing pointcloud files and images)</span>
							</mwc-list-item>
							<mwc-list-item twoline value="sequence_image"><span> image sequences -</span>
								<span slot="secondary">(folder(s) containing image sequences)</span>
							</mwc-list-item>
							<mwc-list-item twoline value="sequence_pcl"><span> pointcloud sequences -</span>
								<span slot="secondary">(folder(s) containing sequences of pointcloud files)</span>
							</mwc-list-item>
							<mwc-list-item twoline value="sequence_pcl_image"><span> pointcloud + image sequences -</span>
								<span slot="secondary">(folder(s) containing sequences of image + pointcloud)</span>
							</mwc-list-item>
					</mwc-select></div>
					<div>
						<mwc-button slot="primaryAction" dialogAction="close" @click=${() => { this.addDataset(); this.shadowRoot.getElementById('mwc-select').select(-1); }}> Ok </mwc-button>
						<mwc-button slot="secondaryAction" dialogAction="close" @click=${() => this.shadowRoot.getElementById('mwc-select').select(-1)}> Cancel </mwc-button>
					</div>
				</div>
				<p></p>
			</mwc-dialog></div>
		`;
	}

	get dialogNewDatasetName() {
		return html`
			<mwc-dialog heading="Add a new Dataset" id="dialog-new-dataset-name"><div style="text-align: center;">
					<div> Enter a name for this dataset </div>
					<div><mwc-textfield id="io-name2" label="dataset name" value="my_dataset"></mwc-textfield></div>
					<p></p>
					<div>
						<mwc-button slot="primaryAction" dialogAction="close" @click=${() => this.createDatasetFromSelection()}> Ok </mwc-button>
						<mwc-button slot="secondaryAction" dialogAction="close"> Cancel </mwc-button>
					</div>
				</div>
				<p></p>
			</mwc-dialog></div>
		`;
	}

	get dialogRemoveDataset() {
		const datasetId = getState('media').datasetId;
		return html`
			<mwc-dialog heading="Remove task" id="dialog-remove-dataset">
				<div> Remove Dataset ${datasetId}? </div>
				<mwc-button
					slot="primaryAction"
					dialogAction="ok"
					@click=${this.removeDataset}>
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
}
customElements.define('app-datasets-manager', AppDatasetsManager);

