const { Kafka } = require('kafkajs')
var CONFIG = require('../../exconf.json');

/**
 * Get list of ids to be loaded, from KAFKA
 * @return ["id1","id2",...]: returns the list of selected ids
 * @doc https://kafka.js.org/docs/getting-started
 */
const getIdsInputListFromKafka = async () => {
	console.log("getIdsInputListFromKafka");
	if (JSON.parse(CONFIG.kafka.fake)) return ["labeled/c27-2/190513-1613_2752766_ - C27/", "labeled/c27-2/190522-1642_2776102_ - C27/", "labeled/c27-2/140319-0540_2658484_ - C27_2 (/", "labeled/c27-2/190428-2241_2728102_ - C27/", "labeled/c27-2/190503-1351_2738143_ - C27/", "labeled/c27-2/190527-1208_2780352_ - C27/", "labeled/c27-2/190415-0207_2706182_ - C27/", "labeled/c27-2/190404-1110_2701688_ - C27/", "labeled/c27-2/190514-0536_2763697_ - C27/", "labeled/c27-2/190513-2223_2752649_ - C27/", "labeled/c27-2/190415-0109_2706199_ - C27/", "labeled/c27-2/190514-1410_2763530_ - C27/"];
	// Topic kafka : selection
	// Exemple de message envoyé :
	// {
	//   "origine": "DEBIAI",
	//   "project_name": "Conf-ia renault welding 4.1 Josquin",
	//   "selection_name": "FP",
	//   "date": 1636472282.113034,
	//   "sample_ids": [
	//      "labeled/c27-2/190513-1613_2752766_ - C27/",
	//      "labeled/c27-2/190522-1642_2776102_ - C27/",
	//      "labeled/c27-2/140319-0540_2658484_ - C27_2/",
	//      "labeled/c27-2/190428-2241_2728102_ - C27/",
	//      ...
	//    ]
	// }

	// 1) initialisation
	const kafka = new Kafka({
		clientId: CONFIG.kafka.clientId,
		brokers: CONFIG.kafka.brokers,
		retry: {
			retries: 3,
			restartOnFailure: false
		}
	});
	const kafkaConsumer = kafka.consumer({ groupId: CONFIG.kafka.groupId });

	// 2) get ids
	var sample_ids = [];
	await kafkaConsumer.connect().catch((e) => { throw e; });
	console.log("connected ok");
	await kafkaConsumer.subscribe({ topic: CONFIG.kafka.topicName, fromBeginning: false}).catch((e) => { throw e; });
	console.log("subscribe ok");
	await kafkaConsumer.run({
		eachMessage: async ({ topic, partition, message }) => {
			console.log({
				partition,
				offset: message.offset,
				key: message.key.toString(),
				value: message.value.toString(),
			});
			console.log("message.value=", message.value);
			sample_ids = message.value.sample_ids;
			console.log("sample_ids=", sample_ids);
		}
	}).catch((e) => { throw e; });
	if (sample_ids.length===0) throw "nothing was imported";
	return sample_ids;
}

module.exports = {
	getIdsInputListFromKafka
}
