const path = require('path');
const normalize = require('normalize-path');
const { db,
  workspace } = require('../config/db');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');
const populator = require('../helpers/data-populator');


/**
 * Get list of datasets. Admin only.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_datasets(req, res) {
    checkAdmin(req, async () => {
        try {
            const datasets = [];
            const stream = utils.iterateOnDB(db, dbkeys.keyForDataset(), false, true)
            stream.on('data', (value) => {
                datasets.push(value);
            }).on('end', () => {
                return res.send([...datasets]);
            });
        } catch (err) {
            res.status(400).json({
                message: 'Error searching datasets'
            });
        }
    });
}

/**
 * Add a new dataset.
 * @param {Request} req 
 * @param {Response} res 
 */
async function post_datasets(req, res) {
    checkAdmin(db, req, async () => {
        const dataset = req.body;
        const ret = await getOrcreateDataset(db, dataset.path, workspace)
        if (ret) {
            return res.status(201).json(ret)
        }
        else {
            return res.status(204).json({})
    }
});
}

/**
 * Get dataset detail from its id. Admin only.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_dataset(req, res) {
    checkAdmin(req, async () => {
        try {
            const datasetData = await db.get(dbkeys.keyForDataset(req.params.dataset_id))
            return res.send(datasetData);
        } catch (err) {
          return res.status(400).json({
              message: 'Unknown dataset ' + req.params.dataset_id
          });
        }
    });
}

/**
 * Delete dataset from its its. Admin only.
 * @param {Request} req 
 * @param {Response} res 
 */
async function delete_dataset(req, res) {
    checkAdmin(req, async () => {
        const key = dbkeys.keyForDataset(req.params.dataset_id)
        await db.del(key);
        return res.status(204).json({});
    });
}


/**
 * Get data information from its id and its dataset_id.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_data(req, res) {
    try {
        const output = await getDataDetails(req.params.dataset_id, req.params.data_id);
        return res.send(output);
    } catch (err) {
        return res.status(400).json({
            type: 'unknown_data',
            message: 'Unknown data ' + req.params.data_id + ' for dataset ' + req.params.dataset_id
        });
    }
}

const getDataDetails = async (dataset_id, data_id, relative = false) => {
    const dataData = await db.get(dbkeys.keyForData(dataset_id, data_id));
    let path = dataData.path;
    let children = dataData.children;
    if (relative) {
      path = populator.toRelative(path);
      if (children) {
        children = children.map((d) => ({...d, path: populator.toRelative(d.path)}));
      }
    }
    const output = {
      id: dataData.id, 
      dataset_id: dataData.dataset_id, 
      type: dataData.type,
      children,
      path
    };
    return output; 
}

/**
 * Create dataset entry and generate default low-level data entries.
 * @param {Level} db 
 * @param {String} path 
 * @param {String} workspace 
 */
async function getOrcreateDataset(dataset, workspace) {
    const existingDataset = await getDatasetFromPath(db, dataset.path, dataset.data_type);
    if (!existingDataset) {
      const newDataset = {
        ...dataset,
        id: utils.generateKey()
      }
      await db.put(dbkeys.keyForDataset(newDataset.id), newDataset);
      await populator[dataset.data_type](db, newDataset.path, workspace, newDataset.id)
      return newDataset;
    } else {
      return existingDataset;
    }
}

/**
 * Get dataset entry from a dataset path if it exists.
 * @param {Level} db 
 * @param {String} path 
 */
const getDatasetFromPath = (db, path, data_type) => {
    let foundDataset = null;
    return new Promise((resolve, reject) => {
      // update datasets if previously unknown data path is given
      const s1 = utils.iterateOnDB(db, dbkeys.keyForDataset(), false, true);
      s1.on('data', (value) => {
        if (value.path === path && value.data_type === data_type) {
          foundDataset = value;
          s1.destroy();
        }   
      }).on('close', () => {
        resolve(foundDataset);   
      });
    });
}

/**
 * Retrieve all data ids for a given data type.
 * @param {Level} db
 * @param {String} dataset_id
 * @param {String} type
 */
function getAllDataFromDataset(dataset_id) {
    const dataList = [];
    const stream = utils.iterateOnDB(db, dbkeys.keyForData(dataset_id), true, false)
    return new Promise((resolve) => {
      stream.on('data', (key) => {
        dataList.push(key.slice(dbkeys.keyForData(dataset_id).length));
      }).on('end', () => {
        resolve(dataList);
      })
    });
}

/**
 * Retrieve all data paths for a given data type.
 * @param {Level} db
 * @param {String} dataset_id
 * @param {String} type
 */
function getAllPathsFromDataset(dataset_id) {
  const dataMap = {};
  const stream = utils.iterateOnDB(db, dbkeys.keyForData(dataset_id), false, true)
  return new Promise((resolve) => {
    stream.on('data', (value) => { 
      const relUrl = value.path.replace(populator.MOUNTED_WORKSPACE_PATH, '').replace(/\//g, '');
      dataMap[relUrl] = value.id;
    }).on('end', () => {
      resolve(dataMap);
    })
  });
}

module.exports = {
    get_datasets,
    post_datasets,
    get_dataset,
    delete_dataset,
    get_data,
    getOrcreateDataset,
    getAllDataFromDataset,
    getAllPathsFromDataset,
    getDataDetails
}
