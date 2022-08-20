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
// const { print,
//         dump } = require('./config/db');

/**
 * Router handling the HTTP requests
 * from the client.
 * @param {string} workspace path
 */

const router = express.Router();
// router.get('/print', print);
// router.get('/dump', dump);

const auth = middleware.checkWhoGoogle;
router.post('/project/snapshot', auth, snapshot_project);

router.post('/login', post_login);
router.get('/logout', auth, get_logout);
router.post('/users', auth, post_users);
router.get('/users', auth, get_users);
router.put('/users/:username', auth, put_user);
router.delete('/users/:username', auth, delete_user);

router.get('/profile', auth, get_profile);

router.get('/datasets', auth, get_datasets);
router.post('/datasets', auth, post_datasets);
router.get('/datasets/:dataset_id', auth, get_dataset);
router.delete('/datasets/:dataset_id', auth, delete_dataset);

router.get('/datasets/:dataset_id/data/:data_id', auth, get_data);
router.get('/datasets/:dataset_id/data/', auth, get_datas);

router.get('/specs', auth, get_specs);
router.post('/specs', auth, post_specs);
router.get('/specs/:spec_id', auth, get_spec);
router.put('/specs/:spec_id', auth, put_spec);
router.delete('/specs/:spec_id', auth, delete_spec);

router.get('/tasks', auth, get_tasks);
router.post('/tasks', auth, post_tasks);
router.post('/tasks/import', auth, import_tasks);
router.post('/tasks/export', auth, export_tasks);
router.put('/tasks/:task_name', auth, put_task);
router.get('/tasks/:task_name', auth, get_task);
router.delete('/tasks/:task_name', auth, delete_task);

// For labelling jobs
router.get('/tasks/:task_name/jobs/next', auth, get_next_job);
router.put('/tasks/:task_name/jobs/:job_id', auth, put_job);

// For explore
router.get('/tasks/:task_name/results', auth, get_results);
router.get('/tasks/:task_name/results/:data_id', auth, get_result);
router.get('/tasks/:task_name/results/:data_id/previous', auth, get_previous_result);
router.get('/tasks/:task_name/results/:data_id/next', auth, get_next_result);
router.put('/tasks/:task_name/results', auth, put_results);

// For label
router.get('/tasks/:task_name/labels/:data_id', auth, get_labels);
router.put('/tasks/:task_name/labels/:data_id', auth, put_labels);

module.exports = router;
