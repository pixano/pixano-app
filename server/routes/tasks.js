const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const { db,
    workspace } = require('../config/db');
const dbkeys = require('../config/db-keys');
const batchManager = require('../helpers/batch-manager');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');
const { getOrcreateSpec } = require('./specs');
const { getOrcreateDataset } = require('./datasets');
const { createJob } = require('./jobs');
const populator = require('../helpers/data-populator');
const { getAllDataFromDataset,
        getAllPathsFromDataset,
        getDataDetails } = require('./datasets');

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
        if (!req.body.path) {
            return res.status(400).json({
                error: 'wrong_path',
                message: 'Invalid path.'
            });
        }
        const importPath = path.join(workspace, req.body.path);
        console.log('##### Importing from ', importPath);
        if(!utils.isSubFolder(workspace, importPath)) {
            return res.status(400).json({
                error: 'wrong_folder',
                message: 'Import folder should be a sub folder of the working space.'
            });
        }
        if (!fs.existsSync(importPath)) {
            return res.status(400).json({
                error: 'wrong_folder',
                message: 'Import folder does not exist.'
            });
        }
        console.info('Importing annotation files.')  
        const filesList = fs.readdirSync(importPath);

        // filter all json files
        const taskJsonFiles = filesList.filter(f => f.endsWith('.json') && !f.startsWith('_'));
        const bm = new batchManager.BatchManager(db);

        // Create tasks  
        // Format of task file:
        // {
        //  name: string
        //  spec: { plugin_name: string, label_schema: {} },
        //  dataset: { path: string, data_type: string }
        // }
        const importedTasks = [];
        for await (const jsonf of taskJsonFiles) {
            const taskData = utils.readJSON(path.join(importPath, jsonf));
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
            await bm.add({ type: 'put', key: dbkeys.keyForTask(newTask.name), value: newTask})

            // Generate first job list
            await generateJobResultAndLabelsLists(newTask); 
            const dataMap = await getAllPathsFromDataset(newTask.dataset_id);
            
            // Read corresponding task folder
            const taskFolder = jsonf.substring(0, jsonf.length - 5);
            const annList = fs.readdirSync(path.join(importPath, taskFolder));
            const annJsonFiles = annList.filter(f => f.endsWith('.json'));
            console.info('Importing', taskFolder);

            // Format of annotation file:
            // { 
            //    annotations: any[],
            //    data: { type: string, path: string | string[], children: array<{path, timestamp}>}
            // }
            for await (const jsonFile of annJsonFiles) {
                // Create data
                const fullPath = path.join(importPath, taskFolder, jsonFile);
                const ann = utils.readJSON(fullPath);
                let sourcePath;
                if (ann.data.path) {
                    // remove / to normalize path
                    const p = Array.isArray(ann.data.path) ? ann.data.path[0] : ann.data.path;
                    sourcePath = path.normalize(p);
                } else {
                    try {
                        // try to get first children image if path is not available
                        const children = ann.data.url || ann.data.children;
                        let firstItemPath = children[0].path || children[0].url;
                        firstItemPath = Array.isArray(firstItemPath) ? firstItemPath[0] : firstItemPath;
                        sourcePath = path.normalize(path.dirname(firstItemPath));
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
                                If you do not wish to load ${newTask.name}, please prefix ${path.join(importPath, jsonf)},
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
 * @apiParam {string} [path] Relative path to tasks folder
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Failed to create export folder
 */
async function export_tasks(req, res) {
    checkAdmin(req, async () => {
        if (!req.body.path) {
            return res.status(400).json({
                error: 'wrong_path',
                message: 'Invalid path.'
            });
        }
        const exportPath = path.join(workspace, req.body.path);
        console.log('##### Exporting to ', exportPath);
        if(!utils.isSubFolder(workspace, exportPath)) {
            return res.status(400).json({
                error: 'wrong_folder',
                message: 'Export folder should be a sub folder of the working space.'
            });
        }      
        // If path does not exist create it
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, {recursive: true});
        }

        const streamTask = utils.iterateOnDB(db, dbkeys.keyForTask(), false, true);
        for await (const task of streamTask) {
            const spec = await db.get(dbkeys.keyForSpec(task.spec_id));
            delete spec.id;
            const dataset = await db.get(dbkeys.keyForDataset(task.dataset_id));
            const datasetId = dataset.id; 
            delete dataset.id;
            const taskJson = {name: task.name, spec, dataset};

            // Write task json
            const err = utils.writeJSON(taskJson, `${exportPath}/${task.name}.json`);
            if (err) {
                return;
            }
            
            // Write annotations for each task in a specific folder
            const taskFolder = `${exportPath}/${task.name}`;
            // Remove existing folder
            utils.removeDir(taskFolder);
            // Recreate it
            fs.mkdirSync(taskFolder, function(err){
                if(err){
                console.log(err);
                response.send(`ERROR! Can't create directory ${taskFolder}`);
                }
            });

            // Write annotations
            const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(task.name), false, true);
            for await (const labels of streamLabels) {
                const data = await getDataDetails(datasetId, labels.data_id, true);
                delete data.id;
                delete data.dataset_id;
                let path = data.path;
                path = Array.isArray(path) ? path[0] : path;
                path = path.replace(dataset.path, '')
                const filename = utils.pathToFilename(path);

                const labelsJson = {...labels, data};
                delete labelsJson.data_id;

                const err = utils.writeJSON(labelsJson, `${taskFolder}/${filename}.json`);
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
    const stream = utils.iterateOnDB(db, dbkeys.keyForTask(), false, true);
    for await (const t of stream) {
      const spec = await db.get(dbkeys.keyForSpec(t.spec_id));
      const dataset = await db.get(dbkeys.keyForDataset(t.dataset_id));
      const taskDetail = {name: t.name, dataset, spec}
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
      console.log('Error while searching task detail', err)
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
        const path = populator.toRelative(dataData.path);
        // Generate result associated with each data
        const newResult = createResult(task.name, dataId, newJob.id, 'to_annotate', path);

        // Generate empty labels associated with each data
        const newLabels = {
            task_name: task.name,
            data_id: dataId,
            annotations: []
        };

        await bm.add({ type: 'put', key: dbkeys.keyForJob(task.name, newJob.id), value: newJob});
        await bm.add({ type: 'put', key: dbkeys.keyForResult(task.name, newResult.data_id), value: newResult});
        await bm.add({ type: 'put', key: dbkeys.keyForLabels(task.name, newLabels.data_id), value: newLabels});
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
    const streamJob = utils.iterateOnDB(db, dbkeys.keyForJob(taskName), false, true);
    for await (const job of streamJob) {
        await bm.add({ type: 'del', key: dbkeys.keyForJob(taskName, job.id)});
    }
    
    // delete associated result
    const streamResults = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
    for await (const result of streamResults) {
        await bm.add({ type: 'del', key: dbkeys.keyForResult(taskName, result.data_id)});
    }
    
    // delete associated labels WARNING !!!!
    const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(taskName), false, true);
    for await (const label of streamLabels) {
        await bm.add({ type: 'del', key: dbkeys.keyForLabels(taskName, label.data_id)});
    }

    // delete associated user information
    const streamUsers = utils.iterateOnDB(db, dbkeys.keyForUser(), false, true);
    for await (const user of streamUsers) {
        ['to_annotate', 'to_validate', 'to_correct'].forEach((obj) => {
            // Delete assigned or queued jobs
            delete user.curr_assigned_jobs[taskName+'/'+obj];
            delete user.queue[taskName+'/'+obj];
        });
        await bm.add({ type: 'put', key: dbkeys.keyForUser(user.username), value: user})
    }

    // [temporary] if associated dataset is no longer associated
    // to any other task, remove it as well
    let foundAssociation = false;
    const stream = utils.iterateOnDB(db, dbkeys.keyForTask(), false, true);
    for await (const t of stream) {
        console.log('task', t);
        if (t.id != taskData.id && t.dataset_id == taskData.dataset_id) {
            foundAssociation = true;
            break; 
        }
    }
    if (!foundAssociation) {
        await bm.add({ type: 'del', key: dbkeys.keyForDataset(taskData.dataset_id)});
        const stream = utils.iterateOnDB(db, dbkeys.keyForData(taskData.dataset_id), true, false);
        for await(const dkey of stream) {
            await bm.add({ type: 'del', key: dbkeys.keyForData(taskData.dataset_id, dkey)});
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
