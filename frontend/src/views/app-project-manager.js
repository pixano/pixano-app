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
import '@material/mwc-tab'; 
import '@material/mwc-tab-bar';
import '@material/mwc-textfield';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-switch';
import '@trystan2k/fleshy-jsoneditor/fleshy-jsoneditor.js';

import { defaultLabelValues, pluginsList, getDataType, defaultSettings } from '../plugins/index';

import {
  updateTaskName,
  snapshotProject,
  exportTasks,
  importTasks,
  importTaskFromKafka,
  deleteTask,
  postTask,
  putTask,
  getTasks
  } from '../actions/application';
import { Select } from '@material/mwc-select';

class AppProjectManager extends connect(store)(TemplatePage) {
  static get properties() {
    return {
      tasks: { type: Array },
      taskIdx: { type: Number },
      creatingTask: { type: Boolean },
	  importExportText: { type: String },
	  pathOrURL: { type: String },
    };
  }

  get taskSettings() {
    return this.shadowRoot.getElementById('taskSettings');
  }

  get pluginSettings() {
    return this.shadowRoot.getElementById('pluginSettings');
  }

  constructor() {
    super();
    this.tasks = [];
    this.taskIdx = -1;
    this.creatingTask = false;
	this.importExportText = "undetermined";
	this.pathOrURL = "undetermined";
	this.default_path = "";
  }

