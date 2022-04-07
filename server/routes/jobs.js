const moment = require('moment');
const { db } = require('../config/db');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');

/**
 * @api {get} /tasks/:task_name/jobs/next Get a new available job with given objective contraint
 * @apiName GetNextJob
 * @apiGroup Job
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [{
 *       id: "totorgr",
         task_name: "task1",
         data_id: "grrvr",
         objective: "to_annotate",
         assigned_to: "john",
         start_at: 1223444,
         duration: 10,
         last_update_at: 1223444,
         annotator: "john",
         validator: ""
 *     }]: DbJob + "annotator" + "validator"
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function get_next_job(req, res) {
    const taskName = req.params.task_name;
    const objective = req.query.objective || 'to_annotate';
    /*  
    Desired status of the new job we want, either to_annotate or to_validate
    When objective is to_annotate, return potential to_correct images first
    Priority is :
        - previous started job if exists
        - first job not done
    */

    // If objective is to_annotate also propose to_correct
    const objectiveList = objective === 'to_annotate' ? ['to_correct', 'to_annotate'] : ['to_validate'];
    const user = await db.get(dbkeys.keyForUser(req.username));
    user.queue = user.queue || {};
    // (1) Check assigned job of the user (in case it was interrupted)
    for (const obj of objectiveList) {
        const oKey = taskName+'/'+obj;
        const assignedJob = user.curr_assigned_jobs[oKey];
        if (assignedJob) {
            let job, result;
            var error=false;
            try {
                job = await db.get(dbkeys.keyForJob(taskName, assignedJob));
                result = await db.get(dbkeys.keyForResult(taskName, job.data_id));
            }
            catch (err) { error=true; console.log('\tjob no longer exist', err);}
            if (!error && isJobValid(job, result) && await isJobAvailableForUser(job, user)) {
                await _assignJob(job, user);
                return res.send({...job, annotator: result.annotator, validator: result.validator});
            }
            // if assigned job not really available, empty the field
            user.curr_assigned_jobs[oKey] = "";
            await db.put(dbkeys.keyForUser(user.username), user);
        }
    }
    // (2) Loop through user queue (in case of correction jobs)
    for (const obj of objectiveList) {
        const oKey = taskName+'/'+obj;
        const queuedJobs = user.queue[oKey] || [];
        if (queuedJobs.length) {
            for (const q of queuedJobs) {
                let job, result;
                var error=false;
                try {
                    job = await db.get(dbkeys.keyForJob(taskName, q));
                    result = await db.get(dbkeys.keyForResult(taskName, job.data_id));
                }
                catch (err) { error=true; console.log('\tjob no longer exist', err); }
                if (!error && isJobValid(job, result) && await isJobAvailableForUser(job, user)) {
                    await _assignJob(job, user);
                    return res.send({...job, annotator: result.annotator, validator: result.validator});
                }
            }
            // in case no queued job was ok, remove job id from queue
            // (even if it probably does not exist)
            user.queue[oKey] = user.queue[oKey].filter((i) => !queuedJobs.includes(i));
            await db.put(dbkeys.keyForUser(user.username), user);
            
        }
    }
    // (3) Loop through available jobs
    const streamA = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
    for await(const result of streamA) {
        if (objectiveList.includes(result.status) && !result.in_progress) {
            let job;
            var error=false;
            try { job = await db.get(dbkeys.keyForJob(taskName, result.current_job_id)); }
            catch (err) { error=true; console.log('\tjob no longer exist', err); }
            if (!error && isJobValid(job, result) && await isJobAvailableForUser(job, user)) {
                await _assignJob(job, user);
                return res.send({...job, annotator: result.annotator, validator: result.validator});
            }
        }
    }
    // (3b) Assign less jobs with less priority
    const streamB = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
    for await(const result of streamB) {
        if (objectiveList.includes(result.status) && !result.in_progress) {
            let job;
            var error=false;
            try { job = await db.get(dbkeys.keyForJob(taskName, result.current_job_id)); }
            catch (err) { error=true; console.log('\tjob no longer exist', err); }
            if (!error && isJobValid(job, result) && await isJobAvailableForUser(job, user, true)) {
                await _assignJob(job, user);
                return res.send({...job, annotator: result.annotator, validator: result.validator});
            }
        }
    }
    return res.send({});
}


