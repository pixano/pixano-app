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
	console.log("elise_search_similar_images")
	// console.log("req=", req);

    const similarity_level = req.params.similarity_level;
    const dataId = req.params.data_id;

	// console.log("res=", res);
	// TODO : no linked task for now (has to change for a more realistic use = with multiple datasets)
	// 1) initialisation
	const taskName = req.params.task_name;
	const task = await db.get(dbkeys.keyForTask(taskName));
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
	let doneCounter = 0;
	let toValidateCounter = 0;
	let resultIds = [];

	// 2) call Elise
	// get image path from id
	const dataData = await db.get(dbkeys.keyForData(task.dataset_id, dataId));
	const relUrl = path.normalize(dataData.path.replace(populator.MOUNTED_WORKSPACE_PATH, ''));
	console.log("relUrl=",relUrl);
	const exportPath = path.join(workspace, relUrl);
	console.log("exportPath=",exportPath);
	// define the message
	let urlElise = 'http://localhost:8081'
	let formData = new FormData();// create the form to send to Elise
	formData.append('action', 'search');
	formData.append('image', fs.readFileSync(exportPath), relUrl);
	formData.append('save', '0');
	// send and wait for answer
	await fetch(urlElise, { method: 'post', body: formData })
		.then(res => {
			if (res.statusText == 'OK') return res.json();
			else console.log("KO :\n", res);
		})
		.then(res => {
			// console.log(res);
			const resultat=JSON.parse(JSON.stringify(res));
			if (resultat.searchresults.error) console.log("erreur : ",resultat.searchresults.error);
			else console.log("imagesinfo=",resultat.searchresults.imagesinfo);
			//extract list of ids (externalid) that have a score > similarity_level
			for(let idscore of resultat.searchresults.imagesinfo.imageinfo) {
				if (idscore.score < 0.001) {
					console.log("idscore=",idscore);
					resultIds.push(idscore.externalid);

				}
			}

			// const stream = utils.iterateOnDB(db, dbkeys.keyForResult(taskName), false, true);
			// const task = await db.get(dbkeys.keyForTask(taskName));
			// for await (const result of stream) {
			// 	// filter results
			// 	let included = true;
			// 	for (let k of keys) {
			// 		const query = queries[k];
			// 		// console.log("result=", result)
			// 		const r = JSON.stringify(result[k]) || '';
			// 		// if the filter is a (semicolon separated) list, include all result that satisfies at least one of them
			// 		const queryList = query.split(";").filter((q) => q != "");
			// 		included = queryList.some((q) => r.includes(q));
			// 		if (!included) break;
			// 	}
			// 	if (included) {
			// 		if (counter >= (match.page - 1) * match.count && counter < match.page * match.count) {
			// 			const imgData = await db.get(dbkeys.keyForData(task.dataset_id, result.data_id));
			// 			results.push({ ...result, thumbnail: imgData.thumbnail });
			// 		}
			// 		counter += 1;
			// 	}
			// 	if (result.status === 'done') {
			// 		doneCounter += 1;
			// 	}
			// 	if (result.status === 'to_validate') {
			// 		toValidateCounter += 1;
			// 	}
			// 	globalCounter += 1;
			// }
			
			console.log("fini...");

			
		});// send POST request
	console.log("fini.");
	return res.send(resultIds);
}

module.exports = {
	elise_search_similar_images
}
