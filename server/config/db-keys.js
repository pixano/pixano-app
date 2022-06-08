/**
 * Various utility functions to interact with the level database.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

////////////////////////////
//// key management function
////////////////////////////
const keyForVersion = () => {
  return 'v';
}

const keyForUser = (username = '') => {
  return 'u:' + username;
}

const keyForDataset = (dataset_id = '') => {
  return 'd:' + dataset_id
}

const keyForData = (dataset_id, data_id = '') => {
  return 'd:' + dataset_id + ':' + data_id;
}

const keyForSpec = (spec_id = '') => {
  return 's:' + spec_id;
}

const keyForTask = (task_name = '') => {
  return 't:' + task_name
}

const keyForJob = (task_name, job_id = '') => {
  return 'j:' + task_name + ':' + job_id;
}

const keyForAllResults = () => {
  return 'r:';
}

const keyForResult = (task_name, data_id='') => {
  return 'r:' + task_name + ':' + data_id;
}

const keyForLabels = (task_name, data_id = '') => {
  return 'l:' + task_name + ':' + data_id;
}

const keyForCliOptions = () => {
	return 'o:';
}



module.exports = {
  keyForVersion,
  keyForUser,
  keyForDataset,
  keyForData,
  keyForTask,
  keyForSpec,
  keyForJob,
  keyForAllResults,
  keyForResult,
  keyForLabels,
  keyForCliOptions
}