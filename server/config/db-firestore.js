/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/


const admin = require('firebase-admin');
const collectionName = "PIXANO-DB";
let db = '';

function init() {
  // console.log("db ", db)
  const serviceAccount = require("./firebaseServiceAccount.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  // console.log("db ", db)
  db.settings({ ignoreUndefinedProperties: true });
}

async function put(id , data) {
  try {
    await db.collection(collectionName).doc(id).update(data);
    return {message: "Updated"};
  } catch (error) {
      // return throw new "Not Found";
      console.log('catching', id, data)
      return await post(id, data);
    // return error;
  }
}

function streamBase(prefix) {

  let query = db.collection(collectionName)
                .where(admin.firestore.FieldPath.documentId(), '>=', `${prefix}!`)
                .where(admin.firestore.FieldPath.documentId(), '<', `${prefix}~`);
  return query.stream();
  //let result = [];

  // const s = query.stream()
  //  return new Promise((resolve) => {
  //     s.on('data', (documentSnapshot) => {
  //       result.push({
  //         key : documentSnapshot.id,
  //         value: documentSnapshot.data()
  //       })
  //     }).on('end', () => {
  //       resolve(result);
  //     })
  //   });
}

async function* stream(prefix) {
  const s = streamBase(prefix);
  for await (let d of s) {
    yield {key: d.id, value: d.data()}
  }
}

function streamFromBase(from, prefix, reverse) {
  let query = db.collection(collectionName);
  if (reverse) {
    return query.where(admin.firestore.FieldPath.documentId(), '>=', `${prefix}!`)
                .where(admin.firestore.FieldPath.documentId(), '<', `${from}`).stream();
  } else {
    // store all in memory bc we cannot reverse
    return query.where(admin.firestore.FieldPath.documentId(), '>=', `${from}!`)
                .where(admin.firestore.FieldPath.documentId(), '<', `${prefix}~`).stream();
  }
  // replace by this if you made sure to have a key field in the value that equals the document id
  // let query = coll.where("key", '>=', `!`)
  //                 .where("key", '<', `~`)
  //                 .orderBy('key','desc')
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
      let data = [];
      stream.on("data", chunk => data = [...data, {key: chunk.id, value: chunk.data()}]);
      stream.on("end", () => resolve(data));
      stream.on("error", error => reject(error));
  });
}


async function* streamFrom(from, prefix, reverse) {
  const s = streamFromBase(from, prefix, reverse);
  if (!reverse) {
    for await (let d of s) {
      yield {key: d.id, value: d.data()}
    }
  } else {
    // we cannot sort document id with firestore: instead we store everything
    // in memory and sort the array afterwards.
    const res = (await readStream(s)).sort((a, b) => b.key.localeCompare(a.key));
    for (let d of res) {
      yield d;
    }
  }
}

async function post(id,  data) {
  try {
    await db.collection(collectionName).doc(id).create(data);
    return {message: "Created"};
  } catch (error) {
      throw error;
  }
}


async function del(id) {
  const document = db.collection(collectionName).where('id','==',id);
  document.get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      doc.ref.delete();
    });
  });
}

async function get(id) {
  try {
      const document = db.collection(collectionName).where(admin.firestore.FieldPath.documentId(), '==', id);
      let foundDocuments = await document.get().then(async querySnapshot => {
          let docs = await querySnapshot.docs;
          if (docs && docs.length > 0 && docs[0] && docs[0].id) {
            return {
              id : docs[0].id,
              item : docs[0].data()
            };
          }
      });

      // console.log("foundDocuments ", foundDocuments);
      if(foundDocuments)
      return foundDocuments.item;
      throw `${id} Not Found`
  } catch (error) {
      throw `${id} Not Found`;
  }
}

async function batch(ops) {
  const batch = db.batch();
  for (let op of ops) {
    if (op.type == 'put') {
      const ref = db.collection(collectionName).doc(op.key);
      const isHere = (await ref.get())._createTime;
      if (isHere) {
        batch.update(ref, op.value);
      } else {
        batch.create(ref, op.value);
      }
    } else if (op.type == 'del') {
      const ref = db.collection(collectionName).doc(op.key);
      batch.delete(ref)
    }
  }
  // ops.forEach(async (op) => {
  //     if (op.type == 'put') {
  //       const ref = db.collection(collectionName).doc(op.key);
  //       const querySnapshot = await ref.get();
  //       let isHere = await querySnapshot.docs;
  //       console.log('isHere', isHere);
  //       if (isHere) {
  //         batch.update(ref, op.value);
  //       } else {
  //         batch.create(ref, op.value);
  //       }
  //     } else if (op.type == 'del') {
  //       const ref = db.collection(collectionName).doc(op.key);
  //       batch.delete(ref)
  //     }
  // });
  try {
    await batch.commit();
  } catch(err) {
    console.log('err when commit', err, ops)
  }
}


module.exports = {
  get,
  put,
  stream,
  streamFrom,
  del,
  batch,
  init
}
