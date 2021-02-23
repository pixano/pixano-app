/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import { store, getStoreState } from '../store';
import { undo, redo, putLabels } from '../actions/annotations';
import { updateTaskName, fetchNewJob, putJob, interruptJob } from '../actions/application';
import '@material/mwc-icon-button';
import '@material/mwc-snackbar';

import { AppExplore } from './app-explore';

class AppLabel extends AppExplore {
  static get properties() {
    return {
      pluginName: super.pluginName,
      jobObjective: { type: String },
      jobId: { type: String }
    };
  }

  constructor() {
    super();
    this.jobDefaultObjective = 'to_annotate';
    this.annotatorName = '';
    this.jobId = '';
    window.addEventListener('keydown', (evt) => {
      if(this.active) {
        const lowerKey = evt.key.toLowerCase();
        if (lowerKey === 's' && evt.ctrlKey) {
          evt.preventDefault();
          this.save();
        }
      }
    });

    window.addEventListener('keyup', (evt) => {
      if(this.active) {
        const lowerKey = evt.key.toLowerCase();
        if (lowerKey === 'z' && evt.ctrlKey && evt.shiftKey) {
          this.redo();
        } else if (lowerKey === 'z' && evt.ctrlKey) {
          this.undo();
        } 
      }
    });
  }
  
  onActivate() {
    const paths = window.location.hash.split('/');
    const taskName = paths[1];
    this.jobObjective = paths[2] || this.jobDefaultObjective;
    store.dispatch(updateTaskName(taskName));
    const task = getStoreState('application').tasks.find((t) => t.name === taskName);
    this.pluginName = task.spec.plugin_name;
    this.launchPlugin(this.pluginName).then((mod) => {
      store.dispatch(fetchNewJob(this.jobObjective)).then((j) => {
        this.jobId = j.data_id;
        this.annotatorName = this.jobObjective === 'to_validate' ? `(${j.annotator})` : '';
        mod.onActivate();
        this.dataPath = this.path;
      }).catch((err) => {
        this.errorPopup(err);
        mod.onActivate();
      });
    });
  }

  /**
   * Invoked when quitting the page.
   */
  onDesactivate() {
    store.dispatch(interruptJob());
  }

  /**
   * Undo last annotation action.
   */
  undo() {
    store.dispatch(undo());
    this.el.refresh();
  }

  /**
   * Redo next annotation action.
   */
  redo() {
    store.dispatch(redo());
    this.el.refresh();
  }

  /**
   * Save labels for a given data id.
   */
  save() {
    store.dispatch(putJob()).then(() => {
      store.dispatch(putLabels()).then(() => {
        this.snack.show();
      }).catch((e) => {
        console.warn('Saving failed.', e);
      })
    }).catch((error) => {
      this.errorPopup(error.message);
    });
  }

  _submissionHelper(objective) {
    store.dispatch(putJob(objective)).then(() => {
      store.dispatch(putLabels()).then(() => {
        store.dispatch(fetchNewJob(this.jobObjective)).then((j) => {
          this.el.newData();
          this.jobId = j.data_id;
          this.annotatorName = this.jobObjective === 'to_validate' ? `(${j.annotator})` : '';
          this.dataPath = this.path;
        }).catch((err) => {
          this.errorPopup(err);
          this.el.newData();
        });
      });
    }).catch((error) => {
      this.errorPopup(error.message);
      store.dispatch(fetchNewJob(this.jobObjective)).then((j) => {
        this.jobId = j.data_id;
        this.annotatorName = this.jobObjective === 'to_validate' ? `(${j.annotator})` : '';
        this.el.newData();
        this.dataPath = this.path;
      }).catch((err) => {
        this.errorPopup(err);
        this.el.newData();
      });
    });
  
  }

  /**
   * Submit job.
   */
  submit() {
    this._submissionHelper('to_validate');    
  }

  /**
   * Validate job.
   */
  validate() {
    this._submissionHelper('done'); 
  }

  /**
   * Reject job.
   */
  reject() {
    this._submissionHelper('to_correct');
  }

  get headerContent() {
    return html`
      <mwc-icon-button style="margin: 0;"
                       icon="keyboard_backspace"
                       title="Back"
                       @click=${() => this.goHome()}></mwc-icon-button>
      <h1>${this.pluginName} ${this.annotatorName}</h1>
      <p style="user-select: text;">${this.dataPath}</p>
      <mwc-icon-button icon="undo"
                       title="undo"
                       @click=${() => this.undo()}></mwc-icon-button>
      <mwc-icon-button icon="redo"
                       title="redo"
                       @click=${() => this.redo()}></mwc-icon-button>
      <mwc-icon-button icon="save"
                       title="save"
                       @click=${() => this.save()}></mwc-icon-button>
      ${this.buttons}
    `
  }

  get buttons() {
    switch(this.jobObjective) {
      case 'to_annotate': {
        return this.toAnnotateButtons;
      }
      case 'to_validate': {
        return this.toValidateButtons;
      }
      case 'to_correct': {
        return this.toCorrectButtons;
      }
    }
  }

  get toAnnotateButtons() {
    return html`
      <mwc-button @click=${() => this.submit()}>SUBMIT</mwc-button>
    `
  }

  get toValidateButtons() {
    return html`
      <mwc-button @click=${() => this.reject()}>REJECT</mwc-button>
      <mwc-button @click=${() => this.validate()}>VALIDATE</mwc-button>
    `
  }

  get toCorrectButtons() {
    return html`
      <mwc-button @click=${() => this.submit()}>RE-SUBMIT</mwc-button>
    `
  }

  get snack() {
    return this.shadowRoot.getElementById('infoSnack');
  }

  get body() {
    return html`
    ${super.body}
    <mwc-snackbar id="infoSnack" labelText="Successfully saved labels !" timeoutMs=4000></mwc-snackbar>
    `;
  }
}
customElements.define('app-label', AppLabel);
