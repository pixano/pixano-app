const level = require('level');
const path = require('path');
const moment = require('moment');
const tmp = require('tmp');
let db = null;
let workspace = null;

function init(workspacepath="") {
    const dbPath = path.join(workspacepath, 'db.ldb');
    db = level(dbPath, {valueEncoding: 'json'});
    workspace = workspacepath;
}

async function put(id , data) {
    try {
      await db.collection(collectionName).doc(id).update(data);
      return {message: "Updated"};
    }
      catch (error) 
      {
        // return throw new "Not Found";
        return post(id, data);
      // return error;
    }
}

function stream(prefix, keys, values, reverse) {
    const params = {gte: `${prefix}!`, lte: `${prefix}~`, reverse};
    return db.createReadStream(params);
}

function streamFrom(from, prefix, reverse=false) {
    if (reverse) {
        return db.createReadStream({gte: `${prefix}!`, lte: from, reverse});
    } else {
        return db.createReadStream({gte: from, lte: `${prefix}~`, reverse});
    }
}

async function post(id,  data) {
    return db.put(id, data);
}


async function del(id) {
    return db.del(id);
}

async function get(id) {
    return db.get(id);
}

async function batch(ops) {
    ops = ops.map((o) => {
        o.type = o.type === 'post' ? 'put' : o.type;
        return o;
    })
    return db.batch(ops);
}

async function createReadStream() {
    return db.createReadStream();
}

async function archive() {
    const archiveRelPath = 'db.ldb-' + moment().format() + '.zip';
    const stream = db.createReadStream();
    return new Promise((resolve) => {
        tmp.dir({unsafeCleanup: true}, async (err, tmpPath, cleanupCallback) => {
            if (err) { throw err; }
            const tmpDb = level(tmpPath, {valueEncoding: 'json'});
            const bm = new batchManager.BatchManager(tmpDb);
            for await (const t of stream) {
                await bm.add({type: 'put', key: t.key, value: t.value });
            }
            await bm.flush();
            tmpDb.close();
            await storage.zipDirectory(tmpPath, archiveRelPath);
            console.log('Archive created: ', archiveRelPath);
            cleanupCallback();
            resolve();
        });
    });
}


module.exports = {
    get,
    put,
    post,
    stream,
    streamFrom,
    createReadStream,
    del,
    batch,
    archive,
    init
}