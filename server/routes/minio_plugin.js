const Minio = require('minio')
var CONFIG = require('../../config/minio.json');

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
const downloadFilesFromMinio = async (listIds,workspace,selection_name,project_name) => {
	console.log("downloadFilesFromMinio (",selection_name,"):",listIds);

	const pixano_local_save_image_directory = workspace+'/minio_saved_images/'+'importedFromKafka/'+selection_name+'/';//... TODO
	var listOfURLs = [];

	if (JSON.parse(CONFIG.fake)) {
		// // test whith a list of served urls
		// var urlList = [
		// 	'http://localhost:1234/video/01.png',
		// 	'http://localhost:1234/video/02.png',
		// 	'http://localhost:1234/video/03.png',
		// 	'http://localhost:1234/video/04.png',
		// 	'http://localhost:1234/video/05.png',
		// 	'http://localhost:1234/video/06.png',
		// 	'http://localhost:1234/video/07.png',
		// 	'http://localhost:1234/video/08.png',
		// 	'http://localhost:1234/video/09.png',
		// 	'http://localhost:1234/video/10.png'
		// ];
		// test whith a list of local files
		if (selection_name==="1") {
			listOfURLs.push({url: pixano_local_save_image_directory+'/01.png',id: '01.png'});
			listOfURLs.push({url: pixano_local_save_image_directory+'/02.png',id: '02.png'});
			listOfURLs.push({url: pixano_local_save_image_directory+'/03.png',id: '03png'});
		} else if (selection_name==="2") {
			listOfURLs.push({url: pixano_local_save_image_directory+'/01.png',id: '01.png'});
			listOfURLs.push({url: pixano_local_save_image_directory+'/02.png',id: '02.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/03.png',id: '03.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/04.png',id: '04.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/05.png',id: '05.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/06.png',id: '06.png'});
		} else if (selection_name==="3") {
			listOfURLs.push({url: pixano_local_save_image_directory +'/01.png',id: '01.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/02.png',id: '02.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/03.png',id: '03.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/04.png',id: '04.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/05.png',id: '05.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/06.png',id: '06.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/07.png',id: '07.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/08.png',id: '08.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/09.png',id: '09.png'});
		} else {
			listOfURLs.push({url: pixano_local_save_image_directory +'/01.png',id: '01.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/02.png',id: '02.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/03.png',id: '03.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/04.png',id: '04.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/05.png',id: '05.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/06.png',id: '06.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/07.png',id: '07.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/08.png',id: '08.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/09.png',id: '09.png'});
			listOfURLs.push({url: pixano_local_save_image_directory +'/10.png',id: '10.png'});
		}

		console.info("Minio: got "+listOfURLs.length+" images over "+listIds.length+" in the input list");
		return listOfURLs;
	}
	// Instantiate the minio client with the endpoint
	// and access keys as shown below.
	const minioClient = new Minio.Client({
		endPoint: CONFIG.endPoint,
		port: CONFIG.port,
		useSSL: CONFIG.useSSL,
		accessKey: CONFIG.accessKey,
		secretKey: CONFIG.secretKey
	});

	// check if bucket exists/can be accessed
	if (project_name==='Valeo') CONFIG.bucket_name = 'pixanovaleousecase';// special case : different bucket
	var exists = await minioClient.bucketExists(CONFIG.bucket_name).catch((e) => {throw "Minio: Bucket does not exist\n"+e;});
	if (!exists) throw "Minio: Bucket does not exist";
	console.log('Bucket exists.')

	// Extract the list of image from the bucket
	var data = [];
	var doneData = 0;
	var stream = minioClient.listObjects(CONFIG.bucket_name, '', true);
	stream.on('error', function (e) { throw(e); });
	stream.on('data', function (obj) { data.push(obj); });
	stream.on('end', function () {
		if (data.length===0) throw "Minio: no data found in bucket "+CONFIG.bucket_name;
		//for (var i=0; i<data.length; i++) {//search for urls that correspond to the input list and get them
		data.forEach(obj => {//search for urls that correspond to the input list and get them
			//const obj = data[i];
			// console.log(obj);
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
					if (!sample.id) throw(e);
					// console.log("sample=",sample);
					// console.log("sample.id.replace('.jpgImage', '.jpg')=",sample.id.replace('.jpgImage', '.jpg'));
					if (obj.name.includes(sample.id.replace('.jpgImage', '.jpg'))) {
						console.log(`obj.name ${obj.name} includes sample ${sample}`);
						corresponding=true;
						break;
					}
				}
				if (corresponding) {
					console.log("corresponding sample=",sample);
					//Download image in current directory//... TODO : use web links when available
					minioClient.fGetObject(CONFIG.bucket_name, obj.name, pixano_local_save_image_directory + obj.name, function (e) {
						if (e) throw(e);
						console.info('append:',{url: pixano_local_save_image_directory + obj.name, id: sample.id});
						listOfURLs.push({url: pixano_local_save_image_directory + obj.name, id: sample.id});
						doneData++;
					});
				} else doneData++;
			} else doneData++;
		});//throw errors further
	});//throw errors further
	
	console.log("waitFor",doneData,data.length);
	await waitFor(() => { console.log("test",doneData,data.length); if (data.length>0) return(doneData === data.length); });
	console.log("listOfURLs=",listOfURLs);
	console.info("Minio: got "+listOfURLs.length+" images over "+listIds.length+" in the input list");
	if (listOfURLs.length===0) throw "Minio: no corresponding data found in bucket "+CONFIG.bucket_name;

	return listOfURLs;
}


module.exports = {
	downloadFilesFromMinio
}
