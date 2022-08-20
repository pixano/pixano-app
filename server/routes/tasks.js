const path = require('path');
const cliProgress = require('cli-progress');
const storage = require('../config/storage-bucket');
const db = require('../config/db-firestore');
const dbkeys = require('../config/db-keys');
const batchManager = require('../helpers/batch-manager');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');
const { getOrcreateSpec } = require('./specs');
const { getOrcreateDataset } = require('./datasets');
const { createJob } = require('./jobs');
const { getAllDataFromDataset,
        getAllPathsFromDataset,
        getDataDetails } = require('./datasets');

const annotation_format_version = "0.9";

/**
 * @api {get} /tasks Get list of tasks details
 * @apiName GetTasks
 * @apiGroup Tasks
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [{
 *        "name": "my_task",
 *        "dataset": DbDataset,
 *        "spec": DbSpec
 *     }]: RestTask[]
 */
async function get_tasks(_, res) {
    const tasks = await getAllTasksDetails();
    res.send(tasks);
}

/**
 * @api {post} /tasks Add new task
 * @apiName PostTasks
 * @apiGroup Tasks
 * @apiPermission admin
 * 
 * @apiParam {RestTask} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Task already existing
 */
async function post_tasks(req, res) {
    checkAdmin(req, async () => {
        const task = req.body;
        const spec = await getOrcreateSpec(task.spec);
        const dataset = await getOrcreateDataset({...task.dataset, data_type: spec.data_type}, workspace);

        try {
            await db.get(dbkeys.keyForTask(task.name));
            return res.status(400).json({message: 'Taskname already existing'});
        } catch(e) {}
        
        // Task does not exist create it
        const newTask = {name: task.name, dataset_id: dataset.id, spec_id: spec.id}
        await db.put(dbkeys.keyForTask(newTask.name), newTask);
        
        // Generate first job list
        await generateJobResultAndLabelsLists(newTask);

        const taskDetail = await getTaskDetails(newTask.name);
        console.log('Task created', taskDetail.name)
        res.status(201).json(taskDetail);
    });
}


/**
 * @api {post} /tasks/import Import annotation task from json files
 * @apiName PostImportTasks
 * @apiGroup Tasks
 * @apiPermission admin
 * 
 * @apiParam {string} [path] Relative path to tasks folder
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Import error
 *     HTTP/1.1 401 Unauthorized
 */
