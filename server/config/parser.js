/**
 * Simple example of how to parse the DB
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const levelup = require('levelup');
const leveldown = require('leveldown');
const encode = require('encoding-down');
const fs = require('fs');
const path = require('path')

// path to the database folder
// WARNING: stop all Pixano processus on this database.
const DB_NAME = "/home/cdupont/data/valeo/dataset/poc/gm/dev.ldb";

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

async function parse(databasePath) {
  const db = levelup(encode(leveldown(databasePath), { valueEncoding: 'json' }));
  let stream = db.createReadStream();
  
  for await (const t of stream) {
    if (t.key.startsWith('')) {
      if (t.key.startsWith('configuration')) {
        console.log('oy', t.value)
      }
      if (t.key.startsWith('label:')) {
        let urls = await db.get('data:input:' + t.key.split('label:')[1]);
        urls = urls.urls.map((u) => {
          return {timestamp: u.timestamp, url: [u.url.replace('/data/', '')]}
        });
        const anns = t.value.map((a) => {
          return {
            id: a.id,
            name: a.name,
            category: a.categoryName,
            geometry: a.geometry,
            options: {
              ...a.options,
              is_color: a.is_color || false,
              is_damage: a.is_damage || false
            },
            timestamp: a.timestamp
          }
        })
        const output = {
          annotations: anns,
          data: {
            type: "sequence_image",
            url: urls,
            task_name: 'groundmarking'
          }
        }
        writeJSON(output, `/home/cdupont/data/valeo/dataset/poc/gm/output/${t.key.split('label:')[1]}.json`);
      }
    }
  }
}

parse(DB_NAME);

