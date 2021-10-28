const { db } = require('../config/db');
const { checkAdmin } = require('./users');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');
const { createJob } = require('./jobs');
const batchManager = require('../helpers/batch-manager');

/**
 * @api {get} /tasks/:task_name/results Request list of results with given contraints
 * (page, pageCount, filter, sort, ...)
 * @apiName GetResults
 * @apiGroup Results
 * 
 * @queryParam {number} page
 * @queryParam {number} count
 * @queryParam {string} <any> (filter result any keys with value inclusion)
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      results: DbResult[],
 *      counter: number, // number of included results
 *      globalCounter: number, // number of all results
 *      doneCounter: number, // number of all done results
 *      toValidateCounter: number // number of all to_validate results
 *     }
 */
async function get_results(req, res) {
    const taskName = req.params.task_name;
    const queries = req.query;
    const match = {
        page: queries.page || 0,
        count: queries.count || 1
    };
    delete queries.page;
    delete queries.count;
    const keys = [...Object.keys(queries)];
    let counter = 0;
    let results = [];
    let globalCounter = 0;
    let doneCounter = 0;
    let toValidateCounter = 0;

    const stream = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
    const task = await db.get(dbkeys.keyForTask(taskName));
    for await (const result of stream) {
        // filter results
        let included = true;
        for (let k of keys) {
            const query = queries[k];
            const r = JSON.stringify(result[k]) || '';
            // if the filter is a (semicolon separated) list, include all result that satisfies at least one of them
            const queryList = query.split(";").filter((q) => q != "");
            included = queryList.some((q) => r.includes(q));
            if (!included) break;
        }
        if (included) {
            if (counter >= (match.page - 1) * match.count && counter < match.page * match.count) {
                const imgData = await db.get(dbkeys.keyForData(task.dataset_id,result.data_id));
                results.push({...result,thumbnail: imgData.thumbnail});
            }
            counter += 1;
        }
        if (result.status === 'done') {
            doneCounter += 1;
        }
        if (result.status === 'to_validate') {
            toValidateCounter += 1;
        }
        globalCounter += 1;
    }
    return res.send({results, counter, globalCounter, doneCounter, toValidateCounter});
}

/**
 * @api {get} /tasks/:task_name/results/:data_id Get result for given data and task
 * @apiName GetResult
 * @apiGroup Results
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      task_name: "my_task",
 *      data_id: "reniverv",
 *      finished_job_ids: ["cece","trtre"],
 *      current_job_id: "vfnoivnre",
 *      status: "to_annotate",
 *      cumulated_time: 12345,
 *      annotator: "john",
 *      validator: "",
 *      in_progress: true;
 *     }: DbResult
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Invalid id
 */
async function get_result(req, res) {
    const taskName = req.params.task_name;
    const dataId = req.params.data_id;
    try {
        const resultData = await db.get(dbkeys.keyForResult(taskName, dataId));
        return res.send(resultData);
    } catch (err) {
        return res.status(400).json({
            message: `Unknown result ${taskName} ${dataId}`
        });
    }
}


/**
 * @api {get} /tasks/:task_name/results/:data_id/previous Get previous result from a given result id
 * (Empty if start of database)
 * @apiName GetPreviousResult
 * @apiGroup Results
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      task_name: "my_task",
 *      data_id: "reniverv",
 *      finished_job_ids: ["cece","trtre"],
 *      current_job_id: "vfnoivnre",
 *      status: "to_annotate",
 *      cumulated_time: 12345,
 *      annotator: "john",
 *      validator: "",
 *      in_progress: true;
 *     }: DbResult
 */
 async function get_previous_result(req, res) {
    return _get_next_result(req, res, false);
}


/**
 * @api {get} /tasks/:task_name/results/:data_id/previous Get next result from a given result id
 * (Empty if end of database)
 * @apiName GetNextResult
 * @apiGroup Results
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      task_name: "my_task",
 *      data_id: "reniverv",
 *      finished_job_ids: ["cece","trtre"],
 *      current_job_id: "vfnoivnre",
 *      status: "to_annotate",
 *      cumulated_time: 12345,
 *      annotator: "john",
 *      validator: "",
 *      in_progress: true;
 *     }: DbResult
 */