async function import_tasks(req, res) {
    checkAdmin(req, async () => {
		if (req.body.url) {
			return res.status(400).json({
				error: 'url_not_implemented',
				message: 'Import tasks from URL is not yet implemented.'
			});
		}
        if (!req.body.path) {
            return res.status(400).json({
                error: 'wrong_path',
                message: 'Invalid path.'
            });
        }
        let taskFiles = {};
        try {
            taskFiles = await storage.parseImportFolder(req.body.path);
        } catch(err) {
            console.log('error import')
            return res.status(400).json({
                error: 'wrong_folder',
                message: 'Import folder does not exist: ' + req.body.path
            });
        }
        
        // Create tasks  
        // Format of task file:
        // {
        //  name: string
        //  spec: { plugin_name: string, label_schema: {} },
        //  dataset: { path: string, data_type: string }
        // }
        const importedTasks = [];
        const bm = new batchManager.BatchManager(db);
        for await (const [taskFile, annFiles] of Object.entries(taskFiles)) {
            const taskData = await storage.readJson(taskFile);

            const dataset = await getOrcreateDataset({...taskData.dataset, data_type: taskData.spec.data_type}, workspace);
            const spec = await getOrcreateSpec(taskData.spec);

            let newTaskName = taskData.name;
            try {
                // check if task already exist and search for another name
                let cpt = 1;
                do {
                    const task = await db.get(dbkeys.keyForTask(newTaskName));
                    newTaskName = `${task.name}-${cpt}`;
                    cpt += 1;
                } while (true)
            } catch (err) {
                // task with this updated name does not exist, use this name
                taskData.name = newTaskName;
            }
            // Create it
            const newTask = {name: taskData.name, dataset_id: dataset.id, spec_id: spec.id};
            await bm.add({ type: 'post', key: dbkeys.keyForTask(newTask.name), value: newTask})

            // Generate first job list
            await generateJobResultAndLabelsLists(newTask); 
            const dataMap = await getAllPathsFromDataset(newTask.dataset_id);
            
            // Read corresponding task folder
            // Format of annotation file:
            // { 
            //    annotations: any[],
            //    data: { type: string, path: string | string[], children: array<{path, timestamp}>}
            // }
            console.log('Now importing the labels', annFiles.length)
            for await (const jsonFile of annFiles) {
                // Create data
                const ann = await storage.readJson(jsonFile);
                let sourcePath;
                if (ann.data.path) {
                    const p = Array.isArray(ann.data.path) ? ann.data.path[0] : ann.data.path;
                    sourcePath = utils.toNormalizedPath(p);
                } else {
                    try {
                        // try to get first children image if path is not available
                        const children = ann.data.url || ann.data.children;
                        let firstItemPath = children[0].path || children[0].url;
                        firstItemPath = Array.isArray(firstItemPath) ? firstItemPath[0] : firstItemPath;
                        sourcePath = utils.toNormalizedPath(path.dirname(firstItemPath));
                    } catch(err) {
                        console.warn('Should be: { annotations: any[], data: { type: string, path: string | string[], children: array<{path, timestamp}>} ')
                    }
                }
                // get data id from data path
                const dataId = dataMap[sourcePath];
                if (!dataId) {
                    console.warn(`Unknown path ${sourcePath}`);
                    importedTasks.forEach(remove_task);
                    return res.status(400).json({
                        error: 'wrong_url',
                        message: `Invalid data url in imported file.
                                Please check consistency of "${fullPath}"
                                Task importation aborted and cancelled at '${newTask.name}' task.
                                If you do not wish to load ${newTask.name}, please prefix ${taskFile},
                                with '_' so it can be ignored. Cancelling import.`
                    });
                }
            
                // Create Labels
                const newLabels = {
                    task_name: newTask.name,
                    data_id: dataId, 
                    annotations: ann.annotations
                };

                await bm.add({ type: 'put', key: dbkeys.keyForLabels(newTask.name, newLabels.data_id), value: newLabels});
				if (ann.data.status) {//if existing, get status back
					resultData = await db.get(dbkeys.keyForResult(newTask.name, newLabels.data_id));//get the status for this data
					resultData.status = ann.data.status;//add the status
					await bm.add({ type: 'put', key: dbkeys.keyForResult(newTask.name, newLabels.data_id), value: resultData});
				}

                // Mark result as done
                // const resultData = await db.get(dbkeys.keyForResult(newTask.name, dataId));
                // if(resultData.current_job_id) {
                //     await bm.add({ type: 'del', key: dbkeys.keyForJob(newTask.name, resultData.current_job_id)})
                // }
                // resultData.current_job_id = '';
                // resultData.status = 'done';
                // await bm.add({ type: 'put', key: dbkeys.keyForResult(newTask.name, dataId), value: resultData});

            }
            await bm.flush();
            importedTasks.push(newTaskName);
        }
        console.log('Import done.');
        res.sendStatus(200);
    });
}


/**
 * @api {post} /tasks/export Export annotations to json format
 * @apiName PostExportTasks
 * @apiGroup Tasks
 * @apiPermission admin
 * 
 * @apiParam {string} [path] Relative path to tasks folder OR [url] destination URL for online export
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Failed to create export folder
 */
