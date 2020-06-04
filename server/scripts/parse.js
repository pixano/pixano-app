const level = require('level');
const utils = require('../helpers/utils');
const dbPath = '/home/cdupont/data/valeo/groundmarkings/reception/20200104/dev.ldb-2020-01-04-05-11-44/dev.ldb';
db = level(dbPath, {valueEncoding: 'json'});

async function loop() {
    const stream = utils.iterateOnDB(db, '', true, true);
    for await(const {key, value} of stream) {
        console.log('key', key);
    }
}

loop();