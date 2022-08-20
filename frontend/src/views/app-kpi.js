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
        countItemsGlobal: { type: Number },
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
      this.countItemsGlobal = 0;
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
    async refreshGrid() {
      await this.getResults().then((res) => {
        this.items = res;
      });

      this.itemsGlobal = []
      this.countItemsGlobal = 0
      const appState = getState().application
      const taskName = appState.taskName;
  
      this.items.map(x => GET(`/api/v1/tasks/${taskName}/labels/${x.data_id}`)).map(x => x.then((response) => {
        this.countItemsGlobal = this.countItemsGlobal + response.annotations.length;
        response.annotations.map(x => this.itemsGlobal.push(x.category));
      }));

      //If need to check the json :
      /* this.items.map(x => {
        var x_tmp = {}
        for (let i = 0; i < Object.keys(x).length; i++) {
          if (Object.keys(x)[i] != 'thumbnail') {
            x_tmp[Object.keys(x)[i]] = x[Object.keys(x)[i]]
          }
        }
        console.log(`Dictionnaire : ${JSON.stringify(x_tmp, null, 4)}`)
      }); */
    }
    
    stateChanged(state) {
      this.username = state.user.currentUser.username;
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
          //box-shadow: -10px 15px 8px #888888;
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

    /**
    * Create an GTML list base on JS array
    */
    makeUL(array) {
      var list = document.createElement('ul'); // Create the list element
      for (var i = 0; i < array.length; i++) {
        var item = document.createElement('li'); // Create the list item
        item.appendChild(document.createTextNode(array[i])); // Set its contents
        list.appendChild(item); // Add it to the list
      }
      return list; // Finally, return the constructed list
    }

    /**
    * map every Time Label (for example cumulated_time) of a Task and compute the total Time 
    */
    timeLabelToTotalTime(label, milliseconds) {
      var totalTime = this.items.map(x => +x[label]).reduce((a, b) => a + b, 0)
      // SECONDS FROMAT
      /* if (milliseconds) {
        totalTime = totalTime*0.001  // multiply by 1000 if var in s => Date() requires ms
      }
      return totalTime */
      // DATE FROMAT
      if (!milliseconds) {
        totalTime = totalTime*1000  // multiply by 1000 if var in s => Date() requires ms
      }
      var dateTime = new Date(totalTime);
      dateTime.setHours(dateTime.getHours() - 1);
      var dateTimeStr = dateTime.toTimeString().split(' ')[0]
      
      return dateTimeStr
    }
  
    get headerContent() {
      return html`
        <mwc-icon-button style="margin: 0;" icon="keyboard_backspace" @click=${() => this.goHome()}></mwc-icon-button>
        <h1 class="display-4">KPI Viewer</h1>
        ${super.headerContent}
      `
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
  
    get kpiSection() {
      const taskName = getState('application').taskName;
      const taskTime = this.timeLabelToTotalTime("cumulated_time", false)
      // const loadingTime = this.timeLabelToTotalTime("loading_time_cumulated", true)
      // <br>Total Loading Time : ${loadingTime.toFixed(2)} seconds
      return html`
      <div id="kpi-panel" class="kpi-panel">
          <div id="title-kpi-panel">
              <h1 class="display-4">Project's KPI - ${taskName}</h1>
          </div>
          <div id="content-kpi-panel" style="display: flex;">
              <p>
                Number of Frame : ${this.globalCounter}
                <br>Total Time to Complete Task : ${taskTime} seconds
                <br>Total Number of Annotations : ${this.itemsGlobal.length}
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
            ${this.kpiSection}
        </div>
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