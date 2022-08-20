const db = require('../config/db-firestore');
const storage = require('../config/storage-bucket');

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
            const stream = db.stream(dbkeys.keyForDataset(), true, true);
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
        const ret = await getOrcreateDataset(dataset.path)
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
  const stream = db.stream(dbkeys.keyForData(datasetId), false, true);
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
      path = storage.toRelativePath(path);
      if (children) {
        children = children.map((d) => ({...d, path: storage.toRelativePath(d.path)}));
      }
    } else {
      path = storage.toClientPath(path);
      if (children) {
        children = children.map((d) => ({...d, path: storage.toClientPath(d.path)}));
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
 * @param {String} path
 */
async function getOrcreateDataset(dataset) {
	dataset.path = utils.toNormalizedPath(dataset.path+'/');
    const existingDataset = await getDatasetFromPath(dataset.path, dataset.data_type);
    if (!existingDataset) {
      const newDataset = {
        ...dataset,
        id: utils.generateKey()
      }
      await db.put(dbkeys.keyForDataset(newDataset.id), newDataset);
      await populator[dataset.data_type](db, newDataset.path, newDataset.id)
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
const getDatasetFromPath = async (path, data_type) => {
    let foundDataset = null;
    // update datasets if previously unknown data path is given
    const stream = db.stream(dbkeys.keyForDataset(), false, true);
    for await(const {value} of stream) {
      if (value.path === path && value.data_type === data_type) {
        foundDataset = value;
        break;
      }
    }
    return foundDataset;
}

/**
 * Retrieve all data ids for a given data type.
 * @param {Level} db
 * @param {String} dataset_id
 * @param {String} type
 */
async function getAllDataFromDataset(dataset_id) {
    const dataList = [];
    const stream = db.stream(dbkeys.keyForData(dataset_id), true, false);
    for await (const {key} of stream) {
      dataList.push(key.slice(dbkeys.keyForData(dataset_id).length));
    }
    return dataList;
}

/**
 * Retrieve all data paths for a given data type.
 * @param {Level} db
 * @param {String} dataset_id
 * @param {String} type
 */
async function getAllPathsFromDataset(dataset_id) {
  const dataMap = {};
  const stream = db.stream(dbkeys.keyForData(dataset_id), false, true);
  for await (const {value} of stream) {
    const p = Array.isArray(value.path) ? value.path[0] : value.path;
    const relUrl = storage.toRelativePath(p);
    dataMap[relUrl] = value.id;
  }
  return dataMap;
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
