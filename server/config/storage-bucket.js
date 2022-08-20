const {Storage} = require('@google-cloud/storage');
const imageThumbnail = require('image-thumbnail');
const path = require('path');
const bucketHttpPrefix = "https://storage.cloud.google.com/valeo-cp1816-dev.appspot.com/";
let storage = null;
let bucket = null;

function init() {
    storage = new Storage({keyFilename: './server/config/firebaseServiceAccount.json'});
    bucket = storage.bucket('valeo-cp1816-dev.appspot.com')
}


/**
 * Way the data path is stored, relative to the data root storage (need POSIX format)
 * @param {*} url 
 * @returns 
 */
const toRelativePath = (url) => {
    if (Array.isArray(url)) {
        return url.map((u) => path.normalize(u).split(path.sep).join(path.posix.sep).replace(bucketHttpPrefix, ''));
    } else {
        return path.normalize(url).split(path.sep).join(path.posix.sep).replace(bucketHttpPrefix, '');
    }
 };

/**
 * Way the data path is accessible on the client side
 * @param {*} url 
 * @returns 
 */
const toClientPath = (url) => {
    url = toRelativePath(url);
    if (Array.isArray(url)) {
        return url.map((u) => bucketHttpPrefix + u);
    } else {
        // console.log('browser url', bucketHttpPrefix + url)
        return bucketHttpPrefix + url;
    } 
};

/**
 * Way the data path is accessible on the backend side
 * @param {*} url 
 * @returns 
 */
const toBackendPath = toRelativePath;


async function parseFolder(url, ext) {
    // Lists files in the bucket
    const [files] = await bucket.getFiles({ prefix: toRelativePath(url)});
    const metaPromises = files.map((f) => f.name);
    const fileUrls = (await Promise.all(metaPromises)).filter(d => {
        return d[d.toString().length-1] != '/'
    });
    // regroup files by directory
    const fileSepUrls = {};
    fileUrls.forEach((f) => {
        const dirname = path.dirname(f);
        const url = f;
        if (fileSepUrls[dirname]) {
            fileSepUrls[dirname].push(url);
        } else {
            fileSepUrls[dirname] = [url];
        }
    });
    return {folders: fileSepUrls, total: fileUrls.length};
}

/**
 * Import relative path containing task content.
 * @param {string} relPath 
 * @returns {[relTaskFile]: relAnnFiles[]} relative path from storage root of task file and annotation files.
 * eg. {"export/task1.json": ["export/task1/image1.json", "export/task1/image2.json"]}
 */
async function parseImportFolder(relPath) {
    const importInfo = {};

    console.info('Importing annotation files.')
    // filter all json files
    // to only include top-level files, we ignore files which include "/" (cf. delimiter)
    // TODO: find a way to always have a trailing / at the end
    console.log('url:::', toRelativePath(relPath + "/"))
    const [files] = await bucket.getFiles({ prefix: toRelativePath(relPath + "/"), delimiter: "/"});
    const taskJsonFiles = (await Promise.all(files.map((f) => f.name))).filter(d => d.endsWith('.json'));

    for (const taskFile of taskJsonFiles) {
        let taskFolder = path.basename(taskFile.substring(0, taskFile.length - 5));
        taskFolder = toRelativePath(path.join(relPath, taskFolder+ "/"));
        console.log('taskFolder', taskFolder)
        const [annList] = await bucket.getFiles({ prefix: taskFolder });
        console.log('annList', annList)
        // const annList = fs.readdirSync(path.join(importPath, taskFolder));
        const annJsonFiles = (await Promise.all(annList.map((f) => f.name))).filter(d => d.endsWith('.json'));
        console.log('annList', annJsonFiles)
        importInfo[taskFile] = annJsonFiles;
    }
    return importInfo;
}

function writeJSON(data, filename) {
    const fileName = bucket.file(filename);
    fileName.save(JSON.stringify(data), (err) => {
    if (!err) {
        console.log(`Successfully uploaded ${fileName}`)
    } else {
        console.error('Upload error:' + err);
    }

});
}


async function readJson(filename) {
    try {
        const [file] = await bucket
                .file(toBackendPath(filename))
                .download();
        return JSON.parse(file.toString('utf8'));
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


async function getThumbnail(relUrl) {
    const stream = bucket.file(relUrl).createReadStream();
    const thumbnail = await imageThumbnail(stream, {responseType: 'base64', height: 100, jpegOptions: { force:true, quality: 70}});
    return thumbnail;
    // Downloads the file
    // return new Promise((resolve) => {
    //     var chunkNew = new Buffer.from('');
    //     const stream = bucket.file(relUrl).createReadStream();
    //     const thumbnail = await imageThumbnail(stream, {responseType: 'base64', height: 100, jpegOptions: { force:true, quality: 70}});
    //     resolve(thumbnail);
        // bucket.file(relUrl).createReadStream().on('data', (chunk) => {
        //     chunkNew = Buffer.concat([chunkNew,chunk]);
        // })
        // .on('end', async () => {
        //     const thumbnail = await imageThumbnail(chunkNew.toString('base64'), {responseType: 'base64', height: 50});
        //     resolve(thumbnail);
        // })
    //});
}

module.exports = {
    init,
    parseFolder,
    getThumbnail,
    readJson,
    writeJSON,
    parseImportFolder,
    zipDirectory,
    toRelativePath,
    toBackendPath,
    toClientPath
}