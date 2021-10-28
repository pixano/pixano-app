/**
 * Annotation-related actions.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { ActionCreators } from 'redux-undo';
import { GET, PUT } from './requests';

export const SET_ANNOTATIONS = 'SET_ANNOTATIONS';
export const CREATE_ANNOTATION = 'CREATE_ANNOTATION';
export const UPDATE_ANNOTATION = 'UPDATE_ANNOTATION';
export const DELETE_ANNOTATION = 'DELETE_ANNOTATION';
export const CLEAR_HISTORY = 'CLEAR_HISTORY';
export const INIT_ANNOTATIONS = 'INIT_ANNOTATIONS';

/**
 * Reset annotations (undoable).
 * Given object must be a dictionnary which content
 * will be spread to current state.
 * @param {any} annotations 
 */
export const setAnnotations = (annotations) => {
    return {
        type: SET_ANNOTATIONS,
        annotations
    };
};

/**
 * Same as setAnnotations but not undoable
 * @param {*} annotations 
 */
export const initAnnotations = (annotations) => {
    return {
        type: INIT_ANNOTATIONS,
        annotations
    };
};

export const undo = () => (dispatch) => {
    dispatch(ActionCreators.undo()) // undo the last action
}
  
export const redo = () => (dispatch) => {
    dispatch(ActionCreators.redo()) // undo the last action
}

export const clearHistory = () => (dispatch) => {
    dispatch(ActionCreators.clearHistory()) // undo the last action
}

/**
 * Return promise with labels for given task and data.
 * @param {String} taskName 
 * @param {String} dataId 
 */
export const getLabels = (taskName, dataId) => (dispatch, getState) => {
    if(taskName == undefined && dataId == undefined){
        const ret = dispatch(initAnnotations({}))
        dispatch(clearHistory());
        return Promise.resolve(ret);
    } else {
        return GET(`/api/v1/tasks/${taskName}/labels/${dataId}`)
            .then((labels = {}) => {
                // { annotations: any, data_id: string, task_name: string}
                // apart from data_id and task_name, the rest of the object is of any format:
                // ex.1: { annotations: [], tags: {}, classification: []}
                // ex.2: { annotations: { detections: [], tracks: {}}}
                const { data_id, task_name, ...content } = labels;
                const ret = dispatch(initAnnotations(content))
                dispatch(clearHistory());
                return Promise.resolve(ret);        
            });
    }
}

/**
 * Send current labels to server.
 */
export const putLabels = () => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    const annotations = getState().annotations.present;
    const dataId = getState().media.info.id;
    const labels = {
        task_name: taskName,
        data_id: dataId,
        ...annotations
    };
    return PUT(`/api/v1/tasks/${taskName}/labels/${dataId}`, labels);
}
