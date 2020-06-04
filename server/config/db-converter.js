/**
 * Various utility functions to interact with the level database.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const path = require('path');
const semver = require('semver');
const dbkeys = require('./db-keys');
const utils = require('../helpers/utils');
const { toRelative } = require('../helpers/data-populator');
const pkg = require('../../package');

const REFERENCE_DB_VERSION = ['0.2.0', '0.1.0', '0.0.0'];

async function convert_0_0_0_to_0_1_0(db) {
  console.log('Upgrading DB from version 0.0.0 to 0.1.0');

  const ops = [];
  const stream = utils.iterateOnDB(db, dbkeys.keyForAllResults(), true, true);
  for await(const pair of stream) {
    const key = pair.key;
    const result = pair.value;
    result.annotator = result.user;
    result.validator = '';
    delete result.user;
    ops.push({ type: 'put', key, value: result});
  }
  await db.batch(ops);
}

async function convert_0_1_0_to_0_2_0(db) {
  console.log('Upgrading DB from version 0.1.0 to 0.2.0');

  const stream = utils.iterateOnDB(db, dbkeys.keyForDataset(), true, true);
  for await(const pair of stream) {
    const key = pair.key;
    const data = pair.value;
    if (key.split(':').length <= 2) {
      continue;
    }
    if (data.path === '') {
      // Complex type case
      if (data.children.length == 0) {
        continue
      }
      const child = data.children[0];
      const elem_type = typeof child;
      if (elem_type === 'string') {
        // tuple case
      } else if (elem_type === 'object' && child.timestamp !== undefined && child.img_ids !== undefined) {
        // sequence case
        // First loop over frames of the sequence
        const urlSeqPromises = data.children.map(
          async (frame) => {
            const elem_data = await db.get(dbkeys.keyForData(data.dataset_id, frame.img_ids[0]));
            data.path = path.dirname(elem_data.path).replace('/data/', '')
            return {timestamp: frame.timestamp, path: elem_data.path}              
          });
        data.children = await Promise.all(urlSeqPromises);
        db.put(key, data);
      }
    }
  }
  const stream2 = utils.iterateOnDB(db, dbkeys.keyForSpec(), true, true);
  for await (const pair of stream2) {
    pair.value.plugin_name = pair.value.plugin_name.replace('video', 'sequence');
    db.put(pair.key, pair.value);
  }
}

/**
 * Check database validity. Return true version is recent enough, otherwise return false.
 * @param {String} version 
 */
const checkDbVersion = (version) => {
  console.log('Checking version :', version)
  if (semver.gte(version, REFERENCE_DB_VERSION[0])){
    return true;
  }
  return false;
}

/**
 * Check database validity. Return true version is recent enough, otherwise return false.
 * @param {String} version version of database to be updated
 */
async function updateDbVersion(db, db_version) {
  console.log('Checking DB version', db_version);
  let idx;
  for (idx = 0; idx < REFERENCE_DB_VERSION.length; idx++) {
    if (semver.gte(db_version, REFERENCE_DB_VERSION[idx])){
      break;
    }
  }
  const upgrade = REFERENCE_DB_VERSION.slice(0,idx+1).reverse();

  if(upgrade.length > 1) {
    console.log('version to upgrade', upgrade);
    for (idx = 0; idx < upgrade.length-1; idx++) {
      const from = upgrade[idx].replace(/\./g, '_');
      const to = upgrade[idx+1].replace(/\./g, '_');
      const cmd = `convert_${from}_to_${to}(db)`;
      await eval(cmd);
    }
  
    // Update current version of database
    console.log('Setting new DB version', pkg.version);
    await db.put(dbkeys.keyForVersion(), {version: pkg.version});
  } else {
    console.log('This DB version is OK');
  }
}


module.exports = {
  checkDbVersion,
  updateDbVersion
}
