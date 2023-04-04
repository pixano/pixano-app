const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const { db, workspace, print } = require('../config/db');
const dbkeys = require('../config/db-keys');
const batchManager = require('../helpers/batch-manager');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');
const { getOrcreateSpec } = require('./specs');
const { getOrcreateDataset, getAllDataFromDataset,
	getAllPathsFromDataset,
	getDataDetails } = require('./datasets');
const { downloadFilesFromMinio } = require('./minio_plugin').default;
const { createJob } = require('./jobs');
const fetch = require("node-fetch");
const palette = require('google-palette');
const turf = require('@turf/turf');


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


/**********************************************************************************/
/*****************************   DATA PROVIDER IMPORT  ****************************/
/**********************************************************************************/

async function get_dp(url, queryparams = {}) {
	const dp_host = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.dataProvider });
	let final_url = dp_host + url;
	if(queryparams.length > 0) {
		final_url = final_url + new URLSearchParams(queryparams);
	} 
	return await fetch(dp_host + url, { method: 'get', headers: { 'Content-Type': 'application/json' } })
		.then(res => {
			if (res.statusText == 'OK') { return res.json().then(data => Promise.resolve(data)); }
			else { return res.status(200).json({ message: 'Response error: ' + res }); }
		})
		.catch(err => { return Promise.reject(err); });
}

async function get_dp_minio_uris(project_name, ids) {
	//TODO: slice ids in batches !
	const dp_host = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.dataProvider });
	return await fetch(dp_host + "/project/" + project_name + "/data", {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ids)
	})
		.then(res => {
			if (res.statusText == 'OK') {
				return res.json().then(data => {
					if (data == {}) { return Promise.reject() } else { return Promise.resolve(data) }
				})
			} else { return res.status(200).json({ message: 'Response error: ' + res }) };
		})
		.catch(err => { return Promise.reject(err); });
}

/**
 * @api {post} /datasets/projects_from_dataprovider get projects list from confiance dp
 * @apiName GetProjsFromDP
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Error in DP import
 *     HTTP/1.1 401 Unauthorized
 */
async function projects_from_dataprovider(req, res) {
	checkAdmin(req, async () => {
		console.log('##### Importing project list from dataprovider');
		return await get_dp("/debiai/projects");
	})
		.then(projs => { return res.status(200).send(projs); })
		.catch(err => { return res.status(400).send(err); })
}

/**
 * @api {post} /datasets/selections_from_dataprovider get projects list from confiance dp
 * @apiName GetSelectionsFromDP
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Error in DP import
 *     HTTP/1.1 401 Unauthorized
 */
async function selections_from_dataprovider(req, res) {
	return await checkAdmin(req, async () => {
		console.log('##### Importing selections from dataprovider');
		//console.log('##### BR req.params:', req.params);
		return await get_dp("/debiai/projects/" + req.params.project_name + "/selections").then(res => res);
	})
		.then((selections) => { return res.status(200).send(selections); })
		.catch(err => { return res.status(400).send(err); })
}

/**
 * @api {post} /datasets/id_list_from_dataprovider get id list from confiance dp
 * @apiName GetIdListFromDP
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Error in DP import
 *     HTTP/1.1 401 Unauthorized
 */
//TODO renommer, elle fait tout maintenent : creation Dataset + Task
async function id_list_from_dataprovider(req, res) {
	return await checkAdmin(req, async () => {
		console.log('##### Importing id list from dataprovider');
		//console.log('##### BR req.params:', req.params);
		if (req.params.sel_id === "ALL" && req.params.sel_name === "ALL") {
			//return --Full list of ids--
			return await get_dp("/debiai/projects/" + req.params.project_name + "/data-id-list", {from: 0, to: req.params.sel_nbSamples}).then(res => res);
		} else {
			return await get_dp("/debiai/projects/" + req.params.project_name + "/selections/" + req.params.sel_id + "/selected-data-id-list").then(res => res);
		}
	})
	.then(async (selections) => {
		task = await process_selection(req.params.project_name, req.params.sel_name, selections)
			//.then(res => { return res })
			.catch(err => { throw err })
		console.log("Created Task", task);
		return res.status(200).send(task);
	})
	.catch(err => {
		console.log("ERREUR in id_list_from_dataprovider:", err);
		return res.status(400).json({ message: err });
	})
}

