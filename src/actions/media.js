/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { GET } from './requests';

export const SET_MEDIA_INFO = 'SET_MEDIA_INFO';

export const setMediaInfo = (info) => {
    return {
      type: SET_MEDIA_INFO,
      info
    };
};

export const getData = (datasetId, dataId) => (dispatch) => {
  if(datasetId == undefined && dataId == undefined){
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