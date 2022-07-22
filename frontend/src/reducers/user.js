/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LOGIN_USER, LOGOUT_USER, UPDATE_USERS } from '../actions/user';

const USER_INITIAL_STATE = {
	currentUser: {
		username: "",
		role: "",
		theme: ""
	},
	users: []
};

const user = (state = USER_INITIAL_STATE, action) => {
	switch (action.type) {
		case LOGIN_USER:
			return { ...state, currentUser: action.payload }
		case LOGOUT_USER:
			return USER_INITIAL_STATE;
		case UPDATE_USERS:
			return { ...state, users: action.users }
		default:
			return state;
	}
};

export default user;