//// remaniement, ce n'est plus une API --nom temporaire, j'ai pas mieux en stock
// get infos on "selections" from data-provider (dp_info)
// extract minio paths from dp_info
// get images from minio
// create Dataset
// extract annotations from dp_info
// create Task
async function process_selection(project_name, sel_name, selections) {
	console.log('##### Importing Minio uris from dataprovider');
	dp_res = await get_dp_minio_uris(project_name, selections)
		.catch(err => { throw "Error in get_dp_minio_uris " + err });
	//console.log("dp_res FULL", dp_res);
	let minio_files = {}

	if (!dp_res || dp_res.length == 0) { throw "ERROR empty data for selection"; }
	Object.keys(dp_res).forEach(key => {
		//console.log("dp_res[", key, "].storage", dp_res[key].storage);
		//console.log("dp_res[", key, "].annotations", dp_res[key].annotations);
		if (!dp_res[key].storage) { throw "No storage info in selection, import aborted"; }
		if (!dp_res[key].storage.minio) { throw "No minio storage info in selection, import aborted"; }
		if (!dp_res[key].storage.minio.bucket_name && !dp_res[key].storage.minio.bucket) { throw "No minio bucket[_name] info in selection, import aborted"; }
		if (!dp_res[key].storage.minio.basepath) { throw "No minio basepath info in selection, import aborted"; }
		bname = "";
		if (dp_res[key].storage.minio.bucket) {
			bname = dp_res[key].storage.minio.bucket;
		} else {
			bname = dp_res[key].storage.minio.bucket_name;
		}
		bpath = dp_res[key].storage.minio.basepath;
		if (bpath.startsWith(bname)) {
			//slice parce que le bucket est mis en prefixe du path !!
			bpath_clean = bpath.slice(bname.length);
		}
		if (!(bpath in minio_files)) { minio_files[bpath] = [] }
		minio_files[bpath].push({ 'bucket': bname, 'path': bpath_clean, 'file': dp_res[key].storage.filename })
	});
	//console.log("XXXXX - buckets:", minio_files);

	console.log('# 1) Create a new dataset');
	console.log('# 1.1) get/set members');
	sel_name = sel_name.replace(/\s/g, '_');
	outpath = project_name.replace(/\s/g, '_') + "_" + sel_name
	let dataset = {};
	dataset.date = Date.now();
	dataset.path = 'importedFromDebiai/' + outpath;
	dataset.id = outpath;
	dataset.data_type = 'image'  // TODO: gérer autres cas... //'remote_image'
	console.log("dataset=", dataset);
	console.log('# 1.2) getPathFromIds');
	dataset.urlList = await downloadFilesFromMinio(minio_files, workspace, outpath).catch((e) => {
		console.error('Error in Minio import\n' + e);
		throw 'Error in Minio import\n' + e;
	})

	console.log("dataset.urlList", dataset.urlList);

	console.log('# 1.3) getImagesFromPath');
	const newDataset = await getOrcreateDataset(dataset, workspace);
	if (newDataset) {
		const task = await createTasksFromDPImport(dp_res, newDataset)
			.catch(err => {
				console.log("Error while creating task", err);
				throw 'Error while creating task:' + err;
			});
		//console.log("Task", task);
		return task;
	} else throw 'Error while creating dataset';
}

