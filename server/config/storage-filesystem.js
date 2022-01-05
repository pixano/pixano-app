const imageThumbnail = require('image-thumbnail');
const path = require('path');
const fs = require('fs');
const MOUNTED_WORKSPACE_PATH = '/data/';
let workspace = "";

function init(workspacePath="") {
    workspace = workspacePath;
}

const toRelativePath = (url) => {
    if (Array.isArray(url)) {
      return url.map((u) => u.replace(MOUNTED_WORKSPACE_PATH, ''));
    } else {
      return url.replace(MOUNTED_WORKSPACE_PATH, '');
    }
}


function parseImportFolder(relPath) {
    const importInfo = {};
    const importPath = path.join(workspace, relPath);
    console.log('##### Importing from ', importPath);
    if(!utils.isSubFolder(workspace, importPath)) {
        throw 'wrong_folder';
    }
    if (!fs.existsSync(importPath)) {
        throw 'wrong_folder';
    }
    console.info('Importing annotation files.')
    // filter all json files
    const taskJsonFiles = fs.readdirSync(importPath)
                        .filter(f => f.endsWith('.json') && !f.startsWith('_'));

    // List all task annotation files
    taskJsonFiles.forEach((taskFile) => {
        const taskFolder = taskFile.substring(0, taskFile.length - 5);
        const annList = fs.readdirSync(path.join(importPath, taskFolder));
        const annJsonFiles = annList.filter(f => f.endsWith('.json'));
        importInfo[taskFile] = annJsonFiles;
    });
    return importInfo;
}


function writeJSON(data, filename) {
    filename = path.join(workspace, filename);
    // If path does not exist create it
    if (!fs.existsSync(path.dirname(filename))) {
        fs.mkdirSync(path.dirname(filename), {recursive: true});
    }

    const json_string = JSON.stringify(data, null, 1);
    fs.writeFile(filename, json_string, (err) => {
      if (err) {
        console.error(err);
        return err;
      }
      console.log(`${filename} written`);
      return err;
    });
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
    const outPath = path.join(workspace, out);
    const archive = archiver('zip', { zlib: { level: 9 }});
    const stream = fs.createWriteStream(outPath);

    return new Promise((resolve, reject) => {
        archive
        .directory(source, false)
        .on('error', err => reject(err))
        .pipe(stream)
        ;

        stream.on('close', () => resolve());
        archive.finalize();
    });
}


async function getThumbnail(browserUrl) {
    const hostUrl = path.join(workspace, path.normalize(browserUrl.replace(MOUNTED_WORKSPACE_PATH, '')));
    return await imageThumbnail(hostUrl, {responseType: 'base64', height: 100});
}

/**
 * Parse folder for data files.
 * @param {string} dir 
 * @param {string[]} extensions 
 */
function parseFolder(relPath, extensions = ['jpg', 'png']) {
    const dir = path.resolve(workspace, relPath); // host folder
    return new Promise((resolve, reject) => {
        console.info(`Parsing folder ${dir}`);
        if (!(fs.existsSync(dir))) {
            console.log("Directory does not exist.")
            return resolve({folders: {}});
        }
        // bar.start(0, 0);
        walk(dir, extensions, (err, result) => {
        // bar.stop();
        if (err) throw err;
            resolve(result);
        });
    });
}

/**
 * Utility function to parse recursively a directory.
 * @param {String} dir 
 * @param {String[]} ext 
 * @param {Function} done 
 */
const walk = (dir, ext, done) => {
    let folders = {}
    let total = 0;

    fs.readdir(dir, (err, list) => {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, {folders, total});
        list.forEach((file) => {
        file = path.resolve(dir, file);
        fs.stat(file, (err, stat) => {
            if (stat && stat.isDirectory()) {
            // bar.setTotal(bar.total + 1);
            walk(file, ext, (err, out) => {
                folders = {...folders, ...out.folders}
                total += out.total;
                // bar.increment();
                if (!--pending) {
                done(null, {folders, total});
                }
            });
            } else {
            if (ext.includes(file.split('.').pop())) {
                if (!folders[dir]) folders[dir] = [];
                const browserUrl = path.normalize(file.replace(workspace, MOUNTED_WORKSPACE_PATH));
                folders[dir].push(browserUrl);
                total += 1;
            }
            if (!--pending) done(null, {folders, total});
            }
        });
        });
    });
};

module.exports = {
    parseFolder,
    getThumbnail,
    init,
    parseImportFolder,
    readJson,
    writeJSON,
    zipDirectory,
    toRelativePath
}