  onActivate() {
    this.taskIdx = -1; // To force taskIdx to change with stateChanged
    this.tasks = getState('application').tasks;
    this.taskIdx = getState('application').tasks.findIndex((t) => t.name === getState('application').taskName);
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('taskIdx') && this.taskIdx >= 0) {
      this.updateDisplayedSettings();
    }
  }

  /**
   * Update Json editor content
   * from the label_schema of the current
   * selected task.
   */
   updateDisplayedSettings() {
    if (this.taskIdx >= 0) {
      this.taskSettings.json = this.tasks[this.taskIdx].spec.label_schema || { category: []};
      this.pluginSettings.json = this.tasks[this.taskIdx].spec.settings || {};
    } 
  }

  /**
   * Fired when exporting a project
   */
  onExport() {
    const browserElem = this.shadowRoot.getElementById('dialog-import-export-path');
	this.importExportText = 'export';
    browserElem.mode = 'export';
    browserElem.open = true;
  }

  /**
   * Fired when importing a project
   */
  onImport() {
    const browserElem = this.shadowRoot.getElementById('dialog-import-export-path');
	this.importExportText = 'import';
    browserElem.mode = 'import';
    browserElem.open = true;
  }

	/**
	 * Fired when importing from kafka
	 */
	onImportFromKafka() {// ... TODO : get back from 'image' to 'remote_image' when minio will work without local copy
		// create a new task squeleton to be populated
		const plugin_name = 'classification';//default task is classification
		const task = {
			name : 'importedFromKafka',
			spec: {
				plugin_name,
				label_schema: defaultLabelValues(plugin_name),
				settings: defaultSettings(plugin_name),
				data_type: 'image'
			},
			dataset: { path: 'importedFromKafka'}
		};

		store.dispatch(importTaskFromKafka(task)).then((newtask) => {
			console.log("newtask=",newtask);
			// update local copy of Redux
			this.tasks = getState('application').tasks;
			this.taskIdx = getState('application').tasks.findIndex((t) => t.name === getState('application').taskName);
		}).catch((error) => this.errorPopup(error.message));
	}

  /**
   * Fired when exporting a project
   */
  importExport(){
    const pathDiag = this.shadowRoot.getElementById('dialog-import-export-path');
    const fn = pathDiag.mode === 'export' ?
                exportTasks : importTasks;
    
	const ioPath = this.shadowRoot.getElementById('io-path').value;
	store.dispatch(fn(ioPath,this.pathOrURL==='URL')).then(() => {
      store.dispatch(getTasks()).then(() => {
        this.onActivate();
      })

    }).catch(error => {
      this.errorPopup(error.message);
      store.dispatch(getTasks());
    });
  }

  /**
   * Add a new temporary task.
   * Creation must be confirmed for the task
   * to be added in the database.
   */
  onAddTask() {
    const plugin_name = pluginsList[0];
    // fill default values
    const task = {
      name : '',
      spec: {
        plugin_name,
        label_schema: defaultLabelValues(plugin_name),
        settings: defaultSettings(plugin_name),
        data_type: getDataType(plugin_name)
      },
      dataset: { path: 'images/'} };
    const newTasks = [...this.tasks, task];
    this.creatingTask = true;
    this.tasks = newTasks;
    this.taskIdx = this.tasks.length - 1;
  }

  /**
   * Fired when user wants to delete a task.
   */
  onRemoveTask() {
    this.shadowRoot.getElementById('dialog-remove-task').open = true;
  }

  /**
   * Remove a task.
   */
  removeTask() {
    const taskName = this.tasks[this.taskIdx].name;
    store.dispatch(deleteTask(taskName)).then(() => {
      this.tasks = getState('application').tasks;
      this.taskIdx = getState('application').tasks.findIndex((t) => t.name === getState('application').taskName);
    })
  }

	/**
	 * Fired when task tab changes.
	 * @param {*} e 
	 */
	onTabChanged(e) {
		if (this.taskIdx !== e.detail.index) {
			if (this.creatingTask) this.onCancelTask();// if tab change after a "new task" without hitting "create Task"
			this.taskIdx = e.detail.index;
			store.dispatch(updateTaskName(this.tasks[this.taskIdx].name));
		}
	}

  /**
   * Create the new configured task.
   */
  onCreateTask() {
	this.SaveOrCreateTask()
  }

  /**
   * Cancel new task creation.
   */
  onCancelTask() {
    this.tasks.pop();
    this.tasks = [...this.tasks];
    this.taskIdx = this.tasks.length - 1;
	this.creatingTask = false;
  }

  /**
   * Save currently displayed task. (for now : only task details can be changed, the name, dataset and annotation type have to remain the same)
   */
  onSaveTask() {
	this.SaveOrCreateTask();
  }

	/**
	 * Save a modified task or create the new configured task.
	 */
	SaveOrCreateTask() {
		let task = { ...this.tasks[this.taskIdx] };
		// const reg = new RegExp('[^=a-zA-Z0-9-_]+',);
		// const isWrongContained = reg.test(task.name);
		// if (!task.name || isWrongContained) {
		// 	this.errorPopup("Enter a correct task name");
		// 	return;
		// }
		task.spec.label_schema = this.taskSettings.json;
		task.spec.settings = this.pluginSettings.json;
		const fn = this.creatingTask ? postTask : putTask;
		store.dispatch(fn(task)).then(() => {
			this.creatingTask = false;
		}).catch((error) => {
			this.errorPopup(error.message);
			this.onCancelTask();
		});
	}

  static get styles() {
    return [super.styles, css`
    .section {
      border: 1px solid #e5e5e5;
    }
    .section-header {
      font-size:15px;
      padding: 6px 16px;
      line-height: 36px;
      color: #5c5c5c;
      border-color: #e5e5e5;
    }
    .form-group {
      padding: 16px;
    }
    .form-group > * {
      flex: 1 200px;
    }
    #project-page {
      max-width: 1380px;
      margin: auto;
      position: absolute;
      left: 0px;
      right: 0;
    }
    mwc-tab-bar {
      background: rgb(250, 250, 250);
      padding-top: 0px;
      --mdc-theme-primary: var(--pixano-color);
      --mdc-theme-secondary: var(--pixano-color);
    }
    mwc-button {
      --mdc-button-outline-color: var(--pixano-color);
      --mdc-theme-primary: var(--pixano-color);
    }
    .single {
      height: 500px;
      width: 100%;
      --mdc-theme-primary: var(--pixano-color);
    }
    .multi {
      --mdc-theme-primary: grey;
    }
    .add-task {
      flex-direction: column;
      --mdc-button-outline-color: transparent;
    }
    fleshy-jsoneditor {
      width: 50%;
      height: 400px;
    }
    `]
  } 

  get headerContent() {
    return html`
      <mwc-icon-button style="margin: 0;" icon="keyboard_backspace" @click=${() => this.goHome()}></mwc-icon-button>
      <h1 class="display-4">Task Manager</h1>
      <mwc-icon-button icon="exit_to_app"
                       @click=${() => store.dispatch(logout())}
                       title="Log out"></mwc-icon-button>
    `
  }

  /**
   * Fired when task name changed
   * @param {*} e 
   */
  onTaskNameInput(e) {
    this.tasks[this.taskIdx].name = getValue(e);
  }

  /**
   * Fired when data input text is changed
   * @param {*} e 
   */
  onDataInput(e) {
    this.tasks[this.taskIdx].dataset.path = getValue(e);
  }

  autoCreateSegmentationTask() {
    const taskName = this.tasks[this.taskIdx].name;
    store.dispatch(autoCreateTask(taskName)).then(() => {
      this.onActivate();
    })
  }

  get taskHeader() {
    return html`
      <div class="section-header"> Task Configuration
        <div style="display: block; float: right;">
          <mwc-button outlined
                        type="button"
                        title="Copy database with annotation and their status into an archive"
                        @click="${() => snapshotProject()}">Snapshot</mwc-button>
            <mwc-button outlined
                        type="button"
                        title="Export annotations only to json files"
                        @click="${this.onExport}">Export</mwc-button>
            <mwc-button outlined
                        type="button"
                        title="Import annotations from json files"
                        @click="${this.onImport}">Import from files</mwc-button>
			<mwc-button outlined
                        type="button"
                        title="Import annotations from Kafka"
                        @click="${this.onImportFromKafka}">Import from Kafka</mwc-button>
        </div>
      </div>
    `;
  }

  get taskSection() {
    const t = this.tasks[this.taskIdx];
    const taskName = t ? t.name : '';
    const datasetPath = t ? t.dataset.path : '';
    const pluginName = t ? t.spec.plugin_name : '';
    return html`
    <form class="section">
      ${this.taskHeader}
      <div>
        <mwc-tab-bar @MDCTabBar:activated=${this.onTabChanged} activeindex="${this.taskIdx}">
          ${this.tasks.map((t) => html`<mwc-tab label="Task ${t.name}" style="max-width: 200px;"></mwc-tab>`)}
          <mwc-button outlined
                      id="add-task"
                      class="add-task ${this.tasks.length ? 'multi' : 'single'}"
                      style=${this.creatingTask ? 'display: none;': 'display: flex;'}
                      type="button"
                      icon="add"
                      title="Add new annotation task"
                      @click="${this.onAddTask}">New task</mwc-button>
        </mwc-tab-bar>
        <div style="${t != undefined && this.tasks.length ? 'display: block;': 'display: none;'}">
          <div class="form-group" style="display: flex; flex-wrap: wrap;">
              <mwc-textfield label="Task name" required pattern="[a-zA-Z0-9-_]+"
                            ?disabled=${!this.creatingTask}
                            @input="${this.onTaskNameInput}"
                            value="${taskName}"></mwc-textfield>
              <mwc-textfield label="Data folder" required
                            ?disabled=${!this.creatingTask}
                            @input="${this.onDataInput}"
                            value="${datasetPath}"></mwc-textfield>
              <mwc-select id="plugin"
                          label="Plugin"
                          ?disabled=${!this.creatingTask}
                          @action=${(e) => {
                                  const newValue = e.target.value;
                                  if (this.creatingTask && pluginName && newValue != pluginName) {
                                    t.spec.plugin_name = newValue;
                                    t.spec.data_type = getDataType(newValue);
                                    t.spec.label_schema = defaultLabelValues(newValue);
                                    t.spec.settings = defaultSettings(newValue);
                                    this.updateDisplayedSettings();
                                  }
                                }}>
                ${pluginsList.map((v) => html`<mwc-list-item value=${v} ?selected=${pluginName == v}>${v}</mwc-list-item>`)}
              </mwc-select>
            </div>
            <div>
              <h1 style="font-size: 16px; color: #626262; margin-top: 20px; margin-bottom: 20px;">Label and plugin configurator</h1>
              <div style="display: flex;">
                <fleshy-jsoneditor id="taskSettings" mode="code"></fleshy-jsoneditor>
                <fleshy-jsoneditor id="pluginSettings" mode="code"></fleshy-jsoneditor>
              </div>
            </div>
            ${this.creatingTask ? html`
            <mwc-button outlined type="button" icon="save" @click="${this.onCreateTask}">Create task</mwc-button>
            <mwc-button outlined type="button" @click="${this.onCancelTask}">Cancel</mwc-button>
            ` : html`
            <mwc-button outlined type="button" icon="save" @click="${this.onSaveTask}">Save task</mwc-button>
            <mwc-button outlined id="remove-task" type="button" icon="delete" @click="${this.onRemoveTask}">Remove task</mwc-button>
            `}
            </div>
      </div>
    </form>
    <mwc-dialog heading="Remove task" id="dialog-remove-task">
      <div>Remove task ${this.tasks.length > 0 && t ? t.name: ''}? <br>
      WARNING: All associated jobs will be lost.
      </div>
      <mwc-button
          slot="primaryAction"
          dialogAction="ok"
          @click=${() => this.removeTask()}>
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

	get pageContent() {
    const t = this.tasks[this.taskIdx];
    const pluginName = t ? t.spec.plugin_name : '';
		return html`
			<div id="project-page">
				${this.taskSection}
			</div>

			<mwc-dialog style="text-align: center;" heading="${this.importExportText.toUpperCase()}" id="dialog-import-export-path">
				<div> Choose an ${this.importExportText} location type</div>
				<div><mwc-select style="width: 16em;" id='mwc-select' label="${this.importExportText} type" @selected=${(evt) => {
								if (evt.detail.index==-1) {//reinitialize dialog
									this.shadowRoot.getElementById('importexportdialog_disabled').hidden=false;//disable dialog second part
									this.shadowRoot.getElementById('importexportdialog_enabled').hidden=true;
								} else {
									switch (evt.detail.index) {
										case 0://local path
											this.default_path = "my_export";
											this.pathOrURL = 'Path';
											break;
										case 1://URL
											if (pluginName==='classification') this.default_path = "https://elasticsearch-ec5.confiance.irtsystemx.org/annotation_v2_test/";
                      else if (pluginName==='smart-rectangle') this.default_path = "https://elasticsearch-ec5.confiance.irtsystemx.org/annotation_v4_valeo_test/";
                      else this.default_path = "https://elasticsearch-ec5.confiance.irtsystemx.org/";
											this.pathOrURL = 'URL';
											break;
									}
									//enable dialog second part
									this.shadowRoot.getElementById('importexportdialog_disabled').hidden=true;
									this.shadowRoot.getElementById('importexportdialog_enabled').hidden=false;
								}
							}}>
					<mwc-list-item twoline value="0"><span>Local path - </span><span slot="secondary">(Use a relative path to workspace)</span></mwc-list-item>
					<mwc-list-item twoline value="1"><span>URL - </span><span slot="secondary">(Use a remote address)</span></mwc-list-item>
				</mwc-select></div>
				<div id='importexportdialog_disabled'>
					<div style="color: #ccc"> Enter a location to ${this.importExportText} </div>
					<div><mwc-textfield disabled label="location for ${this.importExportText}"></mwc-textfield></div>
					<div>
						<mwc-button disabled slot="primaryAction" dialogAction="close"> Ok </mwc-button>
						<mwc-button slot="secondaryAction" dialogAction="close"> Cancel </mwc-button>
					</div>
				</div>
				<div id='importexportdialog_enabled' hidden>
					<div> Enter a ${this.pathOrURL.toLowerCase()} to ${this.importExportText} </div>
					<div><mwc-textfield id="io-path" label="${this.pathOrURL} for ${this.importExportText}" value=${this.default_path} dialogInitialFocus></mwc-textfield></div>
					<div>
						<mwc-button slot="primaryAction" dialogAction="close" @click=${() => {this.importExport(); this.shadowRoot.getElementById('mwc-select').select(-1);}}> Ok </mwc-button>
						<mwc-button slot="secondaryAction" dialogAction="close" @click=${() => this.shadowRoot.getElementById('mwc-select').select(-1)}> Cancel </mwc-button>
					</div>
				</div>
			</mwc-dialog>
		`
	}
}
customElements.define('app-project-manager', AppProjectManager);

