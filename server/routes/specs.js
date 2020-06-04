const { db } = require('../config/db');
const dbkeys = require('../config/db-keys');
const utils = require('../helpers/utils');
const { checkAdmin } = require('./users');

/**
 * Get list of specifications.
 * @param {*} _ 
 * @param {Response} res 
 */
async function get_specs(_, res) {
    try {
        const specs = [];
        const stream = utils.iterateOnDB(db, dbkeys.keyForSpec(), false, true)
        stream.on('data', (value) => {
            specs.push(value);
        }).on('end', () => {
            return res.send([...specs]);
        });
    } catch (err) {
        res.status(400).json({
            message: 'Error searching specs'
        });
    }
}

/**
 * Add a new specification.
 * @param {Request} req 
 * @param {Response} res 
 */
async function post_specs(req, res) {
    checkAdmin(req, async () => {
        const config = req.body;
        config.id = utils.generateKey();
        await db.put(dbkeys.keyForSpec(config.id), config);
        res.status(201).json(config);
    });
}

/**
 * Get specification for a given id.
 * @param {Request} req 
 * @param {Response} res 
 */
async function get_spec(req, res) {
    try {
        const specData = await db.get(dbkeys.keyForSpec(req.params.spec_id))
        res.send(specData);
    } catch (err) {
            res.status(400).json({
            message: 'Unknown spec '+req.params.spec_id
        });
    }
}

/**
 * Update specification for a given id.
 * @param {Request} req 
 * @param {Response} res 
 */
async function put_spec(req, res) {
    checkAdmin(db, req, async () => {
        const config = req.body;
        try {
        //Invalid request
        if (config.id !== req.params.spec_id) {
                res.status(400).json({
                type: 'bad_id',
                message: 'Corruption in id '+req.params.spec_id+' '+config.id
            });
            return;
        }

        const spec_key = dbkeys.keyForSpec(config.id)
        const oldSpec = await db.get(spec_key);

        // Some fields cannot be updated check if modified
        if (config.plugin_name !== oldSpec.plugin_name ||
            config.data_type !== oldSpec.data_type) {
            res.status(400).json({
                type: 'bad_body',
                message: 'Immutable field has changed in request body.'
            });
            return
        }
        await db.put(spec_key, config);
        res.status(204).json({});

        } catch (err) {
        res.status(400).json({
            type: 'unknown',
            message: 'Unknown spec '+req.params.spec_id
        });
        }
    });
}

/**
 * Delete a specification for a given id.
 * @param {Request} req 
 * @param {Response} res 
 */
async function delete_spec(req, res) {
    checkAdmin(req, async () => {
        const key = dbkeys.keyForSpec(req.params.spec_id);
        await db.del(key);
        return res.status(204).json({});
    });
}

/**
 * Get or create spec in database from its content.
 * @param {Level} db 
 * @param {Object} spec 
 */
async function getOrcreateSpec(spec) {
    const existingSpec = await getSpecFromContent(db, spec);
    if (!existingSpec) {
      const newSpec = {...spec, id:  utils.generateKey()};
      await db.put(dbkeys.keyForSpec(newSpec.id), newSpec);
      return newSpec;
    } else {
      return existingSpec;
    }
}

/**
 * Get spec detail for a given specification content.
 * @param {Level} db 
 * @param {Object} spec 
 */
const getSpecFromContent = (db, spec) => {
    let foundSpec = null;
    return new Promise((resolve, reject) => {
      // update datasets if previously unknown data path is given
      const s1 = utils.iterateOnDB(db, dbkeys.keyForSpec(), false, true);
      s1.on('data', (value) => {
        // remove id to only compare other keys
        const data =  {...value};
        delete data.id;
        if (utils.isEqual(data, spec)) {
          foundSpec = value;
          s1.destroy();
        }   
      }).on('close', () => {
        resolve(foundSpec);   
      });
    });
}

module.exports = {
    get_specs,
    post_specs,
    get_spec,
    put_spec,
    delete_spec,
    getOrcreateSpec
}
