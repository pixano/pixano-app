/**
 * Various utility functions.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const crypto = require('crypto')
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');

const generateKey = () => {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a database stream interator.
 * @param {Level} db 
 * @param {String} prefix 
 * @param {Boolean} keys 
 * @param {Boolean} values 
 * @param {Boolean} reverse 
 */
const iterateOnDB = (db, prefix, keys=true, values=true, reverse=false) => {
  const params = {gte: `${prefix}!`, lte: `${prefix}~`, keys, values, reverse};
  return db.createReadStream(params);
}

/**
 * Create a database stream interator with a starting key.
 * @param {Level} db 
 * @param {String} from starting key
 * @param {String} prefix 
 * @param {Boolean} keys 
 * @param {Boolean} values 
 * @param {Boolean} reverse 
 */
const iterateOnDBFrom = (db, from, prefix, keys=true, values=true, reverse=false) => {
  let params = {keys, values, reverse}
  if (reverse) {
    params.gte = `${prefix}!`;
    params.lt = from;
  } else {
    params.gt = from;
    params.lte = `${prefix}~`;
  }  
  return db.createReadStream(params);
}

/**
 * Utility function to parse recursively a directory.
 * @param {String} dir 
 * @param {String[]} ext 
 * @param {Function} done 
 */
const walk = (dir, ext, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach((file) => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, ext, (err, res) => {
            results = [...results, ...res];
            if (!--pending) done(null, results);
          });
        } else {
          if (ext.includes(file.split('.').pop())) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

/**
 * Remove folder and all its contents.
 * @param {String} path 
 */
const removeDir = function(path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path)
    if (files.length > 0) {
      files.forEach(function(filename) {
        if (fs.statSync(path + "/" + filename).isDirectory()) {
          removeDir(path + "/" + filename)
        } else {
          fs.unlinkSync(path + "/" + filename)
        }
      })
      fs.rmdirSync(path)
    } else {
      fs.rmdirSync(path)
    }
  } else {
    console.log("Directory path not found.")
  }
}

const isSubFolder = function(parent, dir) {
  const relative = path.relative(parent, dir);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

const readJSON = function(filename) {
  try {
    const s = fs.readFileSync(filename);
    return JSON.parse(s);
  } catch (err) {
    console.error(err);
    return {};
  }  
}

const writeJSON = function(data, filename) {
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


/**
 * @param {String} source
 * @param {String} out
 * @returns {Promise}
 */
function zipDirectory(source, out) {
  const archive = archiver('zip', { zlib: { level: 9 }});
  const stream = fs.createWriteStream(out);

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

/**
 * Utility functiont to determine equality between two objects.
 * @param {Object} value 
 * @param {Object} other 
 */
const isEqual = (value, other) => {

	// Get the value type
	const type = Object.prototype.toString.call(value);

	// If the two objects are not the same type, return false
	if (type !== Object.prototype.toString.call(other)) return false;

	// If items are not an object or array, return false
	if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

	// Compare the length of the length of the two items
	const valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
	const otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
	if (valueLen !== otherLen) return false;

	// Compare two items
	const compare = (item1, item2) => {

		// Get the object type
		const itemType = Object.prototype.toString.call(item1);

		// If an object or array, compare recursively
		if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
			if (!isEqual(item1, item2)) return false;
		}

		// Otherwise, do a simple comparison
		else {

			// If the two items are not the same type, return false
			if (itemType !== Object.prototype.toString.call(item2)) return false;

			// Else if it's a function, convert to a string and compare
			// Otherwise, just compare
			if (itemType === '[object Function]') {
				if (item1.toString() !== item2.toString()) return false;
			} else {
				if (item1 !== item2) return false;
			}

		}
	};

	// Compare properties
	if (type === '[object Array]') {
		for (let i = 0; i < valueLen; i++) {
			if (compare(value[i], other[i]) === false) return false;
		}
	} else {
		for (let key in value) {
			if (value.hasOwnProperty(key)) {
				if (compare(value[key], other[key]) === false) return false;
			}
		}
	}

	// If nothing failed, return true
	return true;

};

const pathToFilename = (path, removeExt = true) => {
  const regex = /[^\/]/g;
  const idx0 = path.search(regex);
  let idx1 = path.search('\\/$');
  idx1 = idx1 <= 0 ? path.length : idx1;
  // path with no leading or trailing slashes
  let filename = path.slice(idx0, idx1);
  filename = filename.replace(new RegExp('/', 'g'), '_');
  if (removeExt) {
    const exts = ['.jpg', '.jpeg', '.png', '.bin'];
    exts.forEach((e) => filename = filename.replace(e, ''));
  }
  return filename;
}



module.exports = {
  generateKey,
  iterateOnDB,
  iterateOnDBFrom,
  isEqual,
  zipDirectory,
  removeDir,
  readJSON,  
  writeJSON,
  isSubFolder,
  pathToFilename
}