async function get_next_result(req, res) {
    return _get_next_result(req, res, true);
}


/**
 * @api {put} /tasks/:task_name/results Update result state
 * @apiName PutResult
 * @apiGroup Results
 * @apiPermission admin
 * 
 * @apiParam {string[]} data_ids
 * @apiParam {string} status
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function put_results(req,res) {
    checkAdmin(req, async () => {
        const taskName = req.params.task_name;
        const dataIds = req.body.data_ids;
        const newStatus = req.body.status;
        const bm = new batchManager.BatchManager(db);

        let resultData;

        // Case (1) : No new status, results are requested for being unassigned
        if (!newStatus) {
            for await (const d of dataIds) {
                try { resultData = await db.get(dbkeys.keyForResult(taskName, d));
                } catch (err) {
                    return res.status(400).json({type: 'unknown', message: 'Unknown result '+taskName+' '+d});
                }
                // Reset result
                resultData.in_progress = false;
                resultData.annotator = '';
                resultData.validator = '';
                
                const currJobId = resultData.current_job_id;
                if(currJobId) {
                    let user;
                    let job;
                    try {
                        job = await db.get(dbkeys.keyForJob(taskName, currJobId));
                        user = await db.get(dbkeys.keyForUser(job.assigned_to));
                    } catch (err) {}
                    // Remove assigned user of this job 
                    user.queue = user.queue || {};
                    user.curr_assigned_jobs[taskName+'/'+job.objective] = '';
                    if (user.queue[taskName+'/'+job.objective]) {
                        user.queue[taskName+'/'+job.objective] = user.queue[taskName+'/'+job.objective].filter((j) => j.id !== currJobId);
                    }
                    await bm.add({ type: 'put', key: dbkeys.keyForUser(job.assigned_to), value: user})

                    // Reset job
                    job.assigned_to = '';
                    job.start_at = 0;
                    await bm.add({ type: 'put', key: dbkeys.keyForJob(taskName, currJobId), value: job})
                }
                await bm.add({ type: 'put', key:dbkeys.keyForResult(taskName, d), value: resultData});
            }        
        }
        // Case (2) : Change result status
        else {
            for await (const d of dataIds) {
                try { resultData = await db.get(dbkeys.keyForResult(taskName, d));
                } catch (err) {
                    return res.status(400).json({type: 'unknown', message: 'Unknown result '+taskName+' '+d});
                }
                if (resultData.status !== newStatus) {
                    resultData.status = newStatus;
                    if (resultData.current_job_id) {
                        await bm.add({ type: 'del', key: dbkeys.keyForJob(taskName, resultData.current_job_id)})
                    }
                    if (newStatus !== 'done') {
                        const newJob = createJob(taskName, d, newStatus);
                        resultData.current_job_id = newJob.id;
                        await bm.add({ type: 'put', key: dbkeys.keyForJob(taskName, newJob.id), value: newJob});
                    } else {
                        resultData.current_job_id = '';
                    }
                    await bm.add({ type: 'put', key: dbkeys.keyForResult(taskName, d), value: resultData});
                }      
            }
        }
        await bm.flush();
        return res.status(204).json({});
    });
}


////// Utils

/**
 * Utility method to get next/previous result.
 * @param {Request} req 
 * @param {Response} res 
 * @param {Boolean} forward 
 */
 async function _get_next_result(req, res, forward=true) {
    const taskName = req.params.task_name;
    const dataId = req.params.data_id;
    const queries = req.query;
    const keys = [...Object.keys(queries)];
    const stream = utils.iterateOnDBFrom(db, dbkeys.keyForResult(taskName, dataId), dbkeys.keyForResult(taskName), 
                                            false, true, !forward);
    for await (const result of stream) {
        let included = true;
        for (let k of keys) {
            if (!result[k].includes(queries[k])) {
                included = false;
                break;
            }
        }
        if (included) {
            return res.send(result);
        }
    }
    return res.send({});
}

module.exports = {
    get_results,
    get_result,
    get_previous_result,
    get_next_result,
    put_results
}
