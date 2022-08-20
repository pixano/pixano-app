/**
 * Data population
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
 */

const fs = require('fs');
const cliProgress = require('cli-progress');
const path = require('path');
const batchManager = require('./batch-manager');
const { generateKey, toRelative, workspaceToMount, MOUNTED_WORKSPACE_PATH } = require('../helpers/utils');
const dbkeys = require('../config/db-keys');
const imageThumbnail = require('image-thumbnail');
const { elise_index_image } = require('../routes/elise_plugin.js');// ELISE


async function remote_image(db, mediaRelativePath, hostWorkspacePath, datasetId, urlList = '') {
	return populateRemoteSimple(db, mediaRelativePath, hostWorkspacePath, datasetId, ['jpg', 'png', 'PNG', 'jpeg', 'JPEG'], 'image', urlList);
}

const data_types = [//list of available data types (implemented in data-papulator)
	"image",
	"pcl",
	"pcl_image",
	"sequence_image",
	"sequence_pcl",
	"sequence_pcl_image"
];

async function image(db, mediaRelativePath, hostWorkspacePath, datasetId, urlList = '') {
	return populateSimple(db, mediaRelativePath, hostWorkspacePath, datasetId, ['jpg', 'png', 'PNG', 'jpeg', 'JPEG'], 'image', urlList);
}

async function pcl(db, mediaRelativePath, hostWorkspacePath, datasetId) {
	return populateSimple(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'pcl');
}

async function pcl_image(db, mediaRelativePath, hostWorkspacePath, datasetId) {
	return populateMultiview(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'pcl_image');
}

async function sequence_image(db, mediaRelativePath, hostWorkspacePath, datasetId) {
	return populateSequence(db, mediaRelativePath, hostWorkspacePath, datasetId, ['jpg', 'png', 'PNG', 'jpeg', 'JPEG'], 'sequence_image');
}

async function sequence_pcl(db, mediaRelativePath, hostWorkspacePath, datasetId) {
	return populateSequence(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'sequence_pcl');
}

async function sequence_pcl_image(db, mediaRelativePath, hostWorkspacePath, datasetId) {
	return populateMultiviewSequence(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'sequence_pcl_image');
}

/**
 * Populate elementary data entries (image, pcl) : case of remote data
 * @param {Level} db
 * @param {string} mediaRelativePath 
 * @param {string} hostWorkspacePath 
 * @param {string} datasetId 
 * @param {Array} urlList: a list of urls to be loaded (instead of a full directory through mediaRelativePath)
 *                      OR a list of {url,id} to be loaded (instead of a full directory through mediaRelativePath), this method assigns an id to each url
 */
async function populateRemoteSimple(db, mediaRelativePath, hostWorkspacePath, datasetId, ext = ['jpg', 'png'], dataType = 'image', urlList = '') {
	var total = 0;
	var folders = {};
	if (urlList) {//if we get a list of urls instead of a full directory
		total = urlList.length;
		folders = { urlList };
	} else {
		console.error("remote directory exploration not implemented");// ... TODO
		return;
	}
	const bm = new batchManager.BatchManager(db);
	const bar1 = new cliProgress.SingleBar({
		format: 'Dataset creation | {bar} | {percentage}% || {value}/{total} files'
	});
	bar1.start(total, 0);
	for await (const files of Object.values(folders)) {
		for await (const fi of files) {
      const id = fi.id ? fi.id : generateKey();//if ids are given or generated
      const url = fi.url ? fi.url : fi;// only used when urlList is given as input in combination with ids
			let value = { id, dataset_id: datasetId, type: dataType, path: url, children: '' };
			if (dataType=='image') {
				// compute a thumbnail for this image
				value.thumbnail = await imageThumbnail({ uri: url }, { responseType: 'base64', height: 100 }).catch((err) => console.error("ERROR in imageThumbnail creation:",err));
				await elise_index_image(url,id,datasetId);// ELISE : index this image
			}
			await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value });
			bar1.increment();
		}
	}
	await bm.flush();
	bar1.stop();
}

