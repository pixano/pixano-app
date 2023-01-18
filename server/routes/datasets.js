const path = require('path');
const { db, workspace } = require('../config/db');
const batchManager = require('../helpers/batch-manager');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');
const populator = require('../helpers/data-populator');
const { elise_remove_image } = require('../routes/elise_plugin.js');// ELISE
const { getSelectionFromKafka } = require('./kafka_plugin');
const { downloadFilesFromMinio } = require('./minio_plugin');
const fetch = require("node-fetch");

/**
 * @api {get} /datasets Get list of datasets
 * @apiName GetDatasets
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [{
 *        id: "random_string";
 *        path: "images/"; // relative to workspace
 *        data_type: "image"
 *     }]: DbDataset[]
 * 
 */
async function get_datasets(req, res) {
	checkAdmin(req, async () => {
		try {
			const datasets = [];
			const stream = utils.iterateOnDB(db, dbkeys.keyForDataset(), true, true);
			for await (const { key, value } of stream) {
				if (key.split(':').length == 2) {
					datasets.push(value)
				}
			}
			return res.send(datasets);
		} catch (err) {
			return res.status(400).json({ message: 'Error searching datasets' });
		}
	});
}

/**
 * @api {post} /datasets Add new dataset
 * @apiName PostDatasets
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 204 Dataset already existing
 */
async function post_datasets(req, res) {
	checkAdmin(req, async () => {
		const dataset = req.body;
		const newDataset = await getOrcreateDataset(dataset, workspace)
		if (newDataset) return res.status(201).json(newDataset);
		else return res.status(204).json({});
	});
}

/**
 * @api {post} /datasets/:dataset_id/from Create a sub-dataset from a selection inside an existing one
 * @apiName PostDatasetsFrom
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 204 Dataset already existing
 */
async function post_dataset_from(req, res) {
	checkAdmin(req, async () => {
		const data_ids = req.body.data_ids;
		const ref_dataset_id = req.body.ref_dataset_id;
		const datasetId = req.params.dataset_id;
		// verify that the new dataset id does not exist
		const existingDatasetId = await getDatasetFromId(db, datasetId);
		if (existingDatasetId) return res.status(204).json({});
		// create the sub-dataset
		let refDataset = await db.get(dbkeys.keyForDataset(ref_dataset_id));
		refDataset.id = datasetId;
		refDataset.ref_dataset_id = ref_dataset_id;
		await db.put(dbkeys.keyForDataset(datasetId), refDataset);
		// populate the dataset
		const bm = new batchManager.BatchManager(db);
		const stream = utils.iterateOnDB(db, dbkeys.keyForData(ref_dataset_id), true, true);
		for await (const { key, value } of stream) {
			if (key.split(':').length === 3) {
				if (data_ids.includes(value.id)) {
					let newValue = {...value};
					newValue.dataset_id = datasetId;
					await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, newValue.id), value: newValue });
				}
			}
		}
		await bm.flush();
		return res.status(201).json(refDataset);
	});
}

/**
 * @api {post} /datasets/import_from_dataprovider Import a dataset from confiance dp+minio
 * @apiName GetDatasetsFromDP
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
 *     HTTP/1.1 404 Error in Minio import
 *     HTTP/1.1 400 Error while creating dataset
 *     HTTP/1.1 401 Unauthorized
 */
async function import_dataset_from_dataprovider(req, res) {
	console.log("import_dataset_from_dataprovider");
	// tmp : a recup dans config ou cli ou ?
	const dp_host = "http://127.0.0.1:3011"
	checkAdmin(req, async () => {
		console.log('##### Importing from dataprovider');
		const projs = await get_project_list(dp_host).then(res => {return res});

		//project selector 
		//tmp :p
		const proj = projs['vdp_v4_test_2_new_struct_60k']
		console.log("BR1", proj.name);

		const selections = await get_selection_list(dp_host, proj.name).then(res => {return res});

		//selection selector 
		//tmp :p
		const sel = selections[0]
		console.log("BR2", sel);

		const ids = await get_id_list(dp_host, proj.name, sel.id).then(res => {return res});
		console.log("BR3", ids);

		const uris = await get_minio_uris(dp_host, proj.name, ids).then(res => {return res});
		console.log("BR4", uris);

	});

	return res.status(400).json({ message: 'Not fully implemented yet' });
}

async function get_project_list(dp_host) {
	return await fetch(dp_host+"/debiai/info", { method: 'get', headers: { 'Content-Type': 'application/json' } })
	.then(res => {
		if (res.statusText == 'OK') {return res.json().then(data => {return data})}
		else return res.status(200).json({ message: 'Response error: '+res });
	})
	.catch(res => { return res.status(200).json({ message: 'Network error: '+res })});
}

async function get_selection_list(dp_host, proj_name) {
	return await fetch(dp_host+"/debiai/view/"+proj_name+"/selections", { method: 'get', headers: { 'Content-Type': 'application/json' } })
	.then(res => {
		if (res.statusText == 'OK') {return res.json().then(data => {return data})}
		else return res.status(200).json({ message: 'Response error: '+res });
	})
	.catch(res => { return res.status(200).json({ message: 'Network error: '+res })});
}

async function get_id_list(dp_host, proj_name, sel_id) {
	return await fetch(dp_host+"/debiai/view/"+proj_name+"/selection/"+sel_id+"/selectedDataIdList", { method: 'get', headers: { 'Content-Type': 'application/json' } })
	.then(res => {
		if (res.statusText == 'OK') {return res.json().then(data => {return data})}
		else return res.status(200).json({ message: 'Response error: '+res });
	})
	.catch(res => { return res.status(200).json({ message: 'Network error: '+res })});
}

async function get_minio_uris(dp_host, proj_name, ids) {
	return await fetch(dp_host+"/project/"+proj_name+"/data", { 
		method: 'POST', 
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ids)
	 })
	.then(res => {
		if (res.statusText == 'OK') {return res.json().then(data => {return data})}
		else return res.status(200).json({ message: 'Response error: '+res });
	})
	.catch(res => { return res.status(200).json({ message: 'Network error: '+res })});
}

/**
 * @api {post} /datasets/import_from_kafka Import a dataset from kafka+minio
 * @apiName GetDatasetsFromKafka
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Error in Kafka import
 *     HTTP/1.1 404 Error in Minio import
 *     HTTP/1.1 400 Error while creating dataset
 *     HTTP/1.1 401 Unauthorized
 */
async function import_dataset_from_kafka(req, res) {
	console.log("import_dataset_from_kafka");
	checkAdmin(req, async () => {
		console.log('##### Importing from KAFKA');
		var kafkaSelection;
		const in_confiance = false;
		if (!in_confiance) {
			//BR fake Kafka (actually real one but faked import) for dev outside Confiance
			kafkaSelection = { sample_ids:
				[ { id: 'tjczulrnsy' },
				  { id: 'toljohjgfu' },
				  { id: 'eltounnrud' },
				  { id: 'eygrusipxu' } ],
			   project_name: 'vdp_v4_demo_test',
			   selection_name: 'DebiAI Selection VDP 75',
			   date: 1670510023.6422513 }
		} else {
			kafkaSelection = await getSelectionFromKafka().catch((e) => {
				console.error('Error in Kafka import\n'+e);
				return res.status(404).json({ message: 'Error in Kafka import\n'+e });
			});
		}
		//BR tpo (trop long pour le log qd ca bug!!) 
		//console.log("kafkaSelection=",kafkaSelection);
		

		console.log('# 1) Create a new dataset');
		console.log('# 1.1) get/set members');
		let dataset = {};
		dataset.date = kafkaSelection.date;
		dataset.path = 'importedFromKafka/'+kafkaSelection.selection_name;
		dataset.id = kafkaSelection.project_name + "_" + kafkaSelection.selection_name;
		dataset.data_type = kafkaSelection.data_type ? kafkaSelection.data_type : dataset.data_type = 'image';// ... TODO : set to 'remote_image' when minio will work without local copy
		console.log("dataset=",dataset);
		console.log('# 1.2) getPathFromIds');

		/*** BR: format (actuel, peut-être sujet à modifs)
		 * 
{
    "date": 1665576743.3672486,
    "origine": "Active Learning init_al",
    "project_name": "AL yolov5",
    "sample_ids": [
        {
            "id": "000000000436.jpgImage"
        },
        {
            "id": "000000000400.jpgImage"
        }
    ],
    "selection_name": "AL__50_init_al",
    "storage": {
        "type": "minio", # NFS , Local, etc.
        "path": "bucket_name"    # peut-etre deviendra: bucket_name et bucket_path (chemin dans le bucket)
    },
    "destination": "Pixano",
    "task": {
        "name": "object detection", # segmentation, classification, etc. 
        "task_information": [
            {
                "classe": "A"
            },
            {
                "classe": "B"
            },
            {
                "classe": "C"
            },
            {
                "classe": "D"
            }
        ]
    }
}
		 * 
		 * a noter que dans le cas d'un import de selection provenant de DebiAI
		 * on a pas la propriete "task" (a priori), vu que DebiAI n'a pas vraiment de raison de la connaitre
		 * (et peut être pas "storage" non plus)
		 * ---> d'apres mail Ahmed du 12/10, si...
		 * DU COUP(?), il faut trouver un moyen pour avoir la correspondance (avec "project_name" ?)
		 * => il faut que ces infos aient été stockées qqpart au préalable
		 * (LevelDB? OpenSearch?)
		 * 
		 * ----> le bucket n'est plus fixe, mais indiqué dans "storage"

		TODO: tout à remanier...

		 */


		//BR tmp minio vide, we fake some url
		if (/*!in_confiance*/false) {
			dataset.urlList = ""; //???
		} else {
			dataset.urlList = await downloadFilesFromMinio(kafkaSelection.sample_ids,workspace,kafkaSelection.selection_name, kafkaSelection.project_name).catch((e) => {
				console.error('Error in Minio import\n'+e);
				return res.status(404).json({ message: 'Error in Minio import\n'+e });
			});
		}
		console.log('# 1.3) getImagesFromPath');
		const newDataset = await getOrcreateDataset(dataset, workspace);
		//BR task ?
		console.log("BR import_dataset_from_kafka req:", req.body);

		// send created dataset
		if (newDataset) return res.status(201).json(newDataset);
		else return res.status(400).json({ message: 'Error while creating dataset' });
	});
}

