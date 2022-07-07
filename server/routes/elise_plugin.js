const { db, workspace } = require('../config/db');
const dbkeys = require('../config/db-keys');
const fetch = require("node-fetch");
var FormData=new require('form-data');
const fs = require('fs');
const path = require('path');
const { workspaceToMount, MOUNTED_WORKSPACE_PATH } = require('../helpers/utils');


/**
 * Test connection to elise server
 */
async function elise_test(eliseUrl) {//TODO: when we will be using node>=16, we will be able to use AbortSignal to timeout fetch
	// send and wait for answer
	await fetch(eliseUrl, { method: 'get' })// send a simple get and wait for an answer
		.then(() => console.log("Elise is running on ", eliseUrl))
		.catch(() => console.error("ERROR while calling ELISE => ELISE is not responding on ",eliseUrl));
}
async function elise_isRunning(req, res) {
	// send and wait for answer
	const eliseUrl = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.elise });
	const isRunning = await fetch(eliseUrl, { method: 'get' })// send a simple get and wait for an answer
		.then(() => { return true; })
		.catch(() => { return false; });
	return res.send(isRunning);
}


// no linked task for now (has to change for a more realistic use = with multiple datasets)
/**
 * Index a new image
 * @param url: url of this image (either a remote address or the relative path to the image)
 * @param id: Pixano's id of this image => will be the externalid in Elise
 * @param f: not used if url is a remote address, the absolute path to the image otherwise
 */
async function elise_index_image(url,id,f) {

	const eliseUrl = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.elise });
	let formData = new FormData();// create the form to send to Elise
	formData.append('action', 'index');
	if (url.includes('http:')) {
		const response = await fetch(url);
		const blob = await response.blob();
		const arrayBuffer = await blob.arrayBuffer();
		var buffer = Buffer.from(arrayBuffer);
		formData.append('image', buffer, url);
	} else formData.append('image', fs.readFileSync(f), url);
	formData.append('externalid', id);
	formData.append('title', url);
	formData.append('externalurl', "elise.cea.fr"+url);
	await fetch(eliseUrl, { method: 'post', body: formData })// send POST request
		.then(res => {
			if (res.statusText=='OK') return res.json();
			else console.log("KO :\n",res);
		})
		.then(res => console.log(res))
		.catch((err) => console.error("ERROR while calling ELISE => is ELISE server running ?\nError was:",err));
}

/**
 * @api {get} /elise/tasks/:task_name/similarity/:data_id/level/:similarity_level Request list of results similar to given image
 * @apiName GetResults
 * @apiGroup Results
 * 
 * @queryParam {number} params.similarity_level
 * @queryParam {number} params.data_id
 * 
 * @apiSuccessExample Success-Response: list of ids
 */
async function elise_search_similar_images(req, res) {
	// 1) initialisation
	const similarity_level = req.params.similarity_level;
	const dataId = req.params.data_id;
	const eliseUrl = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.elise });
	const taskName = req.params.task_name;
	const task = await db.get(dbkeys.keyForTask(taskName));
	// const queries = req.query;
	// delete queries.page;
	// delete queries.count;
	let resultIds = [];

	// 2) call Elise
	// get image path from id
	const dataData = await db.get(dbkeys.keyForData(task.dataset_id, dataId));
	var relUrl = '';
	var exportPath = '';
	var buffer = '';
	if (dataData.path.includes('http:')) {
		relUrl = dataData.path;
		exportPath = dataData.path;
		const response = await fetch(relUrl);
		const blob = await response.blob();
		const arrayBuffer = await blob.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
	} else {
		relUrl = path.normalize(dataData.path.replace(MOUNTED_WORKSPACE_PATH, ''));
		exportPath = path.join(workspace, relUrl);
	}
	// define the message
	console.log("eliseUrl=",eliseUrl)
	let formData = new FormData();// create the form to send to Elise
	formData.append('action', 'search');
	if (dataData.path.includes('http:')) formData.append('image', buffer, relUrl);
	else formData.append('image', fs.readFileSync(exportPath), relUrl);
	formData.append('save', '0');
	// send and wait for answer
	await fetch(eliseUrl, { method: 'post', body: formData })// send POST request //TODO : add shorter timeout
		.then(res => {
			if (res.statusText == 'OK') return res.json();
			else console.log("KO :\n", res);
		})
		.then(res => {
			const resultat=JSON.parse(JSON.stringify(res));
			// if (resultat.searchresults.error) console.log("erreur : ",resultat.searchresults.error);
			// else console.log("imagesinfo=",resultat.searchresults.imagesinfo);
			// get the max on scores to normalize them (min is always 0)
			var maxscore = 0;
			for(var idscore of resultat.searchresults.imagesinfo.imageinfo) {
				if (idscore.score > maxscore) maxscore = idscore.score;
			}
			//extract list of ids (externalid) that have a score > similarity_level
			const sim = (100-similarity_level)/100.0;
			console.log("sim=",sim);
			for(var idscore of resultat.searchresults.imagesinfo.imageinfo) {
				if (idscore.score/maxscore <= sim) {
					// console.log("idscore=",idscore);
					// console.log("norm idscore=",idscore.score/maxscore);
					resultIds.push(idscore.externalid);
				}
			}
		}).catch((err) => console.error("ERROR while calling ELISE => is ELISE server running ?\nError was:",err));
	return res.send(resultIds);
}

/**
 * @api {get} /elise/tasks/:task_name/similarity/:data_id/level/:similarity_level Request list of results similar to given image
 * @apiName GetResults
 * @apiGroup Results
 * 
 * @queryParam {number} params.similarity_level
 * @queryParam {number} params.data_id
 * 
 * @apiSuccessExample Success-Response: list of ids
 */
 async function elise_semantic_search(req, res) {
	// 1) initialisation
	const eliseUrl = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.elise });
	const keywords = req.params.keywords;
	const taskName = req.params.task_name;
	const task = await db.get(dbkeys.keyForTask(taskName));
	let resultIds = [];

	// 2) call Elise
	// define the message
	console.log("eliseUrl=",eliseUrl)
	let formData = new FormData();// create the form to send to Elise
	formData.append('action', 'txtsearch');
	formData.append('query', keywords);
	formData.append('save', '0');
	// send and wait for answer
	await fetch(eliseUrl, { method: 'post', body: formData })// send POST request //TODO : add shorter timeout
		.then(res => {
			if (res.statusText == 'OK') return res.json();
			else console.log("KO :\n", res);
		})
		.then(res => {
			const resultat=JSON.parse(JSON.stringify(res));
			// console.log("resultat=",resultat);
			// if (resultat.searchresults.error) console.log("erreur : ",resultat.searchresults.error);
			// else console.log("searchresults.imagesinfo.imageinfo=",resultat.searchresults.imagesinfo.imageinfo);
			for(var idscore of resultat.searchresults.imagesinfo.imageinfo) {
				console.log("found=",idscore);
				resultIds.push(idscore.externalid);
			}
		}).catch((err) => console.error("ERROR while calling ELISE => is ELISE server running ?\nError was:",err));
	return res.send(resultIds);
}


module.exports = {
	elise_test,
	elise_isRunning,
	elise_index_image,
	elise_search_similar_images,
	elise_semantic_search
}