/**
 * Populate elementary data entries (image, pcl)
 * @param {Level} db 
 * @param {string} mediaRelativePath: full directory to be loaded (not used if urlList is present)
 * @param {string} hostWorkspacePath 
 * @param {string} datasetId 
 * @param {Array} urlList: a list of urls to be loaded (instead of a full directory through mediaRelativePath)
 *                      OR a list of {url,id} to be loaded (instead of a full directory through mediaRelativePath), this method assigns an id to each url
 */// ... TODO : get back from 'image' to 'remote_image' when minio will work without local copy ?
async function populateSimple(db, mediaRelativePath, hostWorkspacePath, datasetId, ext = ['jpg', 'png'], dataType = 'image', urlList = '') {
	var total = 0;
	var folders = {};
	if (urlList) {//if we get a list of urls instead of a full directory
		total = urlList.length;
		folders = {urlList};
	} else {
		const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
		const parsed = await parseFolder(hostFolder, ext);
		folders = parsed.folders;
		total = parsed.total;
	}
	const bm = new batchManager.BatchManager(db);
	const bar1 = new cliProgress.SingleBar({
		format: 'Dataset creation | {bar} | {percentage}% || {value}/{total} files'
	});
	bar1.start(total, 0);
	for await (const files of Object.values(folders)) {
		for await (const fi of files) {
			const id = fi.id ? fi.id : generateKey();//if ids are given or generated
			const f = fi.url ? fi.url : fi;// only used when urlList is given as input in combination with ids
			const url = workspaceToMount(hostWorkspacePath, f);
			let value = { id, dataset_id: datasetId, type: dataType, path: url, children: '' };
			if (dataType=='image') {
				// compute a thumbnail for this image
				value.thumbnail = await imageThumbnail(f, {responseType: 'base64', height: 100}).catch((err) => console.error("ERROR in imageThumbnail creation:",err));
				await elise_index_image(url,id,datasetId,f);// ELISE : index this image
			}
			await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value });
			bar1.increment();
		}
	}
	await bm.flush();
	bar1.stop();
}

async function populateMultiview(db, mediaRelativePath, hostWorkspacePath, datasetId,
	ext = ['bin'],
	type = 'pcl_image') {
	const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
	const files = await parseFolder(hostFolder, ext);
	const bm = new batchManager.BatchManager(db);
	for await (const f of files) {
		const id = generateKey();
		const path = workspaceToMount(hostWorkspacePath, f);
		const f2 = f.replace('pcls/', 'images/')
			.replace(/velodyne_/g, 'cam_')
			.replace('bin', 'jpg');
		if (fs.existsSync(f2)) {
			const value = { id, dataset_id: datasetId, type, path: [path, workspaceToMount(hostWorkspacePath, f2)] };
			await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value });
		} else {
			console.warn(`Multi view not available for data ${f}`);
		}
	}
	await bm.flush();
}

/**
 * Populate data entries for sequences of pcl with image
 * {
 *  id: string,
 *  dataset_id: string,
 *  type: sequence_xxx,
 *  path: string (pcl folder path),
 *  children: {timestamp: number, img_ids: [string, string]}
 *  url: string
 * }
 * @param {Level} db 
 * @param {string} datasetId
 * @param {string} dataType sequence_image/sequence_pcl
 */