async function createTasksFromDPImport(dp_res, dataset) {
	let dp_info = []
	//TODO gerer le fait qu'on recupère pleins de fois les infos de task...
	// que faire si différentes ?
	const task_types = new Set();
	const class_list = new Set();
	const class_defs = {};
	const found_options = {};
	//console.log("DP_RES FULL", dp_res);
	Object.keys(dp_res).forEach(key => {
		Object.keys(dp_res[key].annotations).forEach(ann_key => {
			let ann = dp_res[key].annotations[ann_key];
			//console.log("dp_res annotation", ann);
			if (Array.isArray(ann)) {
				// TMP we take [0] because it's a list for several annotator, we take the first (???)
				ann = ann[0];   //case of different annotators, we take first(last?) one only for now
			}
			let task_type = String(ann.type).toLowerCase();
			//tmp
			const accepted_types = ['classification', 'object_detection']
			if (!accepted_types.includes(task_type)) {
				//try to infer type based on first annotation
				if (ann.items && ann.items.length > 0 && ann.items[0].geometry) {
					console.log("WARNING annotation type not defined, geometry detected, type = object_detection")
					task_type = 'object_detection';
				} else {
					console.log("WARNING annotation type not defined, default to classification")
					task_type = 'classification';
				}
			}
			if (task_type === "classification") {
				options = {};
				options[ann_key] = ann.value;
				cl_ann = {
					category: task_type,
					options: options,
					//actorId etc.
				}
				dp_info.push({
					//id: key,  //ou plutot dp_res[key].storage. ?? imageid ?
					file: dp_res[key].storage.filename,
					id: dp_res[key].id,
					//name: ann_key,   //-> blurred, object_detection_vdp, ... 
					type: task_type,
					anns: [cl_ann]
				});
				class_list.add(ann_key);
				class_defs[ann_key] = typeof ann.value;
			} else if (task_type === "object_detection") {
				const geom_types = new Set();
				//TOADD if(ann.subitems// == true)
				//console.log("WWWW object_detection", ann.items);
				for (it of ann.items) {
					class_list.add(it['category']);
					class_defs[it['category']] = it['geometry'].type; //keep it (? : unused actually) because we need to differentiate polygon/mpolygon 
					// mapping geometry -> plugin
					geom = it['geometry'].type
					if (geom === "mpolygon" || geom === "multi_polygon") geom = "polygon"
					geom_types.add(geom);
					if (!found_options.hasOwnProperty(it['category'])) found_options[it['category']] = new Set();
					Object.entries(it['options']).forEach(([k, v]) => found_options[it['category']].add(JSON.stringify([k, typeof(v)])));
				}
				if (geom_types.size > 1) {
					console.log("WARNING: Several types of object geometry, this is not implemented yet", geom_types)
				}
				task_type = geom_types.values().next().value;
				//TODO
				dp_info.push({
					//id: key,   //ou plutot dp_res[key].storage. ?? imageid ?
					file: dp_res[key].storage.filename,
					id: dp_res[key].id,
					//name: ann_key,
					type: task_type,
					anns: ann.items,
					//...
				})
			} else {
				//TODO ... autres types d'annotations
				console.log("Unimplemented annotation type:"), task_type;
			}

			task_types.add(task_type);
		});
	});
	//console.log("dataset", dataset);
	//console.log("dataset id", dataset['id']);

	const importedTasks = [];
	for (let task_type of task_types) {
		let task;
		const plugin_name = task_type;
		const task_name = dataset['id']; // + "_task";
		//cas classif
		if (task_type === "classification") {
			let props = [];
			for (let classe of class_list) {
				if (class_defs[classe] === 'boolean') {
					props.push({ name: classe, type: 'checkbox', default: false })
				} else if (class_defs[classe] === 'string') {
					props.push({ name: classe, type: 'textfield', default: "" })
				} //... else ???
			}
			classif_label_value = {
				category: [
					{
						name: task_type,
						color: "black",
						properties: props
					}
				],
				default: 'classification'
			}

			task = {
				name: task_name,
				spec: {
					plugin_name: plugin_name,
					label_schema: classif_label_value,  // defaultLabelValues(plugin_name),
					settings: {},  //TMP defaultSettings(plugin_name),
					data_type: dataset.type
				},
				dataset: dataset
			};
		} else { //cas non classif
			let cats = [];
			let icol = 0;
			const col_seq = palette('mpn65', class_list.size);
			for (let classe of class_list) {
				//console.log("Classe", classe, icol);
				//console.log(" class [option, type]:", found_options[classe]);
				let props = [];
				const computed_opts = ['min_x', 'max_x', 'min_y', 'max_y', 'centroid_x', 'centroid_y', 'area'];
				if(found_options.hasOwnProperty(classe)) {
					for(opt_json of found_options[classe]) {
						opt = JSON.parse(opt_json);
						opt_name = opt[0];
						opt_type = opt[1];
						if(!computed_opts.includes(opt_name)) {
							if (opt_type === 'boolean') {
								props.push({ name: opt_name, type: 'checkbox', default: false })
							} else if (opt_type === 'string') {
								props.push({ name: opt_name, type: 'textfield', default: "" })
							} else if (opt_type === 'number') {
								props.push({ name: opt_name, type: 'textfield', default: "" })
							} //... else ???
						}
					}
				}
				cats.push({
					name: classe,
					color: "#" + col_seq[icol],
					properties: props
				});
				icol++;
			}

			objdetect_label_value = {
				category: cats,
				default: cats[0].name
			}

			task = {
				name: task_name,
				spec: {
					plugin_name: plugin_name,
					label_schema: objdetect_label_value,  // defaultLabelValues(plugin_name),
					settings: {},  //TMP defaultSettings(plugin_name),
					data_type: dataset.type
				},
				dataset: dataset
			};
		}

		const spec = await getOrcreateSpec(task.spec);

		// managing task with same name
		let newTaskName = task.name;
		try {
			// check if task already exist and search for another name
			let cpt = 1;
			do {
				await db.get(dbkeys.keyForTask(newTaskName));
				newTaskName = `${task.name}-${cpt}`;
				cpt += 1;
			} while (true)
		} catch (err) {
			// task with this updated name does not exist, use this name
			task.name = newTaskName;
		}

		console.log('# 2) Push the new task + dataset');
		// Task does not exist create it
		const newTask = { name: newTaskName, dataset_id: dataset.id, spec_id: spec.id }
		const bm = new batchManager.BatchManager(db);
		await bm.add({ type: 'put', key: dbkeys.keyForTask(newTask.name), value: newTask })  //why ???
		await db.put(dbkeys.keyForTask(newTask.name), newTask);
		// Generate first job list
		await generateJobResultAndLabelsLists(newTask);
		// Send back the created task
		const taskDetail = await getTaskDetails(newTask.name);
		console.log('Task created', taskDetail.name)
		for (dp of dp_info) {
			if (dp.type == task_type) {
				// Create Labels
				const newLabels = {
					task_name: newTask.name,
					data_id: dp.file,
					dp_id: dp.id,
					annotations: dp.anns
				};
				//console.log("Label to add", newLabels, newLabels.annotations);
				await bm.add({ type: 'put', key: dbkeys.keyForLabels(newTask.name, newLabels.data_id), value: newLabels });
				/** TMP On ne gere pas encore le statut (to_validate, to_annotate, ...) 
				if (ann.data.status) {//if existing, get status back
					resultData = await db.get(dbkeys.keyForResult(newTask.name, newLabels.data_id));//get the status for this data
					resultData.status = ann.data.status;//add the status
					await bm.add({ type: 'put', key: dbkeys.keyForResult(newTask.name, newLabels.data_id), value: resultData });
				}
				**/
			}
		}
		await bm.flush();
		importedTasks.push(newTask);
	}
	return importedTasks;
}



/**********************************************************************************/
/*****************************   DATA PROVIDER EXPORT  ****************************/
/**********************************************************************************/

async function patch_dp(project_id, ann) {
	const dp_host = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.dataProvider });
	//console.log('PATCH_DP host', dp_host);
	return await fetch(dp_host + "/project/" + project_id + "/annotations", {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ann)
	})
		.then(res => {
			if (res.statusText == 'OK') {
				return Promise.resolve(res);
			} else {
				return Promise.reject(res);
			}
		})
		.catch(async err => {
			return Promise.reject(err);
		});
}


function get_polygon_centroid(poly) {
	// poly : [ x0, y0, x1 , y1, ...]  --> [{x: x0, y: y0}, {x: x1, y: y1}, ...]
	let pts = []
	for (let i = 0; i<poly.length; i=i+2) {
		pts.push({x: poly[i], y: poly[i+1]});
	}

	var first = pts[0], last = pts[pts.length-1];
	if (first.x != last.x || first.y != last.y) pts.push(first);
	var twicearea=0,
	x=0, y=0,
	nPts = pts.length,
	p1, p2, f;
	for ( var i=0, j=nPts-1 ; i<nPts ; j=i++ ) {
	   p1 = pts[i]; p2 = pts[j];
	   f = (p1.y - first.y) * (p2.x - first.x) - (p2.y - first.y) * (p1.x - first.x);
	   twicearea += f;
	   x += (p1.x + p2.x - 2 * first.x) * f;
	   y += (p1.y + p2.y - 2 * first.y) * f;
	}
	f = twicearea * 3;
	return { x:x/f + first.x, y:y/f + first.y };
 }

 function polygonArea(poly)  {    
	// poly = [ x0, y0, x1 , y1, ...]
	const numPoints = poly.length / 2;
	let area = 0;  // Accumulates area in the loop   
	j = numPoints-1;  // The last vertex is the 'previous' one to the first

	for (i=0; i<numPoints; i++) {
		area = area +  (poly[2*j]+poly[2*i]) * (poly[2*j+1]-poly[2*i+1]); 
      	j = i;  //j is previous vertex to i
  	}   
  	return Math.abs(area/2); 
}

