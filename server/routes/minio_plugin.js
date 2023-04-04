import { Client } from 'minio';
import { db } from '../config/db';
import { keyForCliOptions } from '../config/db-keys';
import cliProgress from 'cli-progress';

function getMinioObj(bar, minioClient, bucket_name, bucket_path, pixano_local_save_image_directory, file) {
	return new Promise((resolve, reject) => {
		const minio_obj = bucket_path.slice(1) + "/" + file
		const obj_outpath = pixano_local_save_image_directory + file
		minioClient.fGetObject(bucket_name, minio_obj, obj_outpath, function (e) {
			if (e) {
				console.log("ERROR Minio fGetObject", e);
				reject("Error while importing from Minio: " + e);
			} else {
				//console.log("Minio imported file:", file)
				bar.increment();
				resolve({url: obj_outpath, id: file})
			}
		});	
	});
}

/**
 * Download files form minio
 * @param minio_files {path0_full: [{bucket: bucket name, path: path0, file: file_id }, ...], ..., pathN: [{...}, ...]}:  a struct of bucket paths and ids to search for
 * pathX_full is the full "key", aka bucket_name/path, used to group files for seeking
 * @param workspace: Pixano's current workspace (images will be copied inside of it)
 * @return ["url1","url2",...]: returns the list of the corresponding URLs
 * @doc https://docs.min.io/docs/javascript-client-api-reference
 */
const downloadFilesFromMinio = async (minio_files, workspace, outpath) => {
	//TODO : wrong, need to iterate and sum in each array
	let num_ids = 0;
	for (const k in minio_files) {
		num_ids += minio_files[k].length;
	}
	console.log("downloadFilesFromMinio (",outpath,") - nbSamples", num_ids);
	const pixano_local_save_image_directory = workspace+'/minio_saved_images/importedFromDebiai/'+outpath+'/';//... TODO
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
	let minio_dl_Proms = []

	for(const k in minio_files) {
		//assume (by construction) unique bucket / path for each key in minio_files
		const bucket_name = minio_files[k][0]['bucket'];
		const bucket_path = minio_files[k][0]['path'];
		let minio_dl_Proms_batch = []
		const batch_size = 50;  //not more than 64, else Minio complains 
		for( const f of minio_files[k]) {
			minio_dl_Proms_batch.push(getMinioObj(bar, minioClient, bucket_name, bucket_path, pixano_local_save_image_directory, f['file']))
			if(minio_dl_Proms_batch.length === batch_size) {
				//await for batch to finish before next one
				minio_dl_Proms.push.apply(minio_dl_Proms, await Promise.all(minio_dl_Proms_batch))
				minio_dl_Proms_batch = []
			}
		}
		if(minio_dl_Proms_batch.length > 0) {
			//this part length < batch_size, we await for it
			minio_dl_Proms.push.apply(minio_dl_Proms, await Promise.all(minio_dl_Proms_batch))
		}
	}

	const final_listurl = await Promise.all(minio_dl_Proms)
	.then((res_list) => {
		//console.log("all resolved", res_list);
		var listOfURLs = [];
		for(const res of res_list) {
			listOfURLs.push(res);
		}
		console.info("Minio: got "+listOfURLs.length+" images over "+num_ids+" in the input list");
		bar.stop();
		if (listOfURLs.length===0) throw "Minio: no corresponding data found in bucket "+bucket_name;
		return listOfURLs;	
	})
	.catch((e_list) => {
		console.log("all rejected", e_list);
		for(const e of e_list) {
			console.log("ERROR Minio fGetObject", e);
			throw "Error while importing from Minio: " + e;
		}
	});
	return final_listurl;
}


export default {
	downloadFilesFromMinio
}
