/**
 * General application-related actions.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { GET, POST, PUT, DELETE } from './requests';
import { getData } from './media';
import { getLabels } from './annotations';

export const UPDATE_FILTERS = 'UPDATE_FILTERS';
export const UPDATE_LABEL_TYPE = 'UPDATE_LABEL_TYPE';
export const UPDATE_PAGE = 'UPDATE_PAGE';
export const UPDATE_TASK = 'UPDATE_TASK';
export const UPDATE_TASKS = 'UPDATE_TASKS';
export const UPDATE_TASK_NAME = 'UPDATE_TASK_NAME';
export const UPDATE_JOB_ID = 'UPDATE_JOB_ID';
export const UPDATE_DATA_ID = 'UPDATE_DATA_ID';



export const updateFilters = filters => {
    return {
        type: UPDATE_FILTERS,
        filters
    };
};

export const updatePage = (page) => {
    return {
        type: UPDATE_PAGE,
        page
    };
};

export const updateTask = (task) => {
    return {
        type: UPDATE_TASK,
        task
    };    
}

export const updateTasks = (tasks) => {
    return {
        type: UPDATE_TASKS,
        tasks
    };
};

export const updateTaskName = (taskName) => {
    return {
        type: UPDATE_TASK_NAME,
        taskName
    };
};

export const updateJobId = (jobId = '') => {
    return {
        type: UPDATE_JOB_ID,
        jobId
    };
};

export const updateDataId = (dataId = '') => {
    return {
        type: UPDATE_DATA_ID,
        dataId
    };
}

/**
 * Navigate to path
 * @param {String} path e.g. /#login
 */
export const navigate = (path) => (dispatch, getState) => {
    // Extract the page name from path.
    // remove slash + hashtag + take root element
    const role = getState().user.currentUser.role || '';
    if (path === '/') {
        if (role === 'admin') {
            path = '/#dashboard-admin';
        } else if (role === 'user') {
            path = '/#dashboard-user';
        } else {
            path = '/#login';
        }
    }
    const page = path.slice(2).split('/')[0];
    switch(page) {
      case 'login':
          import('../views/app-login.js').then(() => {
          })
          break;
      case 'dashboard-user':
        import('../views/app-dashboard-user.js').then(() => {
        })
        break;
      case 'dashboard-admin':
        import('../views/app-dashboard-admin.js').then(() => {
        })
        break;
      case 'project-manager':
        import('../views/app-project-manager.js').then(() => {
        })
        break;
    case 'user-manager':
        import('../views/app-user-manager.js').then(() => {
        })
        break;
      case 'label':
        import('../views/app-label.js').then(() => {
        })
        break;
      case 'explore':
        import('../views/app-explore.js').then(() => {
        })
        break;
      default:
        page = 'view404';
        import('../views/app-404.js');
    }
    dispatch(updatePage(page));
};

export const fetchRangeResults = (page, pageSize) => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    const filters = getState().application.filters;
    if(taskName) {
        let url = `/api/v1/tasks/${taskName}/results?page=${page}&count=${pageSize}`;
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
        return Promise.reject('Program error');
    }
}

/**
 * Update redux state (data, labels) from a given result.
 * @param {Object} result 
 */
const updateResult = (result) => (dispatch, getState) => {
    const dataId = result.data_id || '';
    dispatch(updateDataId(dataId));            
    dispatch(updateJobId());            
    const appState = getState().application;
    const taskName = appState.taskName;
    const currentTask = appState.tasks.find(t => t.name === taskName);          
    const promises = [];
    promises.push(dispatch(getData(currentTask.dataset.id, dataId)));
    promises.push(dispatch(getLabels(taskName, dataId)));
    return Promise.all(promises);
}

/**
 * Fetch result for a given task and data.
 * @param {String} dataId 
 */
export const fetchResult = (dataId) => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    if(taskName && dataId) {
        return GET(`/api/v1/tasks/${taskName}/results/${dataId}`).then((result) => {
            return dispatch(updateResult(result));
        });
    } else {
        return Promise.resolve('failure');
    }
}

const _fetchNextResult = (forward=true) => (dispatch, getState) => {
    const appState = getState().application;
    const taskName = appState.taskName;
    const dataId = appState.dataId;
    const filters = appState.filters
    if(taskName && dataId) {
        const direction = forward ? 'next' : 'previous';
        let url = `/api/v1/tasks/${taskName}/results/${dataId}/${direction}`;
        url += Object.keys(filters).length ? '?' : '';
        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                url += `&${key}=${value}`;
            }
        }
        return GET(url, dispatch).then((result) => {
            if (result.data_id) {
                return dispatch(updateResult(result));
            }
        });
    } else {
        return Promise.resolve('failure');
    }
}

export const fetchBackwardResult = () => (dispatch) => {
    return dispatch(_fetchNextResult(false));
}

export const fetchForwardResult = () => (dispatch) => {
    return dispatch(_fetchNextResult(true));
}

/**
 * Update redux state (data, labels) from a given job.
 * @param {Object} job 
 */
