/**
 * Class to manage large batch and progressive writing in the dataset.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2020)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const sizeof = require('object-sizeof');

class BatchManager {
  constructor(db) {
    this._db = db;
    this._maxByteSize = 100000000;  // about 100 MB
    this._currentByteSize = 0;
    this.ops = [];
  }

  async add(entry) {
    const entrySize = sizeof(entry);
    // console.log('entry size', entrySize, this._currentByteSize);
    if (this._currentByteSize + entrySize > this._maxByteSize) {
      // Need to flush
      console.log('Flushing ...');
      await this.flush();
      console.log('  done');
    }

    this._currentByteSize += entrySize;
    this.ops.push(entry);    
  }

  async flush() {
    await this._db.batch(this.ops);
    this._currentByteSize = 0;
    this.ops = [];
  }
}


module.exports = {
  BatchManager
}
