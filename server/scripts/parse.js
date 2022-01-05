const level = require('level');
const utils = require('../helpers/utils');
const dbkeys = require('../config/db-keys');
const dbPath = '/home/cdupont/dev/pixano/pixano-app/data-test/db.ldb';
db = level(dbPath, {valueEncoding: 'json'});

async function loop() {
    const streamA = db.stream(dbkeys.keyForDataset(), true, false);
    const datasetIds = []
    for await(const key of streamA) {
        if (key.split(':').length == 2) {
            datasetIds.push(key)
        }
    }
    console.log('datasetIds', datasetIds)
    const streamB = db.stream('', true, true);
    for await(const {key, value} of streamB) {
        key = key.slice(dbkeys.keyForData(datasetIds[0]).length);
        console.log('key', key);
        
    }
}

loop();