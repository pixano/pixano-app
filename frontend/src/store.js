/**
 * Storage entrypoint for the data we want persistent across all pages.
 * Stored object: {
 *  annotations: any,
 *  media: { info: {id: string, dataset_id: string, type: string, path: string}},
 *  application: { page: string, jobId: string, dataId: string, jobs: [], filters: {}, tasks: [], taskName: string},
 *  user: { currentUser: {username: string, role: string}, users: []}
 * }
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import {
	createStore,
	compose,
	applyMiddleware,
	combineReducers
} from 'redux';
import thunk from 'redux-thunk';
import { lazyReducerEnhancer } from 'pwa-helpers/lazy-reducer-enhancer';
import { staticReducers } from './reducers/reducer';

// Sets up a Chrome extension for time travel debugging.
// See https://github.com/zalmoxisus/redux-devtools-extension for more information.
const devCompose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

export const getState = (substate = '') => {
	if (substate === '') {
		return store.getState()
	} else {
		const labels = store.getState()[substate]
		if (labels.present !== undefined) {
			return labels.present
		} else {
			return labels
		}
	}
}

export const getAnnotations = () => {
	return JSON.parse(JSON.stringify(getState('annotations')));
}

export const getApplication = () => {
	return getState('application');
}

export const store = createStore(combineReducers(staticReducers),
	devCompose(
		lazyReducerEnhancer(combineReducers),
		applyMiddleware(thunk))
);