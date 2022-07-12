/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import {
	SET_MEDIA_INFO
} from '../actions/media';

const INITIAL_MEDIA_STATE = {
	info: {}
};

const media = (state = INITIAL_MEDIA_STATE, action) => {
	switch (action.type) {
		case SET_MEDIA_INFO:
			return { ...action.info }
		default:
			return state
	}
};

export default media;