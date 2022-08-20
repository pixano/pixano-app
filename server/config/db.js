const dbkeys = require('./db-keys');
const dbConverter = require('../config/db-converter');
const db = require('../config/db-firestore');
const storage = require('../config/storage-bucket');
// module.exports.db = db;
// module.exports.storage = storage;

async function initDB(workspacePath) {
    db.init(workspacePath);
    storage.init(workspacePath);
    // If no admin user in database create it
    const admin_key = dbkeys.keyForUser('tom.keldenich@valeo.com');
    return checkDatabaseIntegrity().then(() => {
        return db.get(admin_key).catch(() => {
            return db.put(admin_key, {
                username: 'tom.keldenich@valeo.com',
                password: 'admin',
                role: 'admin',
                preferences: {theme: 'white'},
                curr_assigned_jobs: {},
                queue: {}
            });
        });
    });
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
    await dbConverter.updateDbVersion(currVersionData);
}

// /**
//  * Utility request to print database content
//  * @param {Request} _ 
//  * @param {Response} res 
//  */
// function print(_, res) {
//     console.log('=============================');
//     const stream = db.createReadStream();
//     stream.on('data', (pair) => {
//         // console.log(pair.key, '=>', pair.value);
//         console.log(pair.key);
//     }).on('end', () => {
//         console.log('=============================');
//     });
//     res.send({});
// }

// /**
//  * Utility request to dump database content
//  * @param {Request} _ 
//  * @param {Response} res 
//  */
// function dump(_, res) {
//     const dumpFile = workspace + '/dump.csv';
//     try { fs.unlinkSync(dumpFile);
//     } catch (err) {}
//     const stream = db.createReadStream();
//     stream.on('data', (pair) => {
//         fs.appendFileSync(dumpFile, pair.key + ';' + JSON.stringify(pair.value) + '\n');
//     });
//     res.send();
// }

module.exports = {
    initDB,
    checkDatabaseIntegrity
}
