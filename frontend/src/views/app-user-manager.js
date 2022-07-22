/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html, css } from 'lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import TemplatePage from '../templates/template-page';
import { store, getState } from '../store';
import { getValue } from '../helpers/utils';
import {
	logout, signup,
	getUsers,
	deleteUser,
	updateUser
} from '../actions/user';

import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-tab';
import '@material/mwc-tab-bar';
import '@material/mwc-textfield';
import '@material/mwc-select';
import '@material/mwc-list';
import '@material/mwc-list/mwc-list-item';

class AppUserManager extends connect(store)(TemplatePage) {
	static get properties() {
		return {
			users: { type: Array },
			enabledUsername: { type: String }
		};
	}

	constructor() {
		super();
		this.users = [];
		this.dropdownValues = {
			'role': ['admin', 'user'],
			'preferences.theme': ['white', 'black']
		};
		this.enabledUsername = '';
	}

	onActivate() {
		// get list of users from server database
		store.dispatch(getUsers()).then(() => {
			this.updateUserTable();
		});
	}

	firstUpdated() {
		super.firstUpdated();
		this.usernameElement = this.shadowRoot.getElementById('username');
		this.passwordElement = this.shadowRoot.getElementById('password');
		this.roleElement = this.shadowRoot.getElementById('role');
		this.themeElement = this.shadowRoot.getElementById('theme');
	}


	/**
	 * Add user to database from the given
	 * input information.
	 */
	onAddUser() {
		const username = this.usernameElement.value;
		const password = this.passwordElement.value;
		const role = this.roleElement.value;
		const theme = this.themeElement.value;
		const value = {
			username,
			password,
			role,
			preferences: { theme }
		}
		if (username && password) {
			store.dispatch(signup(value)).then(() => {
				this.updateUserTable();
			});
		}
	}

	onEdit(user) {
		this.enabledUsername = user.username;
	}

	onDeleteUser(user) {
		store.dispatch(deleteUser(user.username)).then(() => {
			this.updateUserTable();
		});
	}

	onPasswordChanged(e) {
		this.passwordElement.value = getValue(e);
	}

	onSaveUser(user) {
		user.password = this.passwordElement.value;
		store.dispatch(updateUser(user));
		this.enabledUsername = '';
	}

	onCancel() {
		this.enabledUsername = '';
		this.updateUserTable();
	}

