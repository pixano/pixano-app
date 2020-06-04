const { db } = require('../config/db');
const dbkeys = require('../config/db-keys');

/**
 * Get labels for a given data.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_labels(req, res) {
    const taskName = req.params.task_name;
    const dataId = req.params.data_id;
    try {
        const labelData = await db.get(dbkeys.keyForLabels(taskName, dataId));
        return res.send(labelData);
    } catch (err) {
        return res.send({});      
    }
}

/**
 * Put labels for a given data.
 * @param {Request} req 
 * @param {Response} res 
 */
async function put_labels(req, res) {
    const taskName = req.params.task_name;
    const dataId = req.params.data_id;
    const newLabels = req.body;

    //Invalid request ids
    if (taskName !== newLabels.task_name || dataId !== newLabels.data_id) {
        return res.status(400).json({
            type: 'bad_ids',
            message: 'Corruption in ids : '+taskName+' '+newLabels.name+' or '+dataId+' '+newLabels.data_id
        });
    }
    await db.put(dbkeys.keyForLabels(taskName, dataId), newLabels);
    return res.status(204).json({});
}

module.exports = {
    get_labels,
    put_labels
}
