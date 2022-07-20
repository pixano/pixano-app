/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { GET } from './requests';

export const SET_MEDIA_INFO = 'SET_MEDIA_INFO';
export const UPDATE_DATASETS = 'UPDATE_DATASETS';
export const UPDATE_DATASET_ID = 'UPDATE_DATASET_ID';

export const setMediaInfo = (info) => {
	return {
		type: SET_MEDIA_INFO,
		info
	};
};

export const updateDatasets = (datasets) => {
	return {
		type: UPDATE_DATASETS,
		datasets
	};
};

export const updateDatasetId = (datasetId) => {
	return {
		type: UPDATE_DATASET_ID,
		datasetId
	};
};

export const getData = (datasetId, dataId) => (dispatch) => {
	if (datasetId === undefined && dataId === undefined) {
		const media_info = { info: {} };
		return Promise.resolve(dispatch(setMediaInfo(media_info)));
	} else {
		return GET(`/api/v1/datasets/${datasetId}/data/${dataId}`)
			.then((data) => {
				const media_info = { info: data };
				return Promise.resolve(dispatch(setMediaInfo(media_info)));
			});
	}
}

/**
 * Update redux state with datsets list.
 */
export const getDatasets = () => (dispatch, getState) => {
	return GET('/api/v1/datasets').then((data) => {
		dispatch(updateDatasets(data));
		if (data.length) {
			const datasetId = getState().media.datasetId;
			if (!datasetId) {
				dispatch(updateDatasetId(data[0].id));
			}
		}
		return Promise.resolve(data);
	});
}

/**
 * Import a new dataset.
 * @param {String} path origin path
 * @param {String} name name / id associated to this new dataset
 * @param {Boolean} isURL if the destination is an URL instead of a local path
 */
 export const importDataset = (path, name, isURL) => (dispatch) => {
	if (isURL) return POST('/api/v1/datasets', { url: path, id: name }, dispatch);
	else return POST('/api/v1/datasets', { path: path, id: name }, dispatch);
}

/**************************** */

/**
 * Delete dataset.
 * @param {String} datasetId 
 */
 export const deleteDataset = (datasetId) => (dispatch, getState) => {
	return DELETE(`/api/v1/datasets/${datasetId}`, {}, dispatch).then((res) => {
		console.error("NOT IMPLEMENTED");//TODO
		let tasks = getState().media.tasks;
		tasks = tasks.filter((t) => t.name != taskName);
		const newTaskName = tasks.length ? tasks[0].name : '';
		dispatch(updateTasks(tasks));
		dispatch(updateTaskName(newTaskName));
		return Promise.resolve(tasks);
	});
}

export const fetchRangeDatas = (page, pageSize) => (dispatch, getState) => {
	console.log("fetchRangeDatas",page, pageSize);
	const datasetId = getState().media.datasetId;
	const filters = getState().application.filters;
	console.log("datasetId",datasetId);
	console.log("filters",filters);
	if (datasetId) {
		let url = `/api/v1/datasets/${datasetId}/data?page=${page}&count=${pageSize}`;
		for (const [key, value] of Object.entries(filters)) {
			if (value) {
				url += `&${key}=${value}`;
			}
		}
		return GET(url, dispatch).then((data) => {
			return Promise.resolve(data);
		}).catch((error) => {
			return Promise.reject(error);
		});
	} else {
		return Promise.reject('fetchRangeDatas: Program error');
	}
}
