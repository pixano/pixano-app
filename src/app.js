/**
@license
Copyright CEA-LIST/DIASI/SIALV/LVA (2019)

pixano.cea.fr

This software is a collaborative computer program whose purpose is to
generate and explore labeled data for computer vision applications.

This software is governed by the CeCILL-C license under French law and
abiding by the rules of distribution of free software.  You can  use, 
modify and/ or redistribute the software under the terms of the CeCILL-C
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info". 

As a counterpart to the access to the source code and  rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty  and the software's author,  the holder of the
economic rights,  and the successive licensors  have only  limited
liability. 

In this respect, the user's attention is drawn to the risks associated
with loading,  using,  modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean  that it is complicated to manipulate,  and  that  also
therefore means  that it is reserved for developers  and  experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or 
data to be ensured and,  more generally, to use and operate it in the 
same conditions as regards security. 

The fact that you are presently reading this means that you have had
knowledge of the CeCILL-C license and that you accept its terms.
*/


import { LitElement, html, css } from 'lit-element';
import { installRouter } from 'pwa-helpers/router.js';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { store, getStoreState } from './store';
import { navigate, getTasks, interruptJob } from './actions/application';
import { getProfile } from './actions/user';
import 'material-design-icons/iconfont/material-icons.css';
import 'typeface-roboto/index.css';
import '@material/mwc-circular-progress-four-color';


class MyApp extends connect(store)(LitElement)  {
  static get properties() {
    return {
      _page: { type: String },
      waiting: { type: Boolean }
    };
  }
  constructor() {
    super();
    this.ready = false;
    this.waiting = false;

    window.addEventListener('beforeunload', (event) => {
      store.dispatch(interruptJob());
    });

  }

  _locationChanged(location) {
    // What action creator you dispatch and what part of the location
    // will depend on your app.
    store.dispatch(navigate(location.pathname + location.hash));
  }

  goHome() {
    const user = getStoreState('user');
    const page = user.currentUser.role === 'admin' ? '/#dashboard-admin': '/#dashboard-user';
    window.history.pushState({}, '', page);
    store.dispatch(navigate(page));
  }

  goLogin() {
    const page = '/#login';
    window.history.pushState({}, '', page);
    store.dispatch(navigate(page));
  }
  
  firstUpdated() {
    // Automatic check if client is authenticated
    // else redirect to login page
    store.dispatch(getProfile()).then(() => {
      store.dispatch(getTasks()).then( () => {
        this.ready = true;
        installRouter(this._locationChanged);
        const currUrl = location.pathname + location.hash;
        if (currUrl === '/#login') {
          this.goHome();
        } else {
          this._locationChanged(window.location);
        }
      });
    }).catch(() => {
      this.ready = true;
      this.goLogin();
      installRouter(this._locationChanged);
    });  
  }

  stateChanged(state) {
    if (this.ready) {
      this._page = state.application.page;
      this.waiting = state.application.waiting;
    }
  }

  static get styles() {
    return [
      css`
        :host {
          display: block;
          height: 100%;
          overflow: hidden;
        }
        .page {
          display: none;
        }
        .page[active] {
          display: block;
        }
        mwc-circular-progress-four-color {
          position: absolute;
          top: 50%;
          left: 50%;
          --mdc-circular-progress-bar-color-1: #79005D;
          --mdc-circular-progress-bar-color-2: #FF5C64;
          --mdc-circular-progress-bar-color-3: #FF5C64;
          --mdc-circular-progress-bar-color-4: #79005D;
        }
        `]
  }

  render() {
      return html`
        <app-login class="page" ?active="${this._page === 'login'}"></app-login>
        <app-dashboard-user class="page" ?active="${this._page === 'dashboard-user'}"></app-dashboard-user>
        <app-dashboard-admin class="page" ?active="${this._page === 'dashboard-admin'}"></app-dashboard-admin>
        <app-user-manager class="page" ?active="${this._page === 'user-manager'}"></app-user-manager>
        <app-project-manager class="page" ?active="${this._page === 'project-manager'}"></app-project-manager>
        <app-label class="page" ?active="${this._page === 'label'}"></app-label>
        <app-explore class="page" ?active="${this._page === 'explore'}"></app-explore>
        <app-404 class="page" ?active="${this._page === 'view404'}"></app-404>
        <mwc-circular-progress-four-color indeterminate ?closed=${!this.waiting} style="display: ${this.waiting ? "block" : "none"}"></mwc-circular-progress-four-color>
      `;
    }
}

customElements.define('my-app', MyApp);
