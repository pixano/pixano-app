const Minio = require('minio')
var CONFIG = require('../../exconf.json');

function waitFor(conditionFunction) {//rajouter un timeout
	const poll = resolve => {
		if (conditionFunction()) resolve();
		else setTimeout(_ => poll(resolve), 400);
	}
	return new Promise(poll);
}

/**
 * Download files form minio
 * @param ["id1","id2",...]: a list of ids to search for in the bucket
 * @param workspace: Pixano's current workspace (images will be copied inside of it)
 * @return ["url1","url2",...]: returns the list of the corresponding URLs
 * @doc https://docs.min.io/docs/javascript-client-api-reference
 */
const downloadFilesFromMinio = async (listIds,workspace) => {
	console.log("downloadFilesFromMinio:",listIds);
	// Instantiate the minio client with the endpoint
	// and access keys as shown below.
	const minioClient = new Minio.Client({
		endPoint: CONFIG.minio.endPoint,
		port: CONFIG.minio.port,
		useSSL: CONFIG.minio.useSSL,
		accessKey: CONFIG.minio.accessKey,
		secretKey: CONFIG.minio.secretKey
	});

	const pixano_local_save_image_directory = workspace+'/minio_saved_images/'+'importedFromKafka/';//... TODO

	// check if bucket exists/can be accessed
	var exists = await minioClient.bucketExists(CONFIG.minio.bucket_name).catch((e) => {throw "Minio: Bucket does not exist\n"+e;});
	if (!exists) throw "Minio: Bucket does not exist";
	console.log('Bucket exists.')

	// Extract the list of image from the bucket
	var listOfURLs = [];
	var data = [];
	var doneData = 0;
	var stream = minioClient.listObjects(CONFIG.minio.bucket_name, '', true);
	stream.on('error', function (e) { throw(e); });
	stream.on('data', function (obj) { data.push(obj); });
	stream.on('end', function () {
		if (data.length===0) throw "Minio: no data found in bucket "+CONFIG.minio.bucket_name;
		for (var i=0; i<data.length; i++) {//search for urls that correspond to the input list and get them
		//data.forEach(obj => {//search for urls that correspond to the input list and get them
			const obj = data[i];
			console.log(obj);
			if ('name' in obj) {
				console.log("name in obj");
				var corresponding = false;
				listIds.forEach(id => {//id does not directly correspond to an image path
					if (id.endsWith('/')) id = id.substring(0,id.length-1);
					const words = id.split('/');
					id = words[words.length - 1];
					if (objname.includes(id)) corresponding=true;
				});
				if (corresponding) {
					console.log("corresponding");
					//Download image in current directory//... TODO : use web links when available
					minioClient.fGetObject(CONFIG.minio.bucket_name, obj.name, pixano_local_save_image_directory + obj.name, function (e) {
						if (e) throw(e);
						console.log('append:',pixano_local_save_image_directory + obj.name);
						listOfURLs.push(pixano_local_save_image_directory + obj.name);
						doneData++;
					});
				} else doneData++;
			} else doneData++;
		}
	});
	
	console.log("waitFor",doneData,data.length);
	await waitFor(() => { console.log("test",doneData,data.length); if (data.length>0) return(doneData === data.length); });
	console.log("listOfURLs=",listOfURLs);
	console.info("Minio: got "+listOfURLs.length+" images over "+listIds.length+" in the input list");
	if (listOfURLs.length===0) throw "Minio: no corresponding data found in bucket "+CONFIG.minio.bucket_name;

	return listOfURLs;
}


module.exports = {
	downloadFilesFromMinio
}