const updateJob = (job) => (dispatch, getState) => {
    if(job.id) {
        dispatch(updateDataId());
        dispatch(updateJobId(job.id));            
        const appState = getState().application;
        const taskName = appState.taskName
        const currentTask = appState.tasks.find(t => t.name === taskName)            
        const promises = [];
        promises.push(dispatch(getData(currentTask.dataset.id, job.data_id)));
        promises.push(dispatch(getLabels(taskName, job.data_id)));
        return Promise.all(promises);            
    } else {
        dispatch(updateDataId());
        dispatch(updateJobId());
        dispatch(getData());
        dispatch(getLabels());
        return Promise.reject('No more job');
    }            
}

/**
 * Fetch a random image to annotate
 * @param {String} taskName 
 */
export const fetchNewJob = (jobObjective) => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    if(taskName) {
        return GET(`/api/v1/tasks/${taskName}/jobs/next?objective=${jobObjective}`, dispatch).then((job) => {
            return dispatch(updateJob(job)).then(() => {
                return Promise.resolve(job);
            });
        });
    } else {
        return Promise.reject('Program error');
    }
}

/**
 * Update job status.
 * @param {String} jobId 
 * @param {String} status 
 */
export const putJob = (status) => (dispatch, getState) => {
    const body = status ? {status} : {};
    const taskName = getState().application.taskName;
    const jobId = getState().application.jobId;
    if(taskName && jobId) {
        return PUT(`/api/v1/tasks/${taskName}/jobs/${jobId}`, body);            
    } else {
        return Promise.reject({message: `Job ${jobId} is dead.`});
    }
}

/**
 * Pause job when quitting page or window.
 */
export const interruptJob = () => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    const jobId = getState().application.jobId;
    if(taskName && jobId) {
        return PUT(`/api/v1/tasks/${taskName}/jobs/${jobId}`, {interrupt: true}).then((res) => {
            return Promise.resolve(res);
        });
    } else {
        return Promise.resolve('failure')
    }
}

/**
 * Update status for given data ids.
 * @param {String[]} dataIdList 
 * @param {String} new_status 
 */
export const putResultStatus = (dataIdList, new_status) => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    if(taskName) {
        return PUT(`/api/v1/tasks/${taskName}/results/`, {data_ids: dataIdList, status: new_status}).then((res) => {
            return Promise.resolve(res);
        });
    } else {
        return Promise.resolve('failure')
    }
}

/**
 * De-allocate given data ids.
 * @param {String[]} dataIdList 
 * @param {String} new_status 
 */
export const resetResultStatus = (dataIdList) => (dispatch, getState) => {
    const taskName = getState().application.taskName;
    if(taskName) {
        return PUT(`/api/v1/tasks/${taskName}/results/`, {data_ids: dataIdList}).then((res) => {
            return Promise.resolve(res);
        });
    } else {
        return Promise.resolve('failure')
    }
}

/**
 * Update redux state with tasks list.
 */
export const getTasks = () => (dispatch, getState) => {
    return GET('/api/v1/tasks').then((data) => {
        dispatch(updateTasks(data));
        if (data.length) {
            const taskName = getState().application.taskName;
            if (!taskName) {
                dispatch(updateTaskName(data[0].name));
            }
        }
        return Promise.resolve(); 
    });
}

/**
 * Snapshot current state of the database.
 */
export const snapshotProject = () => {
    return POST('/api/v1/project/snapshot').then(() => {
        return Promise.resolve();
    });
}

/**
 * Export all database annotations.
 * @param {String} path destination path
 */
export const exportTasks = (path) => (dispatch) => {
    return POST('/api/v1/tasks/export', {path}); 
}

/**
 * Import file annotations to database.
 * @param {String} path origin path
 */
export const importTasks = (path) => (dispatch) => {
    return POST('/api/v1/tasks/import', {path}, dispatch);
}

/**
 * Update a dataset.
 * @param {Object} config 
 */
export const putDataset = (config) => (dispatch) => {
    return POST('/api/v1/datasets', config).then((data) => {
        if (data) {
            dispatch(updateInputPath(data['path']));
            return Promise.resolve('success');
        } else {
            return Promise.resolve('failure');
        }
    });
}

/**
 * Post new task.
 * @param {Object} task 
 */
export const postTask = (task) => (dispatch) => {
    return POST('/api/v1/tasks', task, dispatch).then((newTask) => {
        // use the newly created task as the new redux selected task
        dispatch(updateTask(newTask));
        dispatch(updateTaskName(newTask.name));
        return Promise.resolve(newTask);
    });
}

/**
 * Update task details.
 * @param {Object} task 
 */
export const putTask = (task) => (dispatch) => {
    return PUT(`/api/v1/tasks/${task.name}`, task).then(() => {
        dispatch(updateTask(task));
        dispatch(updateTaskName(task.name));
        return Promise.resolve(task);
    });
}

/**
 * Delete task and associated labels.
 * @param {String} taskName 
 */
export const deleteTask = (taskName) => (dispatch, getState) => {
    return DELETE(`/api/v1/tasks/${taskName}`, {}, dispatch).then((res) => {
        let tasks = getState().application.tasks;
        tasks = tasks.filter((t) => t.name != taskName);
        const newTaskName = tasks.length ? tasks[0].name : '';
        dispatch(updateTasks(tasks));
        dispatch(updateTaskName(newTaskName));
        return Promise.resolve(tasks);
    });
}

