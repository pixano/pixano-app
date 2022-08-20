const level = require('level');
const utils = require('../helpers/utils');
const dbkeys = require('../config/db-keys');
const dbPath = 'C:\Users\tkeldeni\Desktop\pixano-app_2\data-test\db.ldb';
db = level(dbPath, {valueEncoding: 'json'});

async function loop() {
    const streamA = utils.iterateOnDB(db, dbkeys.keyForResult(), true, false);
    const datasetIds = []
    for await(const key of streamA) {
        console.log(key)
    }
}

loop();