async function export_tasks(req, res) {
	checkAdmin(req, async () => {
		if (!req.body.path && !req.body.url) {
			return res.status(400).json({
				error: 'wrong_path',
				message: 'Invalid path.'
			});
		}
		const exportPath = req.body.path;
		const streamTask = db.stream(dbkeys.keyForTask(), false, true);
		for await (const it of streamTask) {
			const task = it.value;
			const spec = await db.get(dbkeys.keyForSpec(task.spec_id));
			delete spec.id;
			const dataset = await db.get(dbkeys.keyForDataset(task.dataset_id));
			const datasetId = dataset.id;
			delete dataset.id;
			const taskJson = {name: task.name, spec, dataset};
			// Write task json
			const err = storage.writeJSON(taskJson, `${exportPath}/${task.name}.json`);
			if (err) {
				return;
			}
			
			// Write annotations for each task in a specific folder
			const taskFolder = `${exportPath}/${task.name}`;

			// Write annotations
			const streamLabels = db.stream(dbkeys.keyForLabels(task.name), false, true);
			for await (const {value} of streamLabels) {
				const data = await getDataDetails(datasetId, value.data_id, true);
				delete data.id;
				delete data.dataset_id;
				delete data.thumbnail;
				data.status = resultData.status;//add the status
				let path = data.path;
				path = Array.isArray(path) ? path[0] : path;
				path = path.replace(dataset.path, '')
				const filename = utils.pathToFilename(path);

				const labelsJson = {...value, data};
				delete labelsJson.data_id;
				const err = storage.writeJSON(labelsJson, `${taskFolder}/${filename}.json`);
				if (err) {
					return;
				}
			}
		}
		res.send();
	});
}

/**
 * @api {put} /tasks/:task_name Update task details (for now : only task details can be changed, the name, dataset and annotation type have to remain the same)
 * @apiName PutTask
 * @apiGroup Tasks
 * @apiPermission admin
 * 
 * @apiParam {RestTask} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Unknown task
 */
async function put_task(req, res) {
    checkAdmin(req, async () => {
        const task = req.body;
        //Invalid request ids
        if (req.params.task_name !== task.name) {
        return res.status(400).json({
            type: 'bad_name',
            message: 'Corruption in id '+req.params.task_name+' '+task.name
        });
        }

        try {
            const oldTask = await db.get(dbkeys.keyForTask(req.params.task_name));
            const oldSpec = await db.get(dbkeys.keyForSpec(oldTask.spec_id));
            const newSpec = {...oldSpec, ...task.spec};
            await db.put(dbkeys.keyForSpec(newSpec.id), newSpec);
            res.status(201).json({});
        } catch (err) {
            return res.status(400).json({
                type: 'unknown',
                message: 'Unknown task or spec '+req.params.task_name+' '+oldTask.spec_id
            });
        }
    });
}

/**
 * @api {get} /task/:task_name Get task details
 * @apiName GetTask
 * @apiGroup Tasks
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "name": "my_task",
 *       "spec_id": "feffezf",
 *       "dataset_id": "dezge"
 *     }: DbTask
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function get_task(req, res) {
    try {
        const taskData = await db.get(dbkeys.keyForTask(req.params.task_name));
        res.send(taskData);
    } catch (err) {
            res.status(400).json({
            message: 'Unknown task '+req.params.task_name
        });
    }    
}


/**
 * @api {delete} /tasks/:task_name Delete task
 * @apiName DeleteTask
 * @apiGroup Tasks
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 */
function delete_task(req, res) {
    checkAdmin(req, async () => {
        const taskName = req.params.task_name;
        await remove_task(taskName);
        return res.status(204).json({});
    });
}


///// Utils

/**
 * Get all tasks details.
 * @param {Level} db 
 */
const getAllTasksDetails = async () => {
    let tasks = [];
    const stream = db.stream(dbkeys.keyForTask(), false, true);
    for await (const {value} of stream) {
        const spec = await db.get(dbkeys.keyForSpec(value.spec_id));
        const dataset = await db.get(dbkeys.keyForDataset(value.dataset_id));
        const taskDetail = {name: value.name, dataset, spec}
        tasks.push(taskDetail);
    }
    return tasks;
}

/**
 * Get task detail for a given task name (unique).
 * @param {Level} db 
 * @param {String} taskName 
 */
const getTaskDetails = async (taskName) => {
    try {
      const taskData = await db.get(dbkeys.keyForTask(taskName));
      const spec = await db.get(dbkeys.keyForSpec(taskData.spec_id));
      const dataset = await db.get(dbkeys.keyForDataset(taskData.dataset_id));
      const taskDetail = {name: taskName, dataset, spec};
      return taskDetail;
    } catch (err) {
      console.warn('Error while searching task detail', err)
      return {};
    }
}


/**
 * Generate jobs and results for a given task.
 * @param {Level} db 
 * @param {Object} task 
 */
