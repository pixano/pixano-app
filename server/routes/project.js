// const db = require('../config/db-leveldb');
const db = require('../config/db');


/**
 * @api {post} /project/snapshot Export database to a zipped dated snapshot folder
 * @apiName PostProject
 * @apiGroup Project
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 */
async function snapshot_project(_, res) {
    await db.archive();
    res.json({});
}

module.exports = {
    snapshot_project
}
