/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import {
    UPDATE_FILTERS,
    UPDATE_PAGE,
    UPDATE_TASKS,
    UPDATE_TASK,
    UPDATE_TASK_NAME,
    UPDATE_JOB_ID,
    UPDATE_DATA_ID
} from '../actions/application';

import {
  UPDATE_WAITING
} from '../actions/requests';

const INITIAL_APP_STATE = {
    page: '',
    jobId: '',
    dataId: '',
    jobs: [],
    filters: {
      data_id: '',
      path: '',
      status: '',
      assigned: '',
      user: ''
    },
    tasks: [],
    taskName: '',
    waiting: false    
};

const application = (state = INITIAL_APP_STATE, action) => {
    switch (action.type) {
      case UPDATE_FILTERS:
        return {
          ...state,
          filters: action.filters
        };
      case UPDATE_PAGE:
        return {
          ...state,
          page: action.page
        };
      case UPDATE_TASK:
        const idx = state.tasks.findIndex((t) => t.name == action.task.name);
        if (idx >= 0) {
          state.tasks[idx] = action.task;
          return {...state};
        } else {
          return {
            ...state,
            tasks: [...state.tasks, action.task]
          };
        }
      case UPDATE_TASKS:
        return {
          ...state,
          tasks: [...action.tasks]
        };
      case UPDATE_TASK_NAME:
        return {
          ...state,
          taskName: action.taskName
        };
      case UPDATE_JOB_ID:
        return {
          ...state,
          jobId: action.jobId
        };
      case UPDATE_DATA_ID:
        return {
          ...state,
          dataId: action.dataId
        };
      case UPDATE_WAITING:
        return {
          ...state,
          waiting: action.waiting
        }
      default:
        return state;
    }
};

export default application;