/**
 * User-related actions.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { navigate, getTasks } from './application';
import { GET, POST, PUT, DELETE } from './requests';

export const LOGIN_USER = 'LOGIN_USER';
export const LOGOUT_USER = 'LOGOUT_USER';
export const UPDATE_USERS = 'UPDATE_USERS';

export const loginUser = (userObj) => {
	return {
		type: 'LOGIN_USER',
		payload: userObj
	}
}

export const logoutUser = () => {
	return {
		type: 'LOGOUT_USER'
	}
}

export const updateUsers = (users) => {
	return {
		type: 'UPDATE_USERS',
		users
	}
}

export const logout = () => (dispatch) => {
	dispatch(logoutUser());
	dispatch(navigate('/#login'));
	GET('/api/v1/logout')
}

export const loginRequest = (username, password) => (dispatch) => {
	return POST('/api/v1/login', { "password": password, "username": username })
		.then((res) => {
			return dispatch(getTasks()).then(() => {
				dispatch(loginUser(res.user));
				return Promise.resolve();
			});
		});
}

export const getProfile = () => (dispatch) => {
	return new Promise((resolve, reject) => {
		return GET("/api/v1/profile")
			.then(res => {
				dispatch(loginUser(res));
				resolve()
			}).catch(() => {
				reject("not found...");
			})
	});
}

export const getUsers = () => (dispatch) => {
	return GET('/api/v1/users')
		.then((res) => {
			dispatch(updateUsers(res))
		});
}

export const deleteUser = (userId) => (dispatch) => {
	return DELETE(`/api/v1/users/${userId}`)
		.then(() => {
			return dispatch(getUsers());
		});
}

export const updateUser = (user) => (dispatch) => {
	return PUT(`/api/v1/users/${user.username}`, user)
		.then(() => {
			dispatch(getUsers());
		});
}

export const signup = (value) => (dispatch) => {
	return POST('/api/v1/users', value).then(() => {
		return dispatch(getUsers());
	});
}
