const path = require('path');
const { db, workspace } = require('../config/db');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');
const populator = require('../helpers/data-populator');


/**
 * @api {get} /datasets Get list of datasets
 * @apiName GetDatasets
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [{
 *        id: "random_string";
 *        path: "images/"; // relative to workspace
 *        data_type: "image"
 *     }]: DbDataset[]
 * 
 */
async function get_datasets(req, res) {
    checkAdmin(req, async () => {
        try {
            const datasets = [];
            const stream = utils.iterateOnDB(db, dbkeys.keyForDataset(), true, true);
            for await(const {key, value} of stream) {
                if (key.split(':').length == 2) {
                  datasets.push(value)
                }
            }
            return res.send(datasets);
        } catch (err) {
            res.status(400).json({
                message: 'Error searching datasets'
            });
        }
    });
}

/**
 * @api {post} /datasets Add new dataset
 * @apiName PostDatasets
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiParam {RestDataset} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 204 Dataset already existing
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
 * @api {get} /datasets/:dataset_id Get dataset detail
 * @apiName GetDataset
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        id: "random_string";
 *        path: "images/"; // relative to workspace
 *        data_type: "image"
 *     }: DbDataset
 * 
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
 * @api {delete} /dataset/:dataset_id Delete dataset
 * @apiName DeleteDataset
 * @apiGroup Dataset
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function delete_dataset(req, res) {
    checkAdmin(req, async () => {
        const key = dbkeys.keyForDataset(req.params.dataset_id)
        await db.del(key);
        // TODO: delete also its data items
        return res.status(204).json({});
    });
}


/**
 * @api {get} /datasets/:dataset_id/data/:data_id Get data item info
 * @apiName GetData
 * @apiGroup Dataset
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        id: dataData.id, 
 *        dataset_id: dataData.dataset_id, 
 *        type: dataData.type,
 *        children,
 *        path
 *     }: DbData
 * 
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


/**
 * @api {get} /datasets/:dataset_id/data Get all data items
 * @apiName GetDatas
 * @apiGroup Dataset
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     []: DbData[]
 * 
 */
async function get_datas(req, res) {
  const datasetId = req.params.dataset_id;
  const stream = utils.iterateOnDB(db, dbkeys.keyForData(datasetId), false, true);
  const datas = []
  for await(const data of stream) {
    datas.push(data);
  }
  return res.send(datas);
}


///// Utils

/**
 * Get data content from its id
 * @param {string} dataset_id 
 * @param {string} data_id 
 * @param {boolean} relative whether the media path is relative or not to root
 * @returns 
 */
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
		...dataData,
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
	dataset.path = path.normalize(dataset.path+'/');//normalize path in order to not duplicate datasets because of a typo error
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
      const p = Array.isArray(value.path) ? value.path[0] : value.path;
      const relUrl = path.normalize(p.replace(populator.MOUNTED_WORKSPACE_PATH, ''));
      // console.log('relUrl', relUrl);
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
    get_datas,
    getOrcreateDataset,
    getAllDataFromDataset,
    getAllPathsFromDataset,
    getDataDetails
}
