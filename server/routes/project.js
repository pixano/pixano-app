const path = require('path');
const moment = require('moment');
const tmp = require('tmp');
const level = require('level');
const { db, workspace } = require('../config/db');
const utils = require('../helpers/utils');
const batchManager = require('../helpers/batch-manager');


/**
 * @api {post} /project/snapshot Export database to a zipped dated snapshot folder
 * @apiName PostProject
 * @apiGroup Project
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 */
async function snapshot_project(_, res) {
    const archivePath = path.join(workspace, '/db.ldb-' + moment().format() + '.zip');
    const stream = db.createReadStream();
    tmp.dir({unsafeCleanup: true}, async (err, path, cleanupCallback) => {
        if (err) { throw err; }
        const tmpDb = level(path, {valueEncoding: 'json'});
        const bm = new batchManager.BatchManager(tmpDb);
        for await (const t of stream) {
            await bm.add({type: 'put', key: t.key, value: t.value });
        }
        await bm.flush();
        tmpDb.close();
        console.log('Archive created: ', archivePath);
        await utils.zipDirectory(path, archivePath);
        res.json({});
        cleanupCallback();
    });    
}

module.exports = {
    snapshot_project
}
