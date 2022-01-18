/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

//ADD BY TOM

import { html, css } from 'lit-element';
import TemplatePage from '../templates/template-page';
import { store, getState } from '../store';
import {
  updateTaskName,
  updateFilters,
  fetchRangeResults,
  putResultStatus,
  resetResultStatus
  } from '../actions/application';
import { logout } from '../actions/user';
import { getValue, format } from '../helpers/utils';
import { GET } from '../actions/requests.js';

import '@material/mwc-dialog';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-check-list-item';
import '@material/mwc-select';
import '@material/mwc-linear-progress';
import '@material/mwc-icon-button';
import '@material/mwc-checkbox';

class AppKPI extends TemplatePage {
    static get properties() {
        return {
          jobs: { type: Array },
          nbSelectedJobs: { type: Number },
          newStatus: { type: String },
          page: { type: Number },
          resultsLength: { type: Number },
          pageSize: { type: Number },
          items: { type: Array },
          //add by tom
          testGlobal: { type: Number },
          itemsGlobal: { type: Array }
        };
      }
    
      constructor() {
        super();
        this.nbSelectedJobs = 0;
        this.selectedJobs = [];
        
        this.pageSize = 100;
        this.page = 1;
        this.resultsLength = 1;
        this.sorts = [];
        this.items = [];
        this.pageSizes = [5, 100, 200];
        this.globalCounter = 0;
        this.doneCounter = 0;
        this.toValidateCounter = 0;
        //add by tom
        this.testGlobal = 0;
        this.itemsGlobal = [];
    
        this.statusMap = new Map([['', ['', '', '']], 
                                  ['to_annotate', ['to annotate', 'create', 'blue']], 
                                  ['to_validate', ['to validate', 'youtube_searched_for', 'orange']],
                                  ['to_correct', ['to correct', 'thumb_down', 'red']], 
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
        this.refreshGrid();
      }
    
      /**
       * Refresh the grid from the database
       * state.
       */
      refreshGrid() {
        this.table.items.forEach((e) => e.selected = false);
        this.tableCheckbox.checked = false;
        this.nbSelectedJobs = 0;
        this.table.layout();
        this.getResults().then((res) => {
          this.items = res;
        });

        //add by tom
        this.itemsGlobal = []
        this.testGlobal = 0
        const appState = getState().application
        const taskName = appState.taskName;
    
        this.items.map(x => GET(`/api/v1/tasks/${taskName}/labels/${x.data_id}`)).map(x => x.then((response) => {
          this.testGlobal = this.testGlobal + response.annotations.length;
          // print the whole dictionnary for annotations :
          //response.annotations.map(x => console.log(`Dictionnaire : ${JSON.stringify(x, null, 4)}`));
          response.annotations.map(x => this.itemsGlobal.push(x.category));
        }));

        //test :
        this.items.map(x => console.log(`Dictionnaire : ${JSON.stringify(x, null, 4)}`));
      }
      
      stateChanged(state) {
        this.username = state.user.currentUser.username;
      }
    
      /**
       * Update redux filter states and refresh grid.
       * @param {String} key 
       * @param {String} value 
       */
      updateFilter(key, value) {
        const oldFilters = getState('application').filters
        if (oldFilters[key] !== value){
          const newFilters = {...oldFilters, [key]: value};
          store.dispatch(updateFilters(newFilters));
          this.refreshGrid();
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
       * Fired when a row is selected/unselected.
       */
      onItemSelected(evt) {
        this.nbSelectedJobs = evt.detail.index.size;
        const shouldIndeterminate = this.nbSelectedJobs > 0 && this.nbSelectedJobs < this.table.items.length;
        this.tableCheckbox.indeterminate = shouldIndeterminate;
        this.tableCheckbox.checked = shouldIndeterminate ? false : this.nbSelectedJobs > 0;
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
        this.nbSelectedJobs = this.tableCheckbox.checked ? this.table.items.length : 0;
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
        if(this.page > 1) {
          this.page -= 1;
          this.refreshGrid();
        }
      }
    
      /**
       * Triggered when first page button is clicked.
       */
      onFirstPage() {
        if (this.page > 1) {
          this.page=1;
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
    
      static get styles() {
        return [super.styles, css`
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
          button[selected] {
            background: red;
          }
          mwc-button {
            --mdc-button-text-transform: capitalize;
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
          
          #kpi-panel {
            height: 80%;
            width: 100%;
            margin-top : 2%;
            margin-left : 15%;
            margin-right : 15%;
            border: 1px solid #e5e5e5;
            box-shadow: -10px 15px 8px #888888;
          }
          #title-kpi-panel {
            overflow: hidden;
            color: #5c5c5c;
            background-color: #fafafa;
          }
          #content-kpi-panel {
            margin-top : 2%;
            margin-left : 10%;
            margin-right : 10%;
            border: 1px solid #e5e5e5;
          }
          #content-kpi-panel p {
            font-size: large;
            margin-top : 2%;
            margin-left : 2%;
            margin-right : 2%;
            line-height: 1.5;
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
        <mwc-icon-button style="margin: 0;" icon="keyboard_backspace" @click=${() => this.goHome()}></mwc-icon-button>
        <h1 class="display-4">User Manager</h1>
        <mwc-icon-button icon="exit_to_app"
                         @click=${() => store.dispatch(logout())}
                         title="Log out"></mwc-icon-button>
          </div>
        `
      }
    
      styleMap(show) {
        return show ? 'visibility: visible': 'visibility: hidden;';
      }
    
      /**
       * Display table row
       * Status | Data Id | Annotator | Validator | State | Time | Thumbnail | Launch
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
            <p><img src="data:image/jpg;base64,${item.thumbnail}" ></p>
            <p><mwc-icon-button class="launch" icon="launch" @click=${(evt) => this.onExplore(evt, item.data_id)}></mwc-icon-button></p>
          </div>
        </mwc-check-list-item>
        <li divider role="separator"></li>
        `;
      }

    /**
    * Create an GTML list base on JS array
    */
    makeUL(array) {
        // Create the list element:
        var list = document.createElement('ul');
    
        for (var i = 0; i < array.length; i++) {
            // Create the list item:
            var item = document.createElement('li');
    
            // Set its contents:
            item.appendChild(document.createTextNode(array[i]));
    
            // Add it to the list:
            list.appendChild(item);
        }
    
        // Finally, return the constructed list:
        return list;
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
                        @selected=${(evt) => this.updateFilter('status', statusList[evt.detail.index][0])}>
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
                        @selected=${(evt) => this.updateFilter('in_progress', assignedList[evt.detail.index][0])}>
              ${assignedList.map((s) => {
                  return html`<mwc-list-item ?selected=${filters.in_progress === s[0]} value=${s[0]}>${s[1]}</mwc-list-item>`;
                })}
            </mwc-select>
          </div>
          <div id="time-header">Time</div>
          <div>
            <mwc-textfield label="Preview" icon="filter_list"></mwc-textfield>
          </div>
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
            <div>Change status to '${this.newStatus}' for ${this.nbSelectedJobs} selected jobs? <br>
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
            ${
              tasks.map((p) => html`<mwc-list-item value=${p.name}
                                                    ?selected=${taskName === p.name}>${p.name}</mwc-list-item>`)
            }
          </mwc-select>
        </div>
        `;
      }
    
      get mainSection() {
        return html`
        <div class="section" style="flex: 1; display: none;">
          <h1 class="display-4">Label Status</h1>
          <div style="display: flex;">
            <div class="group_buttons" style=${this.styleMap(this.nbSelectedJobs > 0)}>
              ${
                [...this.statusMap.entries()].splice(1).map(([k, v]) => {
                  return html`
                    <mwc-icon-button icon=${v[1]}
                                  title="Tag as ${v[0]}"
                                  @click=${() => this.onTagAs(k)}>
                    </mwc-icon-button>
                  `
                })
              }
              <mwc-icon-button icon="settings_backup_restore"
                                title="Unassign job"
                                @click=${() => this.onDeallocate()}>
              </mwc-icon-button>
            </div>
          </div>
          ${this.tableHeader}
          <mwc-list id="table" multi @selected=${this.onItemSelected.bind(this)} style="height: 55vh; overflow-y: auto;">
            <li divider role="separator"></li>
            ${this.items.map(this.listitem.bind(this))}
          </mwc-list>
          ${this.pagination}
        </div>
        `;
      }
    
      // add by Tom
      get bottomSection() {
        const taskName = getState('application').taskName;

        var totalTaskTime = this.items.map(x => +x.cumulated_time).reduce((a, b) => a + b, 0) 
        totalTaskTime = totalTaskTime * 1000  // multiply by 1000 because Date() requires miliseconds
        var dateTaskTime = new Date(totalTaskTime);
        dateTaskTime.setHours(dateTaskTime.getHours() - 1);
        var TaskTimeStr = dateTaskTime.toTimeString().split(' ')[0]
        totalTaskTime = totalTaskTime*0.001

        var totalLoadingTime = this.items.map(x => +(x.loading_time_cumulated)).reduce((a, b) => a + b, 0) 
        var dateLoadingTime = new Date(totalLoadingTime); // time already in miliseconds here
        dateLoadingTime.setHours(dateLoadingTime.getHours() - 1);
        var LoadingTimeStr = dateLoadingTime.toTimeString().split(' ')[0]
        totalLoadingTime = totalLoadingTime*0.001

        var totalAnnotationTime = this.items.map(x => +(x.annotation_time_cumulated)).reduce((a, b) => a + b, 0) 
        var dateAnnotationTime = new Date(totalAnnotationTime); // time already in miliseconds here
        dateAnnotationTime.setHours(dateAnnotationTime.getHours() - 1);
        var AnnotatingTimeStr = dateAnnotationTime.toTimeString().split(' ')[0]
        totalAnnotationTime = totalAnnotationTime*0.001


        var totalOtherActivitiesTime = totalTaskTime - totalLoadingTime - totalAnnotationTime
        var dateOtherActivitiesTime = new Date(totalOtherActivitiesTime * 1000); // multiply by 1000 because Date() requires miliseconds
        dateOtherActivitiesTime.setHours(dateOtherActivitiesTime.getHours() - 1);
        var OtherActivitiesTimeStr = dateOtherActivitiesTime.toTimeString().split(' ')[0]
        totalOtherActivitiesTime = totalOtherActivitiesTime
    

        var categ = []
        this.items.map(x => {
          categ = Object.getOwnPropertyNames(x.category_annotation_time)
        })
        //console.log("categories "+categ)
        var categ_values = []
        categ.map(x => {
          categ_values.push(this.items.map(y => y.category_annotation_time[x]).reduce((a, b) => a + b, 0))
        })
        //console.log("test "+categ_values)
        const categoryAnnotationTime = []
        categ.forEach((value,key) => categoryAnnotationTime.push(value+" : "+(categ_values[key]*0.001).toFixed(3)+" seconds"));

        var annotationCategories = new Set(this.itemsGlobal);
        // function to count number of occurences
        const countOccurrences = (arr, val) => arr.reduce((a, v) => (v === val ? a + 1 : a), 0);
        const categories = []
        annotationCategories.forEach(x => categories.push(`${x} : ${countOccurrences(this.itemsGlobal, x)}`));

        const annotators = []
        this.items.map(x => {
          annotators.push(x.annotator)
        })
        const uniqueAnnotators = [...new Set(annotators)]
        
        const annotatorsKPI = []
        uniqueAnnotators.map((annotatorName, key) => {
          var tmpKPI = [0, 0, 0, 0];
          this.items.map(x => {
            if (annotatorName === x.annotator) {
              tmpKPI[0] = tmpKPI[0] + +x.cumulated_time*1000;
              tmpKPI[1] = tmpKPI[1] + +x.loading_time_cumulated;
              tmpKPI[2] = tmpKPI[2] + +x.annotation_time_cumulated;
            }
          })
          tmpKPI[3] = tmpKPI[3] + (tmpKPI[0] - (tmpKPI[1] + tmpKPI[2]))
          console.log(tmpKPI);
          annotatorsKPI.push(tmpKPI);
        })
        //console.log(annotatorsKPI);
        /*
                    <br>Total Time to Complete Task : ${TaskTimeStr}
                    <br>Total Loading Time : ${LoadingTimeStr}
                    <br>Total Annotation Time : ${AnnotatingTimeStr}
                    <br>Total Other Activities Time : ${OtherActivitiesTimeStr}
        */
        // ${categories.join(', ')}
        /*
          <select name="cars" id="cars">
              <optgroup label="Total">
                <option value="Total">Total</option>
              </optgroup>
              <optgroup label="Annotators">
                <option value="mercedes">Mercedes</option>
                <option value="audi">Audi</option>
              </optgroup>
            </select>

            KPI per user :
            <br>${uniqueAnnotators[0]}
            <br>${annotatorsKPI[0]}
            <br>${uniqueAnnotators[1]}
            <br>${annotatorsKPI[1]}
        
        */


        return html`
        <div id="kpi-panel" class="kpi-panel">
            <div id="title-kpi-panel">
                <h1 class="display-4">Project's KPI - ${taskName}</h1>
            </div>
            <div id="content-kpi-panel" style="display: flex;">
                <p>
                  Number of Frame : ${this.globalCounter}
                  <br>Total Time to Complete Task : ${totalTaskTime.toFixed(3)} seconds
                  <br>Total Loading Time : ${totalLoadingTime.toFixed(3)} seconds
                  <br>Total Annotation Time : ${totalAnnotationTime.toFixed(3)} seconds
                  <br>Total Other Activities Time : ${totalOtherActivitiesTime.toFixed(3)} seconds
                  <br>Total Number of Annotations : ${this.itemsGlobal.length}
                  <br>Number of Annotations per Category :
                  <br>${this.makeUL(categories)}
                  Total Time of Annotations per Category :
                  <br>${this.makeUL(categoryAnnotationTime)}
                </p>
            </div>
        </div>
        `;
      }
    

      get body() {
        const numTasks = getState('application').tasks.length;
        return numTasks ? html`
          <div class="body">
              ${this.topSection}
              ${this.mainSection}
              ${this.bottomSection}
          </div>
          ${this.dialog}
        ` : html`
        <div id="starter">
        <ol class="custom-counter">
          <li>Configure your annotation project in the <p @click=${this.gotoProjectManager}> Tasks </p> menu</li>
          <li>[Optional] Configure the users for the project in the <p @click=${this.gotoUserManager}> User </p> menu</li>
          <li>Start <p @click=${this.gotoUserManager}> Annotating </p></li>
        </ol>
        </div>`;
      }
    }
customElements.define('app-kpi', AppKPI);