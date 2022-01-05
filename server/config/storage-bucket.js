const {Storage} = require('@google-cloud/storage');
const path = require('path');
let storage = null;


function init() {
    storage = new Storage({keyFilename: './server/config/firebaseServiceAccount.json'});
}

const toRelativePath = (url) => { return url; };


async function parseFolder(url, ext, bucketName = 'valeo-cp1816-dev.appspot.com') {
    // Lists files in the bucket
    url = url.split(path.sep).join(path.posix.sep);

    const [files] = await storage.bucket(bucketName).getFiles({ prefix: url});

    const metaPromises = files.map((f) => f.name);
    const fileUrls = (await Promise.all(metaPromises)).filter(d => {
        return d[d.toString().length-1] != '/'
    });
    console.log("fileUrls ", fileUrls);
    // regroup files by directory
    const fileSepUrls = {};
    fileUrls.forEach((f) => {
        const dirname = path.dirname(f);
        const url = "https://storage.cloud.google.com/valeo-cp1816-dev.appspot.com/" + f;
        if (fileSepUrls[dirname]) {
            fileSepUrls[dirname].push(url);
        } else {
            fileSepUrls[dirname] = [url];
        }
    });
    return {folders: fileSepUrls, total: fileUrls.length};
}


async function parseImportFolder(relPath) {
    const importInfo = {};

    console.info('Importing annotation files.')
    // filter all json files
    const [files] = await storage.bucket('valeo-cp1816-dev.appspot.com').getFiles({ prefix: 'export/'+req.body.path+"/", delimiter: '/'});
    const taskJsonFiles = files.map((f) => f.download()[0]);
    console.log('taskJsonFiles', taskJsonFiles);
    // List all task annotation files
    // const annJsonFiles = taskFiles.map((f) => {
    //     if(f.name.split('/').length == 4) {
    //         return f.download();
    //     }
    //     return "";
    // });
    // taskJsonFiles.forEach((taskFile) => {
    //     const taskFolder = taskFile.substring(0, taskFile.length - 5);
    //     const annList = fs.readdirSync(path.join(importPath, taskFolder));
    //     const annJsonFiles = annList.filter(f => f.endsWith('.json'));
    //     importInfo[taskFile] = annJsonFiles;
    // });
    return importInfo;
}


function readJson(filename) {
    try {
        const s = fs.readFileSync(filename);
        return JSON.parse(s);
    } catch (err) {
        console.error(err);
        return {};
    }
}


/**
 * @param {String} source
 * @param {String} out
 * @returns {Promise}
 */
 function zipDirectory(source, out) {
    // TO IMPLEMENT
    return Promise.resolve();
}


async function getThumbnail(browserUrl) {
    // TO IMPLEMENT
    return '';
}

module.exports = {
    init,
    parseFolder,
    getThumbnail,
    readJson,
    parseImportFolder,
    zipDirectory,
    toRelativePath
}