/**
 * @api {get} /datasets/:dataset_id Get dataset detail
 * @apiName GetDataset
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        id: "random_string";
 *        path: "images/"; // relative to workspace
 *        data_type: "image"
 *     }: DbDataset
 * 
 */
async function get_dataset(req, res) {
	checkAdmin(req, async () => {
		try {
			const datasetData = await db.get(dbkeys.keyForDataset(req.params.dataset_id))
			return res.send(datasetData);
		} catch (err) {
			return res.status(400).json({
				message: 'Unknown dataset ' + req.params.dataset_id
			});
		}
	});
}

/**
 * @api {delete} /dataset/:dataset_id Delete dataset
 * @apiName DeleteDataset
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function delete_dataset(req, res) {
	checkAdmin(req, async () => {
		const key = dbkeys.keyForDataset(req.params.dataset_id);
		const bm = new batchManager.BatchManager(db);
		await bm.add({ type: 'del', key });//delete dataset
		const stream = utils.iterateOnDB(db, dbkeys.keyForData(req.params.dataset_id), true, false);
		for await (const dkey of stream) {
			await bm.add({ type: 'del', key: dkey });//delete each data in this dataset
			elise_remove_image(dkey);
		}
		await bm.flush();
		return res.status(204).json({});
	});
}

/**
 * @api {get} /datasets/:dataset_id/data/:data_id Get data item info
 * @apiName GetData
 * @apiGroup Dataset
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        id: dataData.id, 
 *        dataset_id: dataData.dataset_id, 
 *        type: dataData.type,
 *        children,
 *        path
 *     }: DbData
 * 
 */
async function get_data(req, res) {
	try {
		const output = await getDataDetails(req.params.dataset_id, req.params.data_id);
		return res.send(output);
	} catch (err) {
		return res.status(400).json({
			type: 'unknown_data',
			message: 'Unknown data ' + req.params.data_id + ' for dataset ' + req.params.dataset_id
		});
	}
}


/**
 * @api {get} /datasets/:dataset_id/data Get all data items with given contraints
 * @apiName GetDatas
 * @apiGroup Dataset
 * 
 * @queryParam {number} page
 * @queryParam {number} count
 * @queryParam {string} <any> (filter result any keys with value inclusion)
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      results: DbData[],
 *      counter: number, // number of included results
 *      globalCounter: number, // number of all results
 *     }
 * 
 */
async function get_datas(req, res) {
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

	const datasetId = req.params.dataset_id;
	const stream = utils.iterateOnDB(db, dbkeys.keyForData(datasetId), false, true);
	for await (const data of stream) {
		// filter results
		let included = true;
		for (let k of keys) {
			const query = queries[k];
			const r = JSON.stringify(data[k]) || '';
			// if the filter is a (semicolon separated) list, include all data that satisfies at least one of them
			const queryList = query.split(";").filter((q) => q != "");
			included = queryList.some((q) => r.includes(q));
			if (!included) break;
		}
		if (included) {
			if (counter >= (match.page - 1) * match.count && counter < match.page * match.count) {
				results.push(data);
			}
			counter += 1;
		}
		globalCounter += 1;
	}
	return res.send({ results, counter, globalCounter });
}


///// Utils

