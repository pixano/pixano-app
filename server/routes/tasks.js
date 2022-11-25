const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const { db, workspace, print } = require('../config/db');
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
const fetch = require("node-fetch");

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
 *     HTTP/1.1 400 Data type of dataset does not correspond to plugin's one
 */
async function post_tasks(req, res) {
	checkAdmin(req, async () => {
		const task = req.body;
		const spec = await getOrcreateSpec(task.spec);
		const dataset = await getOrcreateDataset(task.dataset, workspace);
		if (spec.data_type !== dataset.data_type) {
			//... TODO delete spec if newly created
			return res.status(400).json({ message: 'Data type of dataset (' + dataset.data_type + ') does not correspond to plugin\'s one (' + spec.data_type + ')' });
		}
		try {
			await db.get(dbkeys.keyForTask(task.name));
			return res.status(400).json({ message: 'Taskname already existing' });
		} catch (e) { }
		// Task does not exist create it
		const newTask = { name: task.name, dataset_id: dataset.id, spec_id: spec.id }
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
		const importPath = path.join(workspace, req.body.path);
		console.log('##### Importing from ', importPath);
		if (!utils.isSubFolder(workspace, importPath)) {
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
		for await (const jsonf of taskJsonFiles) {
			const taskData = utils.readJSON(path.join(importPath, jsonf));
			let version = taskData.version;
			// check annotation format version
			if (!version) version = "0.9";//0.9 is the first versioned format
			if (parseFloat(version) < parseFloat(annotation_format_version)) {
				// TO BE DETERMINED when new version will arrise: solve compatibility issues
			}
			console.info("Annotation format version:", annotation_format_version);

			const dataset = await getOrcreateDataset({ ...taskData.dataset, data_type: taskData.spec.data_type }, workspace);
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
			const newTask = { name: taskData.name, dataset_id: dataset.id, spec_id: spec.id };
			await bm.add({ type: 'put', key: dbkeys.keyForTask(newTask.name), value: newTask })

			// Generate first job list
			await generateJobResultAndLabelsLists(newTask);
			const dataMap = await getAllPathsFromDataset(newTask.dataset_id);
			//BR
			console.log("BR newTask", newTask);
			console.log("BR newTask.dataset_id", newTask.dataset_id);

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
			for await (const jsonFile of annJsonFiles) {
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
					} catch (err) {
						console.warn('Should be: { annotations: any[], data: { type: string, path: string | string[], children: array<{path, timestamp}>} ')
					}
				}
				// get data id from data path
				//BR
				console.log("BR sourcePath (images): ", sourcePath);
				console.log("BR fullPath (jsonFile): ", fullPath);
				console.log("BR dataMap: ", dataMap);
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

				await bm.add({ type: 'put', key: dbkeys.keyForLabels(newTask.name, newLabels.data_id), value: newLabels });
				if (ann.data.status) {//if existing, get status back
					resultData = await db.get(dbkeys.keyForResult(newTask.name, newLabels.data_id));//get the status for this data
					resultData.status = ann.data.status;//add the status
					await bm.add({ type: 'put', key: dbkeys.keyForResult(newTask.name, newLabels.data_id), value: resultData });
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
		if (req.body.path) {//export to local file system
			var exportPath = path.join(workspace, req.body.path);
			console.log('##### Exporting to ', exportPath);
			if (!utils.isSubFolder(workspace, exportPath)) {
				return res.status(400).json({
					error: 'wrong_folder',
					message: 'Export folder should be a sub folder of the working space.'
				});
			}
			// If path does not exist create it
			if (!fs.existsSync(exportPath)) {
				fs.mkdirSync(exportPath, { recursive: true });
			}
		}

		const streamTask = utils.iterateOnDB(db, dbkeys.keyForTask(), false, true);
		for await (const task of streamTask) {
			const spec = await db.get(dbkeys.keyForSpec(task.spec_id));
			delete spec.id;
			const dataset = await db.get(dbkeys.keyForDataset(task.dataset_id));
			const datasetId = dataset.id;
			delete dataset.id;
			const taskJson = { name: task.name, version: annotation_format_version, spec, dataset };

			// EXPORT task json
			if (req.body.path) {//export to local file system
				const err = utils.writeJSON(taskJson, `${exportPath}/${task.name}.json`);
				if (err) {
					return res.status(400).json({
						error: 'cannot_write',
						message: `Cannot write json file ${exportPath}/${task.name}.json`
					});
				}
			} else {//export to destination URL
				/// TODO: the task is not exported in Confiance
				// var err = '';
				// const url = req.body.url.endsWith('/') ? req.body.url+'_doc' : req.body.url+'/_doc';
				// await fetch(url+`/_doc`, {
				// 	method: 'post',
				// 	headers: { 'Content-Type': 'application/json' },
				// 	body: JSON.stringify( taskJson )
				// })// send POST request
				// .then(res => {
				// 	if (res.statusText=='OK') return res.json();
				// 	else console.log("KO :\n",res);
				// })
				// .then(res => { console.log(res);
				// }).catch((e) => { err = e; });
				// if (err) {
				// 	return res.status(400).json({
				// 		error: 'cannot_write',
				// 		message: `Cannot write json file '${task.name}.json'.\n\nERROR while calling ELASTIC:${err}`
				// 	});
				// }
			}

			if (req.body.path) {
				// Write annotations for each task in a specific folder
				var taskFolder = `${exportPath}/${task.name}`;
				// Remove existing folder
				utils.removeDir(taskFolder);
				// Recreate it
				fs.mkdirSync(taskFolder, function (err) {
					if (err) {
						console.log(err);
						return res.status(400).json({
							error: 'cannot_create',
							message: `ERROR! Can't create directory ${taskFolder}`
						});
					}
				});
			}

			// Write annotations
			const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(task.name), false, true);
			//BR
			console.log("BR streamLabels arg = ", dbkeys.keyForLabels(task.name));
			//console.log("BR streamLabels = ", streamLabels);
			for await (const labels of streamLabels) {
				resultData = await db.get(dbkeys.keyForResult(task.name, labels.data_id));//get the status for this data
				const data = await getDataDetails(datasetId, labels.data_id, true);
				delete data.id;
				delete data.dataset_id;
				delete data.thumbnail;
				data.status = resultData.status;//add the status
				let path = data.path;
				path = Array.isArray(path) ? path[0] : path;
				path = path.replace(dataset.path, '')
				const filename = utils.pathToFilename(path);

				let labelsJson = { ...labels, data };

				// EXPORT task json
				if (req.body.path) {//export to local file system
					const err = utils.writeJSON(labelsJson, `${taskFolder}/${filename}.json`);
					if (err) {
						return res.status(400).json({
							error: 'cannot_write',
							message: `Cannot write json file ${taskFolder}/${filename}.json`
						});
					}
				} else {//export to destination URL
					var err = '';
					console.log("labelsJson orig=", labelsJson);
					let url = req.body.url.endsWith('/') ? req.body.url + '_doc' : req.body.url + '/_doc';

					console.log("spec.plugin_name=", spec.plugin_name);
					//BR pour le moment on reste en MVP2021
					//const FORMAT_VERSION = 'MVP2022';
					const FORMAT_VERSION = 'MVP2021';
					if (FORMAT_VERSION === 'MVP2021') {
						console.log("FORMAT_VERSION=2021");
						if (spec.plugin_name === 'classification') {// CONFIANCE specific: adapt Body to temporary
							// real data:
							// {
							//     "task_name": "1",
							//     "data_id": "01.png",
							//     "annotations": [
							//         {
							//         "category": "class1",
							//         "options": {}
							//         }
							//     ],
							//     "data": {
							//         "type": "image",
							//         "path": "minio_saved_images/importedFromKafka/1/01.png",
							//         "children": ""
							//     }
							// }
							// wanted output:
							// {
							//     "id_data": "01.png",
							//     "value": {
							//         "value": true,
							//         "name": "blurred"
							//     },
							//     "actorId": "pixano_annotator1",
							//     "atorType": "annotator"
							// }
							var isBlurred = false;
							if (labelsJson.annotations.length) {
								if (labelsJson.annotations[0].category === 'blurred') isBlurred = true;
							};
							const labelsJson_confiance = {
								id_data: labelsJson.data_id,
								value: {
									value: isBlurred,
									name: 'blurred'
								},
								actorId: 'pixano_annotator1',
								actorType: 'annotator'
							};
							console.log("labelsJson_confiance=", JSON.stringify(labelsJson_confiance));
							// CONFIANCE: recompose url in order to use the same identifier then in elastic (enabling versionning)
							//     Exemple : PUT https://elasticsearch-ec5.confiance.irtsystemx.org/annotation_v2_test/_doc/190923-1805_2934305_ - C101_OK.jpgImage blurred totoPixano/
							//     data.id: 190923-1805_2934305_ - C101_OK.jpgImage
							//     state.name: Blurred
							//     annotation.actorId: totoPixano
							const url_confiance = url + '/' + labelsJson_confiance.id_data + ' ' + labelsJson_confiance.value.name + ' ' + labelsJson_confiance.actorId;
							console.log("url_confiance=", url_confiance);
							url = url_confiance;
							labelsJson = labelsJson_confiance;
						} else if (spec.plugin_name === 'smart-rectangle') {// CONFIANCE specific: adapt Body to temporary and publish separately each annotation
							// wanted output:
							// {
							//     "id_data": "Nom_imageImage",
							//     "value": {
							//         "value": {
							//             "geometry": {
							//                 "vertices": [
							//                     0.4166666666666667,
							//                     0.5740740740740741,
							//                     0.503125,
							//                     0.6944444444444444
							//                 ],
							//                 "type": "rectangle"
							//             },
							//             "category": "class3"
							//         },
							//         "name": "detection"
							//     },
							//     "selectionName": 'nom_selection_kafka',
							//     "actorId": "pixano_annotator1",
							//     "atorType": "Annotator"
							// }
							console.log("labelsJson.annotations=", labelsJson.annotations);
							for (const annotation of labelsJson.annotations) {
								const labelsJson_confiance = {
									id_data: labelsJson.data_id + 'Image',
									value: {
										value: annotation,
										name: 'detection'
									},
									selectionName: task.name,
									actorId: 'pixano_annotator1',
									atorType: 'annotator'
								};
								console.log("labelsJson_confiance=", JSON.stringify(labelsJson_confiance));
								// CONFIANCE: recompose url in order to use the same identifier then in elastic (enabling versionning)
								//     Exemple : PUT https://elasticsearch-ec5.confiance.irtsystemx.org/annotation_v4_valeo_test/_doc/Nom_image0.zve5sdgj9hfImage detection pixano_annotator1/
								//     data.id: Nom_image0.zve5sdgj9hfImage
								//     state.name: detection
								//     annotation.actorId: pixano_annotator1
								const url_confiance = url + '/' + labelsJson.data_id + annotation.id + 'Image' + ' ' + labelsJson_confiance.value.name + ' ' + labelsJson_confiance.actorId;
								console.log("url_confiance=", url_confiance);
								// CONFIANCE: exception, publish separately each annotation
								await fetch(url_confiance, {
									method: 'PUT',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(labelsJson_confiance)
								})// send POST request
									.then(res => {
										if (res.ok) return res.json();
										else throw new Error(res);//we have to trow ourself because fetch only throw on network errors, not on 4xx or 5xx errors
									}).catch((e) => { err += e; });
								if (err) console.log(`Could not write annotation ${annotation.id}`);
							}
							if (err) {
								return res.status(400).json({
									error: 'cannot_write',
									message: `Cannot write json file '${filename}.json'.\n\nERROR while calling ELASTIC:${err}`
								});
							}
							continue;//we already published the annotations
						}
					} else if (FORMAT_VERSION === 'MVP2022') {
						console.log("FORMAT_VERSION=2022");
						for (const annotation of labelsJson.annotations) {// CONFIANCE: exception, publish separately each annotation
							// wanted output:
							// {
							// 	"id": "unique id inside this input",
							// 	"id_data":"Nom_imageImage",
							// 	"selectionName":"nom_selection_kafka",
							// 	"actorId":"pixano_annotator1",
							// 	"actorType":"annotator",
							// 	"timestamp":"value",
							// 	"tracknum":"value",
							// 	"labels":{
							// 		"optionalParameter1":"value",
							// 		"optionalParameter2":"value"
							// 	},
							// 	"value":{
							// 		"category":"classname",
							// 		"geometry":{
							// 			"vertices":[
							// 				0.4166666666666667,
							// 				0.5740740740740741,
							// 				0.503125,
							// 				0.6944444444444444
							// 			],
							// 			"type":"rectangle"
							// 		}
							// 	}
							// }
							const labelsJson_confiance = {
								id: annotation.id,
								id_data: labelsJson.data_id + 'Image',
								selectionName: task.name,
								actorId: 'pixano_annotator1',
								actorType: 'annotator',
								labels: annotation.options,
								value: {
									category: annotation.category,
									geometry: annotation.geometry,
								},
							};
							console.log("labelsJson_confiance=", JSON.stringify(labelsJson_confiance));
							// CONFIANCE: recompose url in order to use the same identifier then in elastic (enabling versionning)
							//     Exemple : PUT https://opensearch-ec5.confiance.irtsystemx.org/annotation_v1/_doc/Nom_image0.zve5sdgj9hfImage detection pixano_annotator1/
							//     data.id: Nom_image0.zve5sdgj9hfImage
							//     state.name: detection
							//     annotation.actorId: pixano_annotator1

							//BR si annotation.id n'existe pas, ne rien mettre (?)
							//BR TODO formaliser les différents exports en fonctions plugins
							const url_confiance = url + '/' + labelsJson.data_id + ((annotation.id === undefined) ? '' : annotation.id) + 'Image' + ' ' + taskJson.spec.plugin_name + ' ' + labelsJson_confiance.actorId;
							//const url_confiance = url + '/' + labelsJson.data_id+annotation.id+'Image' + ' ' + taskJson.spec.plugin_name + ' ' + labelsJson_confiance.actorId;
							console.log("url_confiance=", url_confiance);
							// CONFIANCE: exception, publish separately each annotation

							await fetch(url_confiance, {
								method: 'PUT',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(labelsJson_confiance)
							})// send POST request
								.then(res => {
									if (res.ok) return res.json();
									else throw new Error(res);//we have to trow ourself because fetch only throw on network errors, not on 4xx or 5xx errors
								}).catch((e) => { err += e; });
							if (err) console.log(`Could not write annotation ${annotation.id}`);
						}
						if (err) {
							return res.status(400).json({
								error: 'cannot_write',
								message: `Cannot write json file '${filename}.json'.\n\nERROR while calling ELASTIC:${err}`
							});
						}
						continue;//we already published the annotations
					}
					console.log("labelsJson=", labelsJson);
					//BR url foireuse pendant tests --on va arreter d'inonder le rezo irt ;p 
					//await fetch("http://nowhere", {
					await fetch(url, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(labelsJson)
					})// send POST request
					.then(res => {
						if (res.ok) return res.json();
						else {
							throw new Error(res);//we have to trow ourself because fetch only throw on network errors, not on 4xx or 5xx errors
						}
					}).catch((e) => { err = e; });
					if (err) {
						return res.status(400).json({
							error: 'cannot_write',
							message: `Cannot write json file '${filename}.json'.\n\nERROR while calling ELASTIC:${err}`
						});
					}
				}
			} //END for labels
		} //END for tasks
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
				message: 'Corruption in id ' + req.params.task_name + ' ' + task.name
			});
		}

		try {
			const oldTask = await db.get(dbkeys.keyForTask(req.params.task_name));
			const oldSpec = await db.get(dbkeys.keyForSpec(oldTask.spec_id));
			const newSpec = { ...oldSpec, ...task.spec };
			await db.put(dbkeys.keyForSpec(newSpec.id), newSpec);
			res.status(201).json({});
		} catch (err) {
			return res.status(400).json({
				type: 'unknown',
				message: 'Unknown task or spec ' + req.params.task_name + ' ' + oldTask.spec_id
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
			message: 'Unknown task ' + req.params.task_name
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
	//    print();
	for await (const t of stream) {
		const spec = await db.get(dbkeys.keyForSpec(t.spec_id));
		const dataset = await db.get(dbkeys.keyForDataset(t.dataset_id));
		const taskDetail = { name: t.name, dataset, spec }
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
		const taskDetail = { name: taskName, dataset, spec };
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
		const path = utils.toRelative(dataData.path);
		// Generate result associated with each data
		const newResult = createResult(task.name, dataId, newJob.id, 'to_annotate', path);

		// Generate empty labels associated with each data
		const newLabels = {
			task_name: task.name,
			data_id: dataId,
			annotations: []
		};

		await bm.add({ type: 'put', key: dbkeys.keyForJob(task.name, newJob.id), value: newJob });
		await bm.add({ type: 'put', key: dbkeys.keyForResult(task.name, newResult.data_id), value: newResult });
		await bm.add({ type: 'put', key: dbkeys.keyForLabels(task.name, newLabels.data_id), value: newLabels });
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
	await bm.add({ type: 'del', key });

	// delete associated jobs
	const streamJob = utils.iterateOnDB(db, dbkeys.keyForJob(taskName), false, true);
	for await (const job of streamJob) {
		await bm.add({ type: 'del', key: dbkeys.keyForJob(taskName, job.id) });
	}

	// delete associated result
	const streamResults = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
	for await (const result of streamResults) {
		await bm.add({ type: 'del', key: dbkeys.keyForResult(taskName, result.data_id) });
	}

	// delete associated labels WARNING !!!!
	const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(taskName), false, true);
	for await (const label of streamLabels) {
		await bm.add({ type: 'del', key: dbkeys.keyForLabels(taskName, label.data_id) });
	}

	// delete associated user information
	const streamUsers = utils.iterateOnDB(db, dbkeys.keyForUser(), false, true);
	for await (const user of streamUsers) {
		['to_annotate', 'to_validate', 'to_correct'].forEach((obj) => {
			// Delete assigned or queued jobs
			delete user.curr_assigned_jobs[taskName + '/' + obj];
			delete user.queue[taskName + '/' + obj];
		});
		await bm.add({ type: 'put', key: dbkeys.keyForUser(user.username), value: user })
	}

	// delete associated spec (if not used by any other task)
	let foundAssociation = false;
	let stream = utils.iterateOnDB(db, dbkeys.keyForTask(), false, true);
	for await (const t of stream) {
		if (t.name !== taskData.name && t.spec_id === taskData.spec_id) {
			foundAssociation = true;
			break;
		}
	}
	if (!foundAssociation) {
		await bm.add({ type: 'del', key: dbkeys.keyForSpec(taskData.spec_id) });
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