function polygonMinMax(poly)  {    
	// poly = [ x0, y0, x1 , y1, ...]
	let minx, miny, maxx, maxy;
	for (i=0; i<poly.length; i++) {
		if (i%2 == 0) {
			minx = minx ? Math.min(minx, poly[i]) : poly[i]
			maxx = maxx ? Math.max(maxx, poly[i]) : poly[i]
		} else {
			miny = miny ? Math.min(miny, poly[i]) : poly[i]
			maxy = maxy ? Math.max(maxy, poly[i]) : poly[i]
		}
  	}   
  	return [minx, maxx, miny, maxy];
}

function computeDebiAIFeats(geometry) {
	const mpoly = (geometry.mvertices && geometry.mvertices.length>0)? geometry.mvertices : [geometry.vertices];
	let minx, miny, maxx, maxy;
	let centroidx = 0, centroidy = 0, area = 0;
	for (poly of mpoly) { 
		const minmax = polygonMinMax(poly);
		const centroid = get_polygon_centroid(poly);
		minx =  minx ? Math.min(minmax[0], minx): minmax[0];
		maxx =  maxx ? Math.max(minmax[1], maxx): minmax[1];
		miny =  miny ? Math.min(minmax[2], miny): minmax[2];
		maxy =  maxy ? Math.max(minmax[3], maxy): minmax[3];
		centroidx += centroid.x;
		centroidy += centroid.y;
		area += polygonArea(poly);
	}
	centroidx = centroidx / mpoly.length;
	centroidy = centroidy / mpoly.length;
	return {
		min_x: minx,
		max_x: maxx,
		min_y: miny,
		max_y: maxy,
		centroid_x: centroidx,
		centroid_y: centroidy,
		area: area
	}
}


/**
 * @api {post} /tasks/partial_export_to_dataprovider Export annotations for an image (/sequence?) to Confiance DP
 * @apiName PostPartialExportTasksToDP
 * @apiGroup Tasks
 * @apiPermission admin
 * 
 * @apiParam Task name
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Failed to create export folder
 */