/**
 * @api {put} /tasks/:task_name/jobs/:job_id Update job (end or temporary interruption)
 * - (0) Error: called before saving the labels of the task item to make sure of job integrity (NOK)
 * - (1) Saved: called before saving the labels of the task item to make sure of job integrity (OK)
 * - (2) Interruption: means the browser task page tab was quitted.
 * - (3) End: means the task item was either submitted/validated/rejected.
 * @apiName PutJob
 * @apiGroup Job
 * 
 * @apiParam {boolean} interrupt
 * @apiParam {string} status
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Unknown job
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 410 Job denied
 */
async function put_job(req, res) {
    const taskName = req.params.task_name;
    const jobId = req.params.job_id;
    const interrupt = req.body.interrupt;
    const newObjective = req.body.status; // new status for data item
    let user;
    let jobData; // current state of job
    let resultData; // global view of the image status
    try {
        jobData = await db.get(dbkeys.keyForJob(taskName, jobId));
        resultData = await db.get(dbkeys.keyForResult(taskName, jobData.data_id));
        user = await db.get(dbkeys.keyForUser(req.username));
    } catch (err) {
        return res.status(400).json({type: 'unknown', message: `Unknown job ${taskName} ${jobId} or user ${req.username}.`});
    }

    // Check assignment to user and to result
    if (jobData.assigned_to !== req.username ||
         resultData.current_job_id !== jobId || jobData.start_at == 0) {
        // Case (0) : job not assigned to the user or not started, prevent saving labels
        // Release job for user
        user.curr_assigned_jobs[`${taskName}/${resultData.status}`] = '';
        await db.put(dbkeys.keyForUser(user.username), user);
        return res.status(410).json({
            type: 'job_denied',
            message: `This job is no longer attributed to ${req.username} (now: ${jobData.assigned_to})
                    Ignoring submission.`
        });
    }

    jobData.last_update_at = moment().unix();

    // Case (1) : task only saved and passed assignment check.
    if (newObjective == undefined && interrupt == undefined) {
        await db.put(dbkeys.keyForJob(taskName, jobId), jobData);
        return res.status(204).json({});
    }

    const ops = [];
    // The job is temporarily or definitely ended:
    // Update the time cumulator and stop time counter
    const duration = moment().unix() - jobData.start_at;
    jobData.duration += duration;
    jobData.start_at = 0;
    // Save job and result with new duration
    resultData.cumulated_time += duration;
    
    ops.push({ type: 'put', key: dbkeys.keyForJob(taskName, jobId), value: jobData});

    // Case (2) : page quit so only time update
    if (interrupt) {
        ops.push({ type: 'put', key: dbkeys.keyForResult(taskName, jobData.data_id), value: resultData});
        await db.batch(ops);
        return res.status(204).json({});
    }

    // Case (3): job was ended
    // Release job for user
    user.curr_assigned_jobs[`${taskName}/${resultData.status}`] = '';

    // Remove job from user queue
    user.queue = user.queue || {};
    const currQueue = user.queue[`${taskName}/${jobData.objective}`];
    if (currQueue && currQueue.includes(jobData.id)) {
        user.queue[`${taskName}/${jobData.objective}`] = currQueue.filter((id) => id != jobData.id);
    }
    await db.put(dbkeys.keyForUser(user.username), user);

    // Update result
    resultData.in_progress = false;
    resultData.status = ['to_annotate', 'to_validate', 'to_correct', 'discard', 'done'].includes(newObjective) ? newObjective : 'to_annotate';
    resultData.finished_job_ids.push(resultData.current_job_id);

    if (newObjective === 'done' || newObjective === 'discard') {
        resultData.current_job_id = '';
        ops.push({ type: 'put', key: dbkeys.keyForResult(taskName, jobData.data_id), value: resultData});
        await db.batch(ops);
        return res.status(204).json({});
    }

    // Create new Job if not 'done' or 'discard'
    const newJob = createJob(jobData.task_name, jobData.data_id, newObjective);
    resultData.current_job_id = newJob.id;

    if (newObjective === 'to_correct') {
        // Add job to user queue
        const nextUser = await db.get(dbkeys.keyForUser(resultData.annotator));
        nextUser.queue = nextUser.queue || {};
        // Push up the correction job in priority for the annotator
        nextUser.queue[taskName+'/'+newJob.objective] = nextUser.queue[taskName+'/'+newJob.objective] || [];
        nextUser.queue[taskName+'/'+newJob.objective].push(newJob.id);
        ops.push({ type: 'put', key: dbkeys.keyForUser(nextUser.username), value: nextUser});
    }
    ops.push({ type: 'put', key: dbkeys.keyForJob(taskName, newJob.id), value: newJob});
    ops.push({ type: 'put', key: dbkeys.keyForResult(taskName, resultData.data_id), value: resultData});
    await db.batch(ops);
    return res.status(204).json({});
}

///// Utils

/**
 * Fill in all default properties for a new job
 * @param {string} taskName 
 * @param {string} dataId 
 * @param {string} objective 
 * @returns DbJob
 */
function createJob(taskName, dataId, objective) {
    return {
        id: utils.generateKey(),
        task_name: taskName,
        data_id: dataId, 
        objective,
        created_at: moment().unix(),
        assigned_to: '',
        start_at: 0, // most recent usage start of job, 0 if job not currently worked on
        duration: 0, // total accumulated duration
        last_update_at: moment().unix() // most recent job update
    };
}

/**
 * Helper function to assign a job to a user.
 * @param {Request} req 
 * @param {Response} res 
 */
async function _assignJob(job, user) {
    const ops = [];
    const qKey = job.task_name+'/'+job.objective;
    job.assigned_to = user.username;
    // unix time (number of seconds since january of 1970) e.g. 1578391295 
    job.start_at = moment().unix();
    job.last_update_at = job.start_at;

    // update user info
    user.curr_assigned_jobs[qKey] = job.id;
    user.queue = user.queue || {};
    user.queue[qKey] = user.queue[qKey] || [];
    user.queue[qKey] = user.queue[qKey].filter((i) => i !== job.id); // remove from queue
    
    // update in_progress state of result
    const resultData = await db.get(dbkeys.keyForResult(job.task_name, job.data_id));
    resultData.in_progress = true;
    resultData.current_job_id = job.id; // just in case
    // update main annotator information
    if (job.objective === 'to_annotate' || job.objective === 'to_correct') {
      resultData.annotator = user.username;
    } else if (job.objective === 'to_validate') {
      resultData.validator = user.username;
    }
    ops.push({ type: 'put', key: dbkeys.keyForUser(user.username), value: user});
    ops.push({ type: 'put', key: dbkeys.keyForJob(job.task_name, job.id), value: job});
    ops.push({ type: 'put', key: dbkeys.keyForResult(job.task_name, job.data_id), value: resultData});
    await db.batch(ops);
}

function isJobValid(job, result) {
    // means the job is no longer valid or result done
    return result.status == job.objective && result.current_job_id == job.id;
}

async function isJobAvailableForUser(job, targetUser, isPermissive = false) {
    const qKey = job.task_name + "/" + job.objective;
    // Case (0) Job is not assigned to user anymore
    if (job.assigned_to && job.assigned_to !== targetUser.username) {
        targetUser.curr_assigned_jobs[qKey] = "";
        targetUser.queue[qKey] = targetUser.queue[qKey].filter((i) => i !== job.id);
        await db.put(dbkeys.keyForUser(targetUser.username), targetUser);
        return false;
    } else if (!job.assigned_to && targetUser.curr_assigned_jobs[qKey]) {
        targetUser.curr_assigned_jobs[qKey] = "";
        return false;
    } else if (!job.assigned_to && targetUser.queue[qKey] && targetUser.queue[qKey].includes(job.id)) {
        return true;
    } else if (!job.assigned_to && !isPermissive) {
        const streamUsers = utils.iterateOnDB(db, dbkeys.keyForUser(), false, true);
        for await (const user of streamUsers) {
            if (user.username == targetUser.username) { continue; }
            if (user.queue && user.queue[qKey] && user.queue[qKey].includes(job.id)) {
                return false;
            }
        }
    }
    // if permissive, steal job even if its in someone else queue
    // it will raise an error for them when they try to get it
    return true;
}


module.exports = {
    get_next_job,
    put_job,
    createJob
}
