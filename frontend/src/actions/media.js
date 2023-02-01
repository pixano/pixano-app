/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { GET, POST, DELETE } from './requests';

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
export const getDatasets = () => (dispatch) => {
	return GET('/api/v1/datasets').then((data) => {
		dispatch(updateDatasets(data));
		return Promise.resolve(data);
	});
}

/**
 * Import a new dataset.
 * @param {String} path origin path
 * @param {String} name name / id associated to this new dataset
 * @param {String} data_type type of data
 * @param {Boolean} isURL if the destination is an URL instead of a local path
 */
export const importDataset = (path, name, data_type, isURL) => (dispatch) => {
	if (isURL) return POST('/api/v1/datasets', { url: path, id: name, data_type: data_type }, dispatch);
	else return POST('/api/v1/datasets', { path: path, id: name, data_type: data_type }, dispatch);
}

/**
 * Create dataset from selection.
 * @param {String} name name / id associated to this new dataset
 * @param {String} refDatasetId name / id of the reference dataset
 * @param {String} data_ids list of selected ids that will be used to create this new sub-dataset
 */
export const createDatasetFrom = (name, refDatasetId, data_ids) => (dispatch) => {
	return POST(`/api/v1/datasets/${name}/from`, { ref_dataset_id: refDatasetId, data_ids: data_ids }, dispatch);
}

/**
 * Import dataset from kafka.
 */
export const importFromKafka = () => (dispatch) => {
	console.log("importFromKafka");
	return GET('/api/v1/datasets/import_from_kafka', dispatch);
}

/**
 * get project list from Data Provider (Confiance).
 */
export const projsFromDP = () => (dispatch) => {	
	//console.log("projsFromDP");
	return GET('/api/v1/dataprovider/projects_from_dataprovider', dispatch);
}

/**
 * get selection list from Data Provider (Confiance).
 */
export const selectionsFromDP = (project_name) => (dispatch) => {	
	//console.log("selectionsFromDP", project_name);
	return GET('/api/v1/dataprovider/selections_from_dataprovider/'+project_name, dispatch);
}

/**
 * get id list from Data Provider (Confiance).
 */
export const id_listFromDP = (project_name, sel_id) => (dispatch) => {	
	//console.log("id_listFromDP", project_name, sel_id);
	return GET('/api/v1/dataprovider/id_list_from_dataprovider/'+project_name+'/'+sel_id, dispatch);
}

/**
 * get Minio uris from Data Provider (Confiance).
 */
export const minio_urisFromDP = (project_name, ids) => (dispatch) => {	
	//console.log("minio_urisFromDP", project_name, ids);
	return POST('/api/v1/dataprovider/minio_uris_from_dataprovider/'+project_name, ids, dispatch);
}


/**************************** */

/**
 * Delete a dataset.
 * @param {String} datasetId 
 */
export const deleteDataset = (datasetId) => (dispatch, getState) => {
	return DELETE(`/api/v1/datasets/${datasetId}`, {}, dispatch).then(() => {
		const datasets = dispatch(getDatasets());
		return Promise.resolve(datasets);
	});
}

export const fetchRangeDatas = (page, pageSize) => (dispatch, getState) => {
	const datasetId = getState().media.datasetId;
	const filters = getState().application.filters;
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
		return Promise.reject('fetchRangeDatas: no datasetId defined');
	}
}