	updateUserTable() {
		this.usernameElement.value = '';
		this.passwordElement.value = '';
		this.roleElement.select(0);
		this.themeElement.select(0);
		// force redraw of data table
		this.users = [];
		setTimeout(() => {
			this.users = JSON.parse(JSON.stringify(getState('user').users));
		}, 0)
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
      background-color: #fafafa;
      border-color: #e5e5e5;
    }
    .form-group {
      padding: 16px;
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
    }
    mwc-button {
      --mdc-button-outline-color: var(--pixano-color);
      --mdc-theme-primary: var(--pixano-color);
    }
    .list-item {
      width: 100%;
      display: flex;
      background: whitesmoke;
      border-bottom: solid 1px #8e8e8e;
      height: 55px;
    }
    .list-item > p {
      flex: 1;
      text-align: center;
      margin: auto;
      overflow: hidden;
    }
    .blue {
      color: rgb(22, 118, 243);
    }
    .red {
      color: rgb(245, 36, 25);
    }
    .list-item > div {
      flex: 1;
      text-align: center;
      margin: auto;
      position: relative;
      height: 100%;
    }
    .list-item > div > mwc-select {
      position: absolute;
      --mdc-select-disabled-fill-color: transparent;
      right: 0;
      left: 0;
    }
    .list-item > p > mwc-textfield {
      --mdc-text-field-disabled-fill-color: transparent;
    }
    .header-table {
      font-weight: bold;
      background: white;
      color: black;
    }
    #grid {
      font-size: 16px;
      height: 55vh;
      overflow-y: auto;
      border: 1px solid rgb(142, 142, 142);
    }
    `]
	}

	get headerContent() {
		return html`
      <mwc-icon-button style="margin: 0;" icon="keyboard_backspace" @click=${() => this.goHome()}></mwc-icon-button>
      <h1 class="display-4">User Manager</h1>
      <mwc-icon-button icon="exit_to_app"
                       @click=${() => store.dispatch(logout())}
                       title="Log out"></mwc-icon-button>
    `
	}

	/**
	 * Edition button cell
	 * @param {*} root grid item
	 * @param {*} column column element
	 * @param {*} rowData array item
	 */
	editionCell(user) {
		return html`
      <p style="display: flex; justify-content: flex-end;">
        <mwc-icon-button class="blue"
                          icon="edit"
                          style=${this.enabledUsername === user.username ? 'display: none;' : ''}
                          @click=${() => this.onEdit(user)}></mwc-icon-button>
        <mwc-icon-button class="red"
                          icon="delete"
                          style=${this.enabledUsername === user.username ? 'display: none;' : ''}
                          @click=${() => this.onDeleteUser(user)}></mwc-icon-button>
        <mwc-button style=${this.enabledUsername !== user.username ? 'display: none;' : ''}
                    @click=${() => this.onSaveUser(user)}>Save</mwc-button>
        <mwc-button style=${this.enabledUsername !== user.username ? 'display: none;' : ''}
                    @click=${this.onCancel}>Cancel</mwc-button>
      </p>
    `;
	}

	listitem(user) {
		return html`
		<div class="list-item">
			<p>${user.username}</p>
			<p>
				<mwc-textfield value=${user.password}
							?disabled=${this.enabledUsername !== user.username}
							@input=${this.onPasswordChanged}></mwc-textfield>
			</p>
			<div>
				<mwc-select ?disabled=${this.enabledUsername !== user.username}
							@action=${(e) => user.role = this.dropdownValues['role'][e.detail.index]}>
				${this.dropdownValues['role'].map((v) => html`<mwc-list-item value="${v}"
																			?selected=${v === user.role}>${v}</mwc-list-item>`)}
				</mwc-select>
			</div>
			<div>
				<mwc-select ?disabled=${this.enabledUsername !== user.username}
							@action=${(e) => user.preferences.theme = this.dropdownValues['preferences.theme'][e.detail.index]}>
				${this.dropdownValues['preferences.theme'].map((v) => html`<mwc-list-item value="${v}"
																			?selected=${v === user.preferences.theme}>${v}</mwc-list-item>`)}
			</mwc-select>
			</div>
			${this.editionCell(user)}
		</div>
		`;
	}


	get userSection() {
		return html`
      <form class="section">
        <div class="section-header">User management</div>
        <div class="form-group">
          <div style="margin-bottom: 20px;">
            <mwc-textfield id="username" label="Username"></mwc-textfield>
            <mwc-textfield id="password" label="Password"></mwc-textfield>
            <mwc-select id="role" label="Role">
              <mwc-list-item value="admin" selected>Admin</mwc-list-item>
              <mwc-list-item value="user">User</mwc-list-item>
            </mwc-select>
            <mwc-select id="theme" label="Theme">
              <mwc-list-item value="white" selected>White</mwc-list-item>
              <mwc-list-item value="black">Black</mwc-list-item>
            </mwc-select>
            <mwc-button @click=${() => this.onAddUser()} style="vertical-align: middle;">Add</mwc-button>
          </div>
          <div id="grid">
            <div class="list-item header-table">
              <p>Username</p><p>Password</p><p>Role</p><p>Theme</p><p></p>
            </div>
            ${this.users.map(this.listitem.bind(this))}
          </div>
        </div>
      </form>`
	}

	get pageContent() {
		return html`
    <div id="project-page">
      ${this.userSection}
    </div>
    `
	}

}
customElements.define('app-user-manager', AppUserManager);
