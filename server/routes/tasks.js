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
 * Get list of all the tasks and their details.
 * @param {*} _ 
 * @param {Response} res 
 */
async function get_tasks(_, res) {
    const tasks = await getAllTasksDetails();
    res.send(tasks);
}

/**
 * Add a new task.
 * @param {Request} req 
 * @param {Result} res 
 */
async function post_tasks(req, res) {
    checkAdmin(req, async () => {
        const task = req.body;
        const spec = await getOrcreateSpec(task.spec);
        const dataset = await getOrcreateDataset({...task.dataset, data_type: spec.data_type}, workspace);
        
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
 * Import annotation to fill an existing project from json files
 * @param {Request} req 
 * @param {Response} res 
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
        const taskJsonFiles = filesList.filter(f => f.endsWith('.json'));
        const bm = new batchManager.BatchManager(db);

        // Create tasks  
        // Format of task file:
        // {
        //  name: string
        //  spec: { plugin_name: string, label_schema: {} },
        //  dataset: { path: string, data_type: string }
        // }
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
            //    annotation: [],
            //    data: { type: string, path: string | string[], children: array<{path, timestamp}>}
            // }
            for await (const jsonFile of annJsonFiles) {
                // Create data
                const fullPath = path.join(importPath, taskFolder, jsonFile);
                const ann = utils.readJSON(fullPath);
                let sourcePath;
                if (ann.data.path) {
                    // remove / to normalize path
                    sourcePath = ann.data.path.replace(/\//g, '');
                } else {
                    try {
                        // try to get first children image if path is not available
                        const children = ann.data.url || ann.data.children;
                        let firstItemPath = children[0].path || children[0].url;
                        firstItemPath = Array.isArray(firstItemPath) ? firstItemPath[0] : firstItemPath;
                        sourcePath = path.dirname(firstItemPath).replace(/\//g, '');
                    } catch(err) {
                        console.warn('Should be: { annotations: any[], data: { type: string, path: string | string[], children: array<{path, timestamp}>} ')
                    }
                }
                // get data id from data path
                const dataId = dataMap[sourcePath];
                if (!dataId) {
                    console.warn(`Unknown path ${sourcePath}`);
                    return res.status(400).json({
                        error: 'wrong_url',
                        message: `Invalid data url in imported file.
                                Please check consistency of ${fullPath}
                                Task importation aborted and cancelled at '${newTask.name}' task.`
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
                const resultData = await db.get(dbkeys.keyForResult(newTask.name, dataId));
                if(resultData.current_job_id) {
                    await bm.add({ type: 'del', key: dbkeys.keyForJob(newTask.name, resultData.current_job_id)})
                }
                resultData.current_job_id = '';
                resultData.status = 'done';
                await bm.add({ type: 'put', key: dbkeys.keyForResult(newTask.name, dataId), value: resultData});

            }
            await bm.flush();
        }
        console.log('Import done.');
        res.sendStatus(200);
    });
}


/**
 * Export annotations to json format
 * @param {Request} req 
 * @param {Response} res 
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

                const labelsJson = {...labels, data};
                delete labelsJson.data_id;

                const err = utils.writeJSON(labelsJson, `${taskFolder}/${labels.data_id}.json`);
                if (err) {
                return;
                }
            }
        }
        res.send();
    });
}

/**
 * Update task details.
 * @param {Request} req 
 * @param {Result} res 
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
            const newSpec = {...oldSpec, label_schema: task.spec.label_schema};
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
 * Get task for a given id.
 * @param {Request} req 
 * @param {Response} res 
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
 * Delete a task for a given id.
 * @param {Request} req 
 * @param {Response} res 
 */
function delete_task(req, res) {
    checkAdmin(req, async () => {
        const taskName = req.params.task_name;
        const key = dbkeys.keyForTask(taskName);
        const bm = new batchManager.BatchManager(db);
        await bm.add({ type: 'del', key});
        
        // delete  associated jobs
        const streamJob = utils.iterateOnDB(db, dbkeys.keyForJob(taskName), false, true);
        for await (const job of streamJob) {
            await bm.add({ type: 'del', key: dbkeys.keyForJob(taskName, job.id)})
        }
        
        // associated result
        const streamResults = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
        for await (const result of streamResults) {
            await bm.add({ type: 'del', key: dbkeys.keyForResult(taskName, result.data_id)})
        }
        
        // associated labels WARNING !!!!
        const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(taskName), false, true);
        for await (const label of streamLabels) {
            await bm.add({ type: 'del', key: dbkeys.keyForLabels(taskName, label.data_id)})
        }
        await bm.flush();      
        return res.status(204).json({});
    });
}

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
 * @param {*} taskName 
 * @param {*} dataId 
 * @param {*} currJobId 
 * @param {*} currStatus 
 */
function createResult(taskName, dataId, currJobId, currStatus, path) {
    return {
        task_name: taskName,
        data_id: dataId, 
        finished_job_ids: [],
        current_job_id: currJobId,
        status: currStatus,
        assigned: false,
        cumulated_time: 0,
        annotator: '',
        validator: '',
        path
    };
}

module.exports = {
    get_tasks,
    post_tasks,
    get_task,
    put_task,
    delete_task,
    import_tasks,
    export_tasks
}
