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

import '@material/mwc-button';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-textfield';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-check-list-item';

import {
	updateDatasetId,
	getDatasets,
	fetchRangeDatas,
	importDataset,
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
					if (this.datasetIdx===-1) this.datasetIdx = this.datasets.length-1;//select the last one if nothing was selected
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
		if (this.table) this.refreshGrid();//don't refresh if no dataset has been created for now
		store.dispatch(updateFilters({}));//refresh filters (don't take filters last search on tasks)
	}

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
			.then(() => this.refreshGrid())
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
				this.refreshGrid();
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
				margin: auto;
				overflow: hidden;
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
					<mwc-textfield label="Path" icon="filter_list" @input=${(evt) => this.updateFilter('path', getValue(evt))}></mwc-textfield>
				</div>
				<div></div>
				<div id="time-header">Preview</div>
				<div></div>
			</div>
		`;
	}
	/**
	* Table row
	*/
	listitem(item) {
		return html`
			<mwc-check-list-item left id=${item.data_id}>
				<div class="list-item">
					<p></p>
					<div title=${item.path}><span>${item.path}</span></div>
					<p></p>
					<img src="data:image/jpg;base64,${item.thumbnail}">
					<p></p>
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
				${this.datasetsGridSection}
			</div>
			${this.dialogNewDataset}
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

