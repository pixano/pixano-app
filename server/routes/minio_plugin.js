const Minio = require('minio')
var CONFIG = require('../../exconf.json');

/**
 * Download files form minio
 * @param ["id1","id2",...]: a list of ids to search for in the buckeet
 * @return ["url1","url2",...]: returns the list of the corresponding URLs
 * @doc https://docs.min.io/docs/javascript-client-api-reference
 */
const downloadFilesFromMinio = async (listIds) => {
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

	const pixano_local_save_image_directory = './pixano_save_image/';

	// check if bucket exists/can be accessed
	var exists = await minioClient.bucketExists(CONFIG.minio.bucket_name).catch((e) => {throw "Minio: Bucket does not exist\n"+e;});
	if (!exists) throw "Minio: Bucket does not exist";
	console.log('Bucket exists.')

	// Extract the list of image from the bucket
	const promesse = new Promise((resolve, reject) => {
		var stream = minioClient.listObjects(CONFIG.minio.bucket_name, '', true);
		stream.on('error', function (e) { reject(e); })
		stream.on('data', function (obj) {
			console.log(obj)
			const listOfURLs = [];
			if ('name' in obj) {
				// Download image in current directory
				minioClient.fGetObject(CONFIG.minio.bucket_name, obj.name, pixano_local_save_image_directory + obj.name, function (e) {
					if (e) return console.log(e);
					console.log('append:',pixano_local_save_image_directory + obj.name);
					listOfURLs.push(pixano_local_save_image_directory + obj.name);
				})
			}
			if (listOfURLs.length===0) reject("Minio: no data found in bucket "+CONFIG.minio.bucket_name);
			resolve(listOfURLs);
		});
		console.log('end list construction')
	});
	await promesse.catch((e) => {throw "Minio: listObjects: "+e;});

	console.log('end list construction2')
	if (listOfURLs.length===0) throw "Minio: no data found in bucket "+CONFIG.minio.bucket_name;
	console.log("listOfURLs=",listOfURLs);

	return listOfURLs;
}


module.exports = {
	downloadFilesFromMinio
}