async function partial_export_to_dataprovider(req, res) {
	const ret = await checkAdmin(req, async () => {
		console.log("partial_export_to_dataprovider", req.params);
		const task_name = req.params.task_name;
		const media_id = req.params.media_id;

		//get projects list from DP to select project corresponding with current task
		const projs = await get_dp("/debiai/projects").catch(err => { throw "Unable to get project list from Confiance DB, aborting export\n"+ err;})
		//console.log("projs", Object.keys(projs));
		const projects_name = Object.keys(projs).filter((p) => task_name.startsWith(p));
		let project_name = ""
		if (projects_name.length == 1) {
			project_name = projects_name[0];
		} else if (projects_name.length > 1) {
			console.log("Warning, several projects match this task name, choosing first one amongst", projects_name);
			project_name = projects_name[0];
		} else {
			throw "Error, no matching project, aborting export";
		}

		const task = await db.get(dbkeys.keyForTask(task_name));
		const spec = await db.get(dbkeys.keyForSpec(task.spec_id));

		// Write annotations
		let ann = {};
		const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(task.name), false, true);
		//The following SHOULD work, so we could get rid of the "NOT media_id (skipping)"" hack... But it doesn't work badly!!
		//const streamLabels = utils.iterateOnDB(db, dbkeys.keyForLabels(task.name, media_id), false, true);
		for await (const labels of streamLabels) {
			if (labels.data_id !== media_id) {
				//console.log("NOT", media_id, "(skipping)");
				continue;
			}

			//console.log("BR label = ", labels);
			
			resultData = await db.get(dbkeys.keyForResult(task.name, labels.data_id));//get the status for this data
			const user = await db.get(dbkeys.keyForUser(resultData.validator));   //BR? validator or annotator
			//console.log("resultData", resultData);
			//console.log("user", user);

			//some info that we actually don't need to export
			/*  
			const data = await getDataDetails(datasetId, labels.data_id, true);
			delete data.id;
			delete data.dataset_id;
			delete data.thumbnail;
			data.status = resultData.status;//add the status
			console.log("DATA", data);
			//let labelsJson = { ...labels, data };
			*/
			let labelsJson = { ...labels };
			//console.log("LabelsJson", labelsJson);

			const labelsJson_confiance = {
				actorId: user.username,
				actorType: 'annotator',  //BR? user.role (admin | user)  or [annotator | validator]
				samplesAnnotations: []
			}
			//TODO completer liste plugins "objet detection" compatibles avec ce format
			const object_detection_plugins = ["polygon", "segmentation", "smart-polygon", "smart-segmentation"];
			if (spec.plugin_name === "classification") {
				for (const annotation of labelsJson.annotations) {
					labelsJson_confiance.samplesAnnotations.push({
						id: labelsJson.dp_id,
						type: spec.plugin_name,
						name: Object.keys(annotation.options)[0],
						value: annotation.options[cls_name]
					});
				}
			} else if (object_detection_plugins.includes(spec.plugin_name)) {
				//VDP case, we have all our pixano items in 'obstacles'
				labelsJson_confiance.samplesAnnotations.push({
					id: labelsJson.data_id,   //or .dp_id,  which one??
					name: 'obstacles',    //TMP, we can get this in import
					type: 'object_detection',
					value: []
				});
				//TODO: compute centroids etc.
				for (const annotation of labelsJson.annotations) {
					//console.log("ANN", annotation.options);
					const computed_options = computeDebiAIFeats(annotation.geometry);
					let new_options = {...annotation.options, ...computed_options};
					labelsJson_confiance.samplesAnnotations[0].value.push({
						id: annotation.id,
						category: annotation.category,
						geometry: annotation.geometry,
						options: new_options
					})
				}
			} else {
				throw "ERROR Unsupported plugin for Confiance Export" + spec.plugin_name;
			}
			//console.log("labelsJson_confiance=", labelsJson_confiance);
			//console.log("jsonified ann=", JSON.stringify(labelsJson_confiance));
			//console.log("proj=", project_name);
			
			const result = await patch_dp(project_name, labelsJson_confiance)
				.catch(async err => {
					const err_txt = await err.text();
					console.log("ERROR (A) partial export :", err_txt);
					return `ERROR (A) while exporting to Confiance DB.\n${err_txt}`;
					//throw res; //we have to throw ourself because fetch only throw on network errors, not on 4xx or 5xx errors
				});
			if (result.statusText !== 'OK') {
				console.log("ERROR (B) partial export :", utils.extract_body(result));
				return result;
			}
		} //end labels
		console.log("Partial export OK");
		return "OK";
	}).catch(err => { console.log("CATCH", err); return err});
	if(ret === "OK") return res.json({ message: ret });
	else {
		const ret_txt = `${ret}`;
		return res.status(500).json({ message: ret_txt });
	}
}

/**
 * @api {post} /tasks/export_tasks_to_dataprovider Export annotations to Confiance DP
 * @apiName PostExportTasksToDP
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
async function export_tasks_to_dataprovider(req, res) {
	checkAdmin(req, async () => {
		//TODO
		// on va d'abord faire l'export incrémental (sur chaque "submit")
	})
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
	partial_export_to_dataprovider,
	export_tasks_to_dataprovider,
	projects_from_dataprovider,
	selections_from_dataprovider,
	id_list_from_dataprovider,
	export_tasks,
	getAllTasksDetails,
	createTasksFromDPImport
}
