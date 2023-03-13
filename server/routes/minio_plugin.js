import { Client } from 'minio';
import { db, workspace } from '../config/db';
import { keyForCliOptions } from '../config/db-keys';
import { truncate } from 'fs';
import cliProgress from 'cli-progress';

function waitFor(conditionFunction) {//rajouter un timeout
	const poll = resolve => {
		if (conditionFunction()) resolve();
		else setTimeout(_ => poll(resolve), 400);
	}
	return new Promise(poll);
}

/**
 * Download files form minio
 * @param minio_files {path0_full: [{bucket: bucket name, path: path0, file: file_id }, ...], ..., pathN: [{...}, ...]}:  a struct of bucket paths and ids to search for
 * pathX_full is the full "key", aka bucket_name/path, used to group files for seeking
 * @param workspace: Pixano's current workspace (images will be copied inside of it)
 * @return ["url1","url2",...]: returns the list of the corresponding URLs
 * @doc https://docs.min.io/docs/javascript-client-api-reference
 */
const downloadFilesFromMinio = async (minio_files, workspace, selection_name) => {
	//TODO : wrong, need to iterate and sum in each array
	let num_ids = 0;
	for (const k in minio_files) {
		num_ids += minio_files[k].length;
	}
	console.log("downloadFilesFromMinio (",selection_name,") - nbSamples", num_ids);

	const pixano_local_save_image_directory = workspace+'/minio_saved_images/importedFromDebiai/'+selection_name+'/';//... TODO
	var listOfURLs = [];

	// Instantiate the minio client with the endpoint
	// and access keys as shown below.
	const minio_config = await db.get(keyForCliOptions)
	.then((options) => { 
		return { 
			endPoint: options.minioEndpoint, //"minio-storage.apps.confianceai-public.irtsysx.fr",
			useSSL: true,
			accessKey: options.minioAccessKey,
			secretKey: options.minioSecretKey
		}});
	//console.log("Minio config:", minio_config);

	const minioClient = new Client(minio_config);

	//console.log("Minio :", minioClient);
	/** test: list availble buckets
	minioClient.listBuckets(function(err, buckets) {
		if (err) return console.log(err);
		console.log('available buckets :', buckets);
	})
	*/

	// check if bucket(s) exists/can be accessed
	const unique_buckets = new Set()
	for (const k in minio_files) {
		for(const f of minio_files[k]) {
			unique_buckets.add(f['bucket']);
		}
	}
	console.log('Buckets', unique_buckets);
	for (const bucket_name of unique_buckets) {
		var exists = await minioClient.bucketExists(bucket_name).catch((e) => {throw "Minio: Bucket does not exist\n"+e;});
		if (!exists) throw "Minio: Bucket "+bucket_name+" does not exist";
		console.log(`Bucket ${bucket_name} exists.`);
	}

	// Extract the list of image from the bucket

	const bar = new cliProgress.SingleBar({
		format: 'Image retrieval from Minio | {bar} | {percentage}% || {value}/{total} jobs'
	});
	bar.start(num_ids, 0);
	for(const k in minio_files) {
		//assume (by construction) unique bucket / path for each key in minio_files
		const bucket_name = minio_files[k][0]['bucket'];
		const bucket_path = minio_files[k][0]['path'];
		const listIds = []
		var data = [];
		var doneData = 0;
	
		for( const f of minio_files[k]) {
			listIds.push(f['file']);
		}
		console.log(`Seek in ${bucket_name} path: ${bucket_path}`);
		var stream = minioClient.listObjects(bucket_name, bucket_path, true);
		stream.on('error', function (e) { throw(e); });
		stream.on('data', function (obj) { data.push(obj); });
		stream.on('end', function () {
			if (data.length===0) throw "Minio: no data found in bucket "+bucket_name;
			//for (var i=0; i<data.length; i++) {//search for urls that correspond to the input list and get them
			data.forEach(obj => {//search for urls that correspond to the input list and get them
				//const obj = data[i];
				if ('name' in obj) {
					// console.log("name in obj");
					var corresponding = false;
					// FORMAT of sample_ids :
					//	"sample_ids": [ 
					//		{
					//			"dataset": "not_labeled",                 
					//			"subject": "c34", 
					//			"relative_path": "not_labeled/c34/", 
					//			"url": "", 
					//			"type": "image",
					//			"id": "191003-2237_2953236_ - C101_OK.jpgImage" 
					//		}, ... ]
					var sample;
					for (var i=0; i<listIds.length ; i++) {
						sample = listIds[i];
						if (!sample) throw(e);
						// console.log("sample=",sample);
						// console.log("sample.id.replace('.jpgImage', '.jpg')=",sample.id.replace('.jpgImage', '.jpg'));
						if (obj.name.includes(sample.replace('.jpgImage', '.jpg'))) {
							//console.log(`obj.name ${obj.name} includes sample ${sample}`);
							corresponding=true;
							break;
						}
					}
					if (corresponding) {
						console.log("corresponding sample=",sample);
						//Download image in current directory//... TODO : use web links when available

						//minioClient.fGetObject(bucket_name, obj.name, pixano_local_save_image_directory + obj.name, function (e) {
						//TMP  On applati l'arborescence Minio. Ce n'est pas solution optimale dans tout les cas
						//     mais c'est le + simple dans le cadre d'une selection DP
						//  -> on vire les répertoires du path, on ne garde que le filename
						const obj_flat_name = obj.name.split('/').pop();
						minioClient.fGetObject(bucket_name, obj.name, pixano_local_save_image_directory + obj_flat_name, function (e) {							
							if (e) {
								console.log("ERROR Minio fGetObject", e);
								throw "Error while importing from Minio: " + e;
							}
							//console.info('append:',{url: pixano_local_save_image_directory + obj.name, id: sample});
							//////TMP applati listOfURLs.push({url: pixano_local_save_image_directory + obj.name, id: sample});
							listOfURLs.push({url: pixano_local_save_image_directory + obj_flat_name, id: sample});
							doneData++;
						});
						bar.increment();
					} else doneData++;
				} else doneData++;
			});//throw errors further
		});//throw errors further
		console.log("waitFor",doneData,data.length);
		await waitFor(() => { console.log("test",doneData,data.length); if (data.length>0) return(doneData === data.length); });	
	}
	//console.log("listOfURLs=",listOfURLs);
	console.info("Minio: got "+listOfURLs.length+" images over "+num_ids+" in the input list");
	bar.stop();
	if (listOfURLs.length===0) throw "Minio: no corresponding data found in bucket "+bucket_name;

	return listOfURLs;
}


export default {
	downloadFilesFromMinio
}