async function populateMultiviewSequence(db, mediaRelativePath, hostWorkspacePath, datasetId,
	ext = ['bin'],
	type = 'sequence_pcl_image') {
	const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
	const files = await parseFolder(hostFolder, ext);
	const bm = new batchManager.BatchManager(db);

	const folderReducer = (total, file) => {
		const dirname = path.dirname(file);
		if (!total[dirname]) {
			total[dirname] = [];
		}
		total[dirname].push(file);
		return total;
	}

	const folders = files.reduce(folderReducer, {});
	let counter = 0;
	for await (const folderPath of Object.keys(folders)) {
		const id = generateKey();
		const sortedFrames = folders[folderPath].sort((a, b) => a.localeCompare(b))
			.map((f, idx) => {
				const f2 = f.replace('pcls/', 'images/')
					.replace(/velodyne_/g, 'cam_')
					.replace('bin', 'jpg');
				return { timestamp: idx, path: [workspaceToMount(hostWorkspacePath, f), workspaceToMount(hostWorkspacePath, f2)] }
			});
		const value = {
			id,
			dataset_id: datasetId,
			type,
			path: workspaceToMount(hostWorkspacePath, folderPath),
			children: sortedFrames
		}
		await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value });
		counter++;
	}
	console.info(`Read ${counter} sequences.`);
	await bm.flush();
}

/**
 * Populate data entries for sequences of images/pcl
 * {
 *  id: string,
 *  dataset_id: string,
 *  type: sequence_xxx,
 *  path: '',
 *  children: {timestamp: number, path: [string]}
 * }
 * @param {Level} db 
 * @param {string} datasetId
 * @param {string} dataType sequence_image/sequence_pcl
 */
async function populateSequence(db, mediaRelativePath, hostWorkspacePath, datasetId,
	ext = ['jpg', 'png'],
	dataType = 'sequence_image') {

	const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
	const { folders } = await parseFolder(hostFolder, ext);
	const bm = new batchManager.BatchManager(db);
	const bar1 = new cliProgress.SingleBar({
		format: 'Dataset creation | {bar} | {percentage}% || {value}/{total} sequences'
	});
	bar1.start(Object.keys(folders).length, 0);
	for await (const [folderPath, files] of Object.entries(folders)) {
		const id = generateKey();
		const url = workspaceToMount(hostWorkspacePath, folderPath);
		const sortedFrames = files.sort((a, b) => a.localeCompare(b))
			.map((f, idx) => { return { timestamp: idx, path: workspaceToMount(hostWorkspacePath, f) } });
		const value = { id, dataset_id: datasetId, type: dataType, path: url, children: sortedFrames }
		await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value });
		bar1.increment();
	}
	bar1.stop();
	await bm.flush();
}

/**
 * Parse folder for data files.
 * @param {string} dir 
 * @param {string[]} extensions 
 */
function parseFolder(dir, extensions = ['jpg', 'png']) {
	return new Promise((resolve, reject) => {
		console.info(`Parsing folder ${dir}`);
		if (!(fs.existsSync(dir))) {
			console.log("Directory does not exist.")
			return resolve({ folders: {} });
		}
		walk(dir, extensions, (err, result) => {
			if (err) throw err;
			resolve(result);
		});
	});
}

/**
 * Utility function to parse recursively a directory.
 * @param {String} dir 
 * @param {String[]} ext 
 * @param {Function} done 
 */
const walk = (dir, ext, done) => {
	let folders = {}
	let total = 0;

	fs.readdir(dir, (err, list) => {
		if (err) return done(err);
		let pending = list.length;
		if (!pending) return done(null, { folders, total });
		list.forEach((file) => {
			file = path.resolve(dir, file);
			fs.stat(file, (err, stat) => {
				if (stat && stat.isDirectory()) {
					walk(file, ext, (err, out) => {
						folders = { ...folders, ...out.folders }
						total += out.total;
						if (!--pending) {
							done(null, { folders, total });
						}
					});
				} else {
					if (ext.includes(file.split('.').pop())) {
						if (!folders[dir]) folders[dir] = [];
						folders[dir].push(file);
						total += 1;
					}
					if (!--pending) done(null, { folders, total });
				}
			});
		});
	});
};

module.exports = {
	data_types,
	remote_image,
	image,
	pcl,
	pcl_image,
	sequence_image,
	sequence_pcl,
	sequence_pcl_image,
	toRelative,
	MOUNTED_WORKSPACE_PATH
}
