/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import {
	SET_MEDIA_INFO,
	UPDATE_DATASETS,
	UPDATE_DATASET_ID
} from '../actions/media';

const INITIAL_MEDIA_STATE = {
	info: {},
	datasets: [],
	datasetId: ''
};

const media = (state = INITIAL_MEDIA_STATE, action) => {
	switch (action.type) {
		case SET_MEDIA_INFO:
			return { ...action.info }
		case UPDATE_DATASETS:
			return {
				...state,
				datasets: [...action.datasets]
			};
		case UPDATE_DATASET_ID:
			return {
				...state,
				datasetId: action.datasetId
			};
		default:
			return state
	}
};

export default media;