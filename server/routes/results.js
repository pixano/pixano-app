const { db } = require('../config/db');
const { checkAdmin } = require('./users');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');
const batchManager = require('../helpers/batch-manager');

/**
 * Request list of results with given contraints
 * (page, pageCount, filter, sort, ...).
 * @param {Request} req 
 * @param {Response} res 
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

    const stream = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
    for await (const result of stream) {
        let included = true;
        for (let k of keys) {
            const query = queries[k];
            const r = JSON.stringify(result[k]) || '';
            if (!r.includes(query)) {
                included = false;
                break;
            }
        }
        if (included) {
            if (counter >= (match.page - 1) * match.count && counter < match.page * match.count) {
                results.push(result);
            }
            counter += 1;
        }
        if (result.status === 'done') {
            doneCounter += 1;
        }
        globalCounter += 1;
    }
    return res.send({results, counter, globalCounter, doneCounter});
}

/**
 * Get result for a given data.
 * @param {Request} req 
 * @param {Response} res 
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

/**
 * Get previous result from a given result id. Empty if end of database.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_previous_result(req, res) {
    return _get_next_result(req, res, false);
}

/**
 * Get next result from a given result id. Empty if start of database.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_next_result(req, res) {
    return _get_next_result(req, res, true);
}

/**
 * Update result state.
 * @param {Request} req 
 * @param {Response} res 
 */
async function put_results(req,res) {
    checkAdmin(req, async () => {
        const taskName = req.params.task_name;
        const dataIds = req.body.data_ids;
        const newStatus = req.body.status;
        const bm = new batchManager.BatchManager(db);

        // No new status, results are requested for being unassigned
        if (!newStatus) {
            for await (const d of dataIds) {
                try {
                    const resultData = await db.get(dbkeys.keyForResult(taskName, d));
                    resultData.assigned = false;

                    // Reset to previous annotato/validator
                    resultData.annotator = '';
                    resultData.validator = '';
                    
                    const currJobId = resultData.current_job_id;
                    if(currJobId) {
                        const job = await db.get(dbkeys.keyForJob(taskName, currJobId));
                        // Remove assigned user of this job 
                        try {
                            const user = await db.get(dbkeys.keyForUser(job.assigned_to));
                            if (!user.queue) { user.queue  = {} }

                            user.last_assigned_jobs[taskName+'/'+job.objective] = '';
                            if (user.queue[taskName+'/'+job.objective]) {
                                user.queue[taskName+'/'+job.objective] = user.queue[taskName+'/'+job.objective].filter((j) => j.id !== currJobId);
                            }
                            await bm.add({ type: 'put', key: dbkeys.keyForUser(job.assigned_to), value: user})
                        } catch (err) { }

                        job.assigned_to = '';
                        job.start_at = 0;
                        await bm.add({ type: 'put', key: dbkeys.keyForJob(taskName, currJobId), value: job})
                    }
                    await bm.add({ type: 'put', key:dbkeys.keyForResult(taskName, d), value: resultData});
                } catch (err) {
                    return res.status(400).json({
                        type: 'unknown',
                        message: `Unknown entry in dataset for result ${taskName} ${d}`
                    });
                }
            }        
        } else {
            for await (const d of dataIds) {
                try {
                    const resultData = await db.get(dbkeys.keyForResult(taskName, d));
                    if(resultData.status !== newStatus) {
                        resultData.status = newStatus;
                        if(resultData.current_job_id) {
                            await bm.add({ type: 'del', key: dbkeys.keyForJob(taskName, resultData.current_job_id)})
                        }

                        if(newStatus !== 'done') {
                            const newJob = {
                                id: utils.generateKey(),
                                task_name: taskName,
                                data_id: d, 
                                objective: newStatus,
                                assigned_to: '',
                                start_at: 0,
                                duration: 0
                            };
                            resultData.current_job_id = newJob.id;
                            await bm.add({ type: 'put', key: dbkeys.keyForJob(taskName, newJob.id), value: newJob});
                        } else {
                            resultData.current_job_id = '';
                        }
                        await bm.add({ type: 'put', key: dbkeys.keyForResult(taskName, d), value: resultData});
                    }
                } catch (err) {
                    return res.status(400).json({
                        type: 'unknown',
                        message: 'Unknown result '+taskName+' '+d
                    });
                }        
            }
        }
        await bm.flush();
        return res.status(204).json({});
    });
}

module.exports = {
    get_results,
    get_result,
    get_previous_result,
    get_next_result,
    put_results
}
