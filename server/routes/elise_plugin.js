const { db, workspace } = require('../config/db');
const dbkeys = require('../config/db-keys');
const fetch = require("node-fetch");
var FormData=new require('form-data');
const fs = require('fs');
const path = require('path');
const populator = require('../helpers/data-populator');


/**
 * @api {get} /tasks/:task_name/results Request list of results with given contraints
 * (page, pageCount, filter, sort, ...)
 * @apiName GetResults
 * @apiGroup Results
 * 
 * @queryParam {number} page
 * @queryParam {number} count
 * @queryParam {string} <any> (filter result any keys with value inclusion)
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      results: DbResult[],
 *      counter: number, // number of included results
 *      globalCounter: number, // number of all results
 *      doneCounter: number, // number of all done results
 *      toValidateCounter: number // number of all to_validate results
 *     }
 */
async function elise_search_similar_images(req, res) {

    const similarity_level = req.params.similarity_level;
    const dataId = req.params.data_id;
	const eliseIp = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.eliseIp });

	// ... TODO : no linked task for now (has to change for a more realistic use = with multiple datasets)
	
	// 1) initialisation
	const taskName = req.params.task_name;
	const task = await db.get(dbkeys.keyForTask(taskName));
	const queries = req.query;
	delete queries.page;
	delete queries.count;
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
		relUrl = path.normalize(dataData.path.replace(populator.MOUNTED_WORKSPACE_PATH, ''));
		exportPath = path.join(workspace, relUrl);
	}
	// define the message
	let urlElise = 'http://'+eliseIp+':8081'
	let formData = new FormData();// create the form to send to Elise
	formData.append('action', 'search');
	if (dataData.path.includes('http:')) formData.append('image', buffer, relUrl);
	else formData.append('image', fs.readFileSync(exportPath), relUrl);
	formData.append('save', '0');
	// send and wait for answer
	await fetch(urlElise, { method: 'post', body: formData })// send POST request
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

module.exports = {
	elise_search_similar_images
}
