/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const express = require('express');
const middleware = require('./config/middleware');

const { post_login,
        get_logout,
        post_users,
        get_users,
        put_user,
        delete_user,
        get_profile } = require('./routes/users');
const { get_datasets,
        post_datasets,
        get_dataset,
        delete_dataset,
        get_data,
        get_datas } = require('./routes/datasets');
const { get_specs,
        post_specs,
        get_spec,
        put_spec,
        delete_spec } = require('./routes/specs');
const { get_next_job,
        put_job } = require('./routes/jobs');
const { get_labels,
        put_labels } = require('./routes/labels');
const { get_tasks,
        post_tasks,
        get_task,
        put_task,
        delete_task,
        import_tasks,
        export_tasks } = require('./routes/tasks');
const { snapshot_project } = require('./routes/project');
const { get_results,
        get_result,
        get_previous_result,
        get_next_result,
        put_results } = require('./routes/results');
const { print,
        dump } = require('./config/db');

/**
 * Router handling the HTTP requests
 * from the client.
 * @param {string} workspace path
 */

const router = express.Router();
router.get('/print', print);
router.get('/dump', dump);

router.post('/project/snapshot', middleware.checkToken, snapshot_project);

router.post('/login', post_login);
router.get('/logout', middleware.checkToken, get_logout);
router.post('/users', middleware.checkToken, post_users);
router.get('/users', middleware.checkToken, get_users);
router.put('/users/:username', middleware.checkToken, put_user);
router.delete('/users/:username', middleware.checkToken, delete_user);

router.get('/profile', middleware.checkToken, get_profile);

router.get('/datasets', middleware.checkToken, get_datasets);
router.post('/datasets', middleware.checkToken, post_datasets);
router.get('/datasets/:dataset_id', middleware.checkToken, get_dataset);
router.delete('/datasets/:dataset_id', middleware.checkToken, delete_dataset);

router.get('/datasets/:dataset_id/data/:data_id', middleware.checkToken, get_data);
router.get('/datasets/:dataset_id/data/', middleware.checkToken, get_datas);

router.get('/specs', middleware.checkToken, get_specs);
router.post('/specs', middleware.checkToken, post_specs);
router.get('/specs/:spec_id', middleware.checkToken, get_spec);
router.put('/specs/:spec_id', middleware.checkToken, put_spec);
router.delete('/specs/:spec_id', middleware.checkToken, delete_spec);

router.get('/tasks', middleware.checkToken, get_tasks);
router.post('/tasks', middleware.checkToken, post_tasks);
router.post('/tasks/import', middleware.checkToken, import_tasks);
router.post('/tasks/export', middleware.checkToken, export_tasks);
router.put('/tasks/:task_name', middleware.checkToken, put_task);
router.get('/tasks/:task_name', middleware.checkToken, get_task);
router.delete('/tasks/:task_name', middleware.checkToken, delete_task);

// For labelling jobs
router.get('/tasks/:task_name/jobs/next', middleware.checkToken, get_next_job);
router.put('/tasks/:task_name/jobs/:job_id', middleware.checkToken, put_job);

// For explore
router.get('/tasks/:task_name/results', middleware.checkToken, get_results);
router.get('/tasks/:task_name/results/:data_id', middleware.checkToken, get_result);
router.get('/tasks/:task_name/results/:data_id/previous', middleware.checkToken, get_previous_result);
router.get('/tasks/:task_name/results/:data_id/next', middleware.checkToken, get_next_result);
router.put('/tasks/:task_name/results', middleware.checkToken, put_results);

// For label
router.get('/tasks/:task_name/labels/:data_id', middleware.checkToken, get_labels);
router.put('/tasks/:task_name/labels/:data_id', middleware.checkToken, put_labels);

module.exports = router;