async function generateJobResultAndLabelsLists(task) {
    const dataIdList = await getAllDataFromDataset(task.dataset_id);
    const bm = new batchManager.BatchManager(db);
    const bar = new cliProgress.SingleBar({
        format: 'Jobs creation | {bar} | {percentage}% || {value}/{total} jobs'
    });
    bar.start(dataIdList.length, 0);
    for await (const dataId of dataIdList) {
        // Generate first elementary job
        const newJob = createJob(task.name, dataId, 'to_annotate');

        // Get data path
        const dataData = await db.get(dbkeys.keyForData(task.dataset_id, dataId));
        const path = storage.toRelativePath(dataData.path);
        // Generate result associated with each data
        const newResult = createResult(task.name, dataId, newJob.id, 'to_annotate', path);

        // Generate empty labels associated with each data
        const newLabels = {
            task_name: task.name,
            data_id: dataId,
            annotations: []
        };

        await bm.add({ type: 'post', key: dbkeys.keyForJob(task.name, newJob.id), value: newJob});
        await bm.add({ type: 'post', key: dbkeys.keyForResult(task.name, newResult.data_id), value: newResult});
        await bm.add({ type: 'post', key: dbkeys.keyForLabels(task.name, newLabels.data_id), value: newLabels});
        bar.increment();
    }
    bar.stop();
    await bm.flush();
}

/**
 * Create result item for a given dataId and jobId with status
 * @param {string} taskName 
 * @param {string} dataId 
 * @param {string} currJobId 
 * @param {string} currStatus 
 */
function createResult(taskName, dataId, currJobId, currStatus, path) {
    return {
        task_name: taskName,
        data_id: dataId, 
        finished_job_ids: [],
        current_job_id: currJobId,
        status: currStatus,
        in_progress: false,
        cumulated_time: 0,
        annotator: '',
        validator: '',
        path
    };
}

async function remove_task(taskName) {
    // delete task
    const key = dbkeys.keyForTask(taskName);
    const taskData = await db.get(key);
    const bm = new batchManager.BatchManager(db);
    await bm.add({ type: 'del', key});
    
    // delete associated jobs
    const streamJob = db.stream(dbkeys.keyForJob(taskName), false, true);
    for await (const {value} of streamJob) {
        await bm.add({ type: 'del', key: dbkeys.keyForJob(taskName, value.id)});
    }
    
    // delete associated result
    const streamResults = db.stream(dbkeys.keyForResult(taskName), false, true);
    for await (const {value} of streamResults) {
        await bm.add({ type: 'del', key: dbkeys.keyForResult(taskName, value.data_id)});
    }
    
    // delete associated labels WARNING !!!!
    const streamLabels = db.stream(dbkeys.keyForLabels(taskName), false, true);
    for await (const {value} of streamLabels) {
        await bm.add({ type: 'del', key: dbkeys.keyForLabels(taskName, value.data_id)});
    }

    // delete associated user information
    const streamUsers = db.stream(dbkeys.keyForUser(), false, true);
    for await (const {value} of streamUsers) {
        ['to_annotate', 'to_validate', 'to_correct'].forEach((obj) => {
            // Delete assigned or queued jobs
            delete value.curr_assigned_jobs[taskName+'/'+obj];
            delete value.queue[taskName+'/'+obj];
        });
        await bm.add({ type: 'put', key: dbkeys.keyForUser(value.username), value: value})
    }

    // [temporary] if associated dataset is no longer associated
    // to any other task, remove it as well
    let foundAssociation = false;
    const stream = db.stream(dbkeys.keyForTask(), false, true);
    for await (const {value} of stream) {
        if (value.name != taskData.name && value.dataset_id == taskData.dataset_id) {
            foundAssociation = true;
            break; 
        }
    }
    if (!foundAssociation) {
        await bm.add({ type: 'del', key: dbkeys.keyForDataset(taskData.dataset_id)});
        const stream = db.stream(dbkeys.keyForData(taskData.dataset_id), true, false);
        for await(const v of stream) {
            await bm.add({ type: 'del', key: dbkeys.keyForData(taskData.dataset_id, v.key)});
        }
    }
    await bm.flush();
}

module.exports = {
    get_tasks,
    post_tasks,
    get_task,
    put_task,
    delete_task,
    import_tasks,
    export_tasks,
    getAllTasksDetails
}