/**
 * Get data content from its id
 * @param {string} dataset_id 
 * @param {string} data_id 
 * @param {boolean} relative whether the media path is relative or not to root
 * @returns 
 */
const getDataDetails = async (dataset_id, data_id, relative = false) => {
	const dataData = await db.get(dbkeys.keyForData(dataset_id, data_id));
	let path = dataData.path;
	let children = dataData.children;
	if (relative) {
		path = utils.toRelative(path);
		if (children) {
			children = children.map((d) => ({ ...d, path: utils.toRelative(d.path) }));
		}
	}
	const output = {
		...dataData,
		children,
		path
	};
	return output;
}

/**
 * Create dataset entry and generate default low-level data entries.
 * @param {Level} db 
 * @param {String} path 
 * @param {String} workspace 
 */
async function getOrcreateDataset(dataset, workspace) {
	//return existing dataset if true
	if (dataset.id) {
		const existingDataset = await getDatasetFromId(db, dataset.id);
		if (existingDataset) return existingDataset;
	} else {
		if (dataset.path) {// for retro compatibility only
			dataset.path = path.normalize(dataset.path + '/');//normalize path in order to not duplicate datasets because of a typo error
			const existingDataset = await getDatasetFromPath(db, dataset.path, dataset.data_type);
			if (existingDataset) return existingDataset;
		}
		dataset.id = utils.generateKey();//if id not existing, generate it
	}
	// verify if data_type is available
	if (!populator.data_types.includes(dataset.data_type)) {
		console.error("getOrcreateDataset:",dataset.data_type,"is not part of available data_types");
		return undefined;
	}
	// create the dataset
	await db.put(dbkeys.keyForDataset(dataset.id), dataset);
	if (dataset.urlList) await populator[dataset.data_type](db, dataset.path, workspace, dataset.id, dataset.urlList)
	else await populator[dataset.data_type](db, dataset.path, workspace, dataset.id)
	return dataset;
}

/**
 * Get dataset entry from a dataset path if it exists.
 * @param {Level} db 
 * @param {String} path 
 */
const getDatasetFromPath = (db, path, data_type) => {
	let foundDataset = null;
	return new Promise((resolve, reject) => {
		// update datasets if previously unknown data path is given
		const s1 = utils.iterateOnDB(db, dbkeys.keyForDataset(), false, true);
		s1.on('data', (value) => {
			if (value.path === path && value.data_type === data_type) {
				foundDataset = value;
				s1.destroy();
			}
		}).on('close', () => {
			resolve(foundDataset);
		});
	});
}

/**
 * Get dataset entry from a dataset id if it exists.
 * @param {Level} db 
 * @param {String} id 
 */
const getDatasetFromId = (db, id) => {
	let foundDataset = null;
	return new Promise((resolve, reject) => {
		// update datasets if previously unknown data path is given
		const s1 = utils.iterateOnDB(db, dbkeys.keyForDataset(), false, true);
		s1.on('data', (value) => {
			if (value.id === id) {
				foundDataset = value;
				s1.destroy();
			}
		}).on('close', () => {
			resolve(foundDataset);
		});
	});
}

/**
 * Retrieve all data ids for a given data type.
 * @param {Level} db
 * @param {String} dataset_id
 * @param {String} type
 */
function getAllDataFromDataset(dataset_id) {
	const dataList = [];
	const stream = utils.iterateOnDB(db, dbkeys.keyForData(dataset_id), true, false)
	return new Promise((resolve) => {
		stream.on('data', (key) => {
			dataList.push(key.slice(dbkeys.keyForData(dataset_id).length));
		}).on('end', () => {
			resolve(dataList);
		})
	});
}

/**
 * Retrieve all data paths for a given data type.
 * @param {Level} db
 * @param {String} dataset_id
 * @param {String} type
 */
function getAllPathsFromDataset(dataset_id) {
	const dataMap = {};
	const stream = utils.iterateOnDB(db, dbkeys.keyForData(dataset_id), false, true)
	return new Promise((resolve) => {
		stream.on('data', (value) => {
			const p = Array.isArray(value.path) ? value.path[0] : value.path;
			const relUrl = path.normalize(utils.toRelative(p));
			// console.log('relUrl', relUrl);
			dataMap[relUrl] = value.id;
		}).on('end', () => {
			resolve(dataMap);
		})
	});
}

module.exports = {
	get_datasets,
	post_datasets,
	post_dataset_from,
	import_dataset_from_kafka,
	import_dataset_from_dataprovider,
	get_dataset,
	delete_dataset,
	get_data,
	get_datas,
	getOrcreateDataset,
	getAllDataFromDataset,
	getAllPathsFromDataset,
	getDataDetails
}
