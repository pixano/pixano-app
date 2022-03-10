const { Kafka } = require('kafkajs')
var CONFIG = require('../../config/kafka.json');
var num = 1;// TODO: temporary, only used for fake kafka
/**
 * Get list of ids to be loaded, from KAFKA
 * @return { sample_ids: {...}, project_name: '', selection_name: '', date: '' }: returns the list of selected ids
 * @doc https://kafka.js.org/docs/getting-started
 */
const getSelectionFromKafka = async () => {
	console.log("getSelectionFromKafka");
	// data to be retrived
	var sample_ids = [];
	var project_name = "";
	var selection_name = "";
	var date = "";

	if (JSON.parse(CONFIG.fake)) {
		sample_ids = [{id:"191120-0954_1597536_ - C65_OK.jpgImage"},{id:"191003-2237_6318756_ - C10_OK.jpgImage"},{id:"191003-2237_2953236_ - C101_OK.jpgImage"},{id:"191120-0954_3034415_ - C34_OK.jpgImage"}];
		project_name = "my project";
		if (num<=3) selection_name = num.toString();
		else selection_name = "my selection";
		num++;
		date = "today";
		return { sample_ids: sample_ids, project_name: project_name, selection_name: selection_name, date: date };
	}
	// Topic kafka : selection
	// FORMAT:
	// {
	//	"origine": "DEBIAI", 
	//	"project_name": "Renault welding 4.1", 
	//	"selection_name": "for_pixano", 
	//	"date": 1639664706.857575, 
	//	"sample_ids": [ 
	//		{
	//			"dataset": "not_labeled",                 
	//			"subject": "c34", 
	//			"relative_path": "not_labeled/c34/", 
	//			"url": "", 
	//			"type": "image" 
	//			"id": "191003-2237_2953236_ - C101_OK.jpgImage" 
	//		}, 
	//		... 
	//	]
	// }

	// 1) initialisation
	const kafka = new Kafka({
		clientId: CONFIG.clientId,
		brokers: CONFIG.brokers,
		retry: {
			retries: 3,
			restartOnFailure: false
		}
	});
	const kafkaConsumer = kafka.consumer({ groupId: CONFIG.groupId });

	// 2) get ids (with timeout)
	await kafkaConsumer.connect().catch((e) => { throw e; });
	await kafkaConsumer.subscribe({ topic: CONFIG.topicName, fromBeginning: true}).catch((e) => { throw e; });//fromBeginning has to be true in order to be able to get messages sent before calling this function
	
	var resolveOnConsumption = () => { console.log("resolveOnConsumption"); };
	var consumePromise = new Promise((resolve, reject) => { resolveOnConsumption = resolve });
	const timeoutms = 5000;
	var timeOutPromise = new Promise((resolve, reject) => { setTimeout(reject,timeoutms) }); 
	
	kafkaConsumer.run({
		eachMessage: async ({ message }) => {
			console.log("message=",message.value.toString());
			const val = JSON.parse(message.value.toString());
			sample_ids = val.sample_ids;
			project_name = val.project_name;
			selection_name = val.selection_name;
			date = val.date;
			resolveOnConsumption();
		}
	}).catch((e) => { throw "Kafka: run: "+e; });
	
	var timeout=false;
	await Promise.race([consumePromise,timeOutPromise])
		.then(res => { console.log("promise race ok");})
		.catch(res => { timeout = true; })
		.finally(() => kafkaConsumer.disconnect());
	
//	console.log("sample_ids===",sample_ids);
	if (timeout) throw "Kafka: timeout, no data found";
	if (sample_ids.length===0) throw "Kafka: nothing was imported";
	return { sample_ids: sample_ids, project_name: project_name, selection_name: selection_name, date: date };
}

module.exports = {
	getSelectionFromKafka
}
