/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import undoable, {excludeAction, includeAction } from 'redux-undo';
import {
    INIT_ANNOTATIONS,
    SET_ANNOTATIONS
  } from '../actions/annotations';

const _annotations = (state = {}, action = {}) => {
  switch (action.type) {
    case INIT_ANNOTATIONS:
    case SET_ANNOTATIONS:
      return {...state, ...JSON.parse(JSON.stringify(action.annotations))};
    default:
      return state
  }
};

const annotations = undoable(_annotations, {
    limit: 10, // set a limit for the history
    filter: includeAction([SET_ANNOTATIONS])
  });

export default annotations;