const { Kafka } = require('kafkajs')
var CONFIG = require('../../config/kafka.json');
const { db } = require('../config/db');
const dbkeys = require('../config/db-keys');
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
		//BR sample_ids = [{id:"191120-0954_1597536_ - C65_OK.jpgImage"},{id:"191003-2237_6318756_ - C10_OK.jpgImage"},{id:"191003-2237_2953236_ - C101_OK.jpgImage"},{id:"191120-0954_3034415_ - C34_OK.jpgImage"}];
		//BR autres samples, ceux ci dessus n'ont pas l'air de fonctionner
		sample_ids = [{id:"190923-1923_2934278_ - C101_OK.jpg"},{id:"190925-0102_2934389_ - C101_OK.jpg"}];
		// project_name = "my project";
		project_name = 'Valeo';
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
	const kafkaBrocker = await db.get(dbkeys.keyForCliOptions).then((options) => { return options.kafka });
	// 1) initialisation
	const kafka = new Kafka({
		clientId: CONFIG.clientId,
		brokers: [kafkaBrocker],
		retry: {
			retries: 3,
			restartOnFailure: false
		}
	});
	const kafkaConsumer = kafka.consumer({ groupId: CONFIG.groupId });

	// 2) get ids (with timeout)
	//BR
	console.log("BR 1 brocker:", kafkaBrocker);
	await kafkaConsumer.connect().catch((e) => { throw e; });
	console.log("BR 2");
	await kafkaConsumer.subscribe({ topic: CONFIG.topicName, fromBeginning: true}).catch((e) => { throw e; });//fromBeginning has to be true in order to be able to get messages sent before calling this function
	console.log("BR 3 consumer:", kafkaConsumer);
	
	var resolveOnConsumption = () => { console.log("resolveOnConsumption"); };
	var consumePromise = new Promise((resolve, reject) => { resolveOnConsumption = resolve });
	console.log("BR 4");
	const timeoutms = 5000;    //BR from 5000 to 15000
	var timeOutPromise = new Promise((resolve, reject) => { setTimeout(reject,timeoutms) }); 
	console.log("BR 5");
	
	kafkaConsumer.run({
		eachMessage: async ({ message }) => {
			console.log("message=",message.value.toString());
			const val = JSON.parse(message.value.toString().split("\'").join("\""));//replace ' by " (can happen in kafka messages, not interpreted by JSON.parse)
			sample_ids = val.sample_ids;
			project_name = val.project_name;
			selection_name = val.selection_name;
			date = val.date;
			console.log("BR 6.1");
			resolveOnConsumption();
			console.log("BR 6.2");
		}
	}).catch((e) => { throw "Kafka: run: "+e; });
	console.log("BR 7");

	var timeout=false;
	await Promise.race([consumePromise,timeOutPromise])
		.then(res => { console.log("promise race ok");})
		.catch(res => { timeout = true; })
		.finally(() => kafkaConsumer.disconnect());
	console.log("BR 8");
	
//	console.log("sample_ids===",sample_ids);
	if (timeout) throw "Kafka: timeout, no data found";
	if (sample_ids.length===0) throw "Kafka: nothing was imported";
	return { sample_ids: sample_ids, project_name: project_name, selection_name: selection_name, date: date };
}

module.exports = {
	getSelectionFromKafka
}
