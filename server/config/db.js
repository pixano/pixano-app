const level = require('level');
const path = require('path');
const dbkeys = require('./db-keys');
const dbConverter = require('../config/db-converter');
const fs = require('fs');


let db = null;
let workspace = '';

async function initLevel(workspacePath) {
    const dbPath = path.join(workspacePath, 'db.ldb');
    db = level(dbPath, {valueEncoding: 'json'});
    workspace = workspacePath;
    // exporting new value
    // of the database
    module.exports.db = db;
    module.exports.workspace = workspace;
    // If no admin user in database create it
    const admin_key = dbkeys.keyForUser('admin');
    return checkDatabaseIntegrity().then(() => {
        return db.get(admin_key).catch(() => {
            return db.put(admin_key, {
                username: 'admin',
                password: 'admin',
                role: 'admin',
                preferences: {theme: 'white'},
                curr_assigned_jobs: {},
                queue: {}
            });
        });
    })
}

async function checkDatabaseIntegrity() {
    // Check database version validity
    let currVersionData;
    try {
        const value = await db.get(dbkeys.keyForVersion());
        currVersionData = value.version;
    } catch(err) { }

    currVersionData = currVersionData || '0.0.0';
    // update if necessary
    await dbConverter.updateDbVersion(db, currVersionData);
}

/**
 * Utility request to print database content
 * @param {Request} _ 
 * @param {Response} res 
 */
function print(_, res) {
    console.log('=============================');
    const stream = db.createReadStream();
    stream.on('data', (pair) => {
        // console.log(pair.key, '=>', pair.value);
        console.log(pair.key);
    }).on('end', () => {
        console.log('=============================');
    });
    if (res) res.send({});
}

/**
 * Utility request to dump database content
 * @param {Request} _ 
 * @param {Response} res 
 */
function dump(_, res) {
    const dumpFile = workspace + '/dump.csv';
    try { fs.unlinkSync(dumpFile);
    } catch (err) {}
    const stream = db.createReadStream();
    stream.on('data', (pair) => {
        fs.appendFileSync(dumpFile, pair.key + ';' + JSON.stringify(pair.value) + '\n');
    });
    res.send();
}

module.exports = {
    initLevel,
    checkDatabaseIntegrity,
    print,
    dump,
    db,
    workspace
}
