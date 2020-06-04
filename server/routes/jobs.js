const moment = require('moment');
const { db } = require('../config/db');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');

/**
 * Get a new available job with given objective contraint.
 * @param {Request} req 
 * @param {Response} res 
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
    const objectiveList = objective === 'to_annotate' ? ['to_correct', 'to_annotate'] : ['to_validate']
    const user = await db.get(dbkeys.keyForUser(req.username));
    for (const obj of objectiveList) {
        if (user.last_assigned_jobs[taskName+'/'+obj]) {
            try {
                const job_key = dbkeys.keyForJob(taskName, user.last_assigned_jobs[taskName+'/'+obj]);
                const job = await db.get(job_key);
                await _assignJob(taskName, job, user);
                return res.send(job);
            } catch (err) {
                console.log('\tjob does not exist anymore, continue !!!', taskName, obj, user.last_assigned_jobs[taskName+'/'+obj]);
            }
        }
    }
    const stream = utils.iterateOnDB(db, dbkeys.keyForJob(taskName), false, true);
    for await(const job of stream) {
        if (objectiveList.includes(job.objective)) {
            if (!job.assigned_to) {
                await _assignJob(taskName, job, user);
                return res.send(job);
            }
        }
    }
    return res.send({});
}

/**
 * Update job.
 * @param {Request} req 
 * @param {Response} res 
 */
async function put_job(req, res) {
    const taskName = req.params.task_name;
    const jobId = req.params.job_id;
    const interrupt = req.body.interrupt;
    const status = req.body.status;

    let jobData;
    try {
        // current state of job
        jobData = await db.get(dbkeys.keyForJob(taskName, jobId));
        if (jobData.assigned_to !== req.username) {
            return res.status(410).json({
                type: 'job_denied',
                message: `This job is no longer attributed to ${req.username}.
                        Ignoring submission.`
            });
        }
    } catch (err) {
        return res.status(400).json({
            type: 'unknown',
            message: `Unknown job ${taskName} ${jobId}`
        });
    }
    
    // Check before user validity before saving labels
    if (Object.keys(req.body).length === 0) {
        return res.status(204).json({});
    }

    // Job interruption or ended: update cumulator and stop time counter
    if(jobData.start_at) {
        jobData.duration += moment().unix() - jobData.start_at;
    } else {
        console.log('SHOULD NOT HAPPEN', jobData)
    }
    jobData.last_update_at = moment().unix();
    jobData.start_at = 0;
    if (interrupt) {
        await db.put(dbkeys.keyForJob(taskName, jobId), jobData);
        return res.status(204).json({});
    } 
    // Job status update and create next annotation stream process
    const ops = [];
    try {
        // job is done update unassigned job to user
        const user = await db.get(dbkeys.keyForUser(req.username));
        user.last_assigned_jobs[`${taskName}/${jobData.objective}`] = '';
        await db.put(dbkeys.keyForUser(user.username), user);
    } catch (user_err) {
        return res.status(400).json({
            type: 'unknown',
            message: `Unknown user ${req.username}`
        });
    }
    // save job
    ops.push({ type: 'put', key: dbkeys.keyForJob(taskName, jobId), value: jobData});

    // update result
    const resultData = await db.get(dbkeys.keyForResult(taskName, jobData.data_id));
    resultData.status = status;
    resultData.finished_job_ids.push(resultData.current_job_id);
    resultData.cumulated_time += jobData.duration
    resultData.assigned = false;

    if (status === 'done') {
        resultData.current_job_id = '';
        ops.push({ type: 'put', key: dbkeys.keyForResult(taskName, jobData.data_id), value: resultData});
        await db.batch(ops);
        return res.status(204).json({});
    }

    // Create new Job if not 'done'
    const newJob = createJob(jobData.task_name, jobData.data_id, status);

    if (status === 'to_correct') {
        resultData.assigned = true;
        newJob.assigned_to = resultData.annotator;
        // update user info
        const corrector = await db.get(dbkeys.keyForUser(resultData.annotator));
        corrector.last_assigned_jobs[taskName+'/'+newJob.objective] = newJob.id;
        ops.push({ type: 'put', key: dbkeys.keyForUser(corrector.username), value: corrector});
    }
    resultData.current_job_id = newJob.id;
    ops.push({ type: 'put', key: dbkeys.keyForJob(taskName, newJob.id), value: newJob});
    ops.push({ type: 'put', key: dbkeys.keyForResult(taskName, jobData.data_id), value: resultData});

    await db.batch(ops);
    return res.status(204).json({});
}

function createJob(taskName, dataId, status) {
    return {
        id: utils.generateKey(),
        task_name: taskName,
        data_id: dataId, 
        objective: status,
        created_at: moment().unix(),
        assigned_to: '',
        start_at: 0,
        duration: 0
    };
}

/**
 * Helper function to assign a job to a user.
 * @param {Request} req 
 * @param {Response} res 
 */
async function _assignJob(taskName, job, user) {
    const ops = [];
    job.assigned_to = user.username;
    // unix time (number of seconds since january of 1970) e.g. 1578391295 
    job.start_at = moment().unix();
    ops.push({ type: 'put', key: dbkeys.keyForJob(taskName, job.id), value: job});

    // update user info
    user.last_assigned_jobs[taskName+'/'+job.objective] = job.id;
    ops.push({ type: 'put', key: dbkeys.keyForUser(user.username), value: user});

    // update assigned status of result
    const resultData = await db.get(dbkeys.keyForResult(taskName, job.data_id));
    resultData.assigned = true;
    // update main annotator information
    if (job.objective === 'to_annotate' || job.objective === 'to_correct') {
      resultData.annotator = user.username;
    } else if (job.objective === 'to_validate') {
      resultData.validator = user.username;
      job.annotator = resultData.annotator;
    }
    ops.push({ type: 'put', key: dbkeys.keyForJob(taskName, job.id), value: job});
    ops.push({ type: 'put', key: dbkeys.keyForResult(taskName, job.data_id), value: resultData});
    await db.batch(ops);
}

module.exports = {
    get_next_job,
    put_job,
    createJob
}
