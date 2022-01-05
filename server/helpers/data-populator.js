/**
 * Data population
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
 */

const cliProgress = require('cli-progress');
const batchManager = require('./batch-manager');
const { generateKey } = require('../helpers/utils');
// const storage = require('../config/storage-filesystem');
const storage = require('../config/storage-bucket');
const dbkeys = require('../config/db-keys');


async function image(db, mediaRelativePath, datasetId) {
  return populateSimple(db, mediaRelativePath, datasetId, ['jpg', 'png', 'PNG', 'jpeg', 'JPEG'], 'image');
}

async function pcl(db, mediaRelativePath, datasetId) {
  return populateSimple(db, mediaRelativePath, datasetId, ['bin'], 'pcl');
}

// async function pcl_image(db, mediaRelativePath, hostWorkspacePath, datasetId) {
//   return populateMultiview(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'pcl_image');
// }

// async function sequence_image(db, mediaRelativePath, hostWorkspacePath, datasetId) {
//   return populateSequence(db, mediaRelativePath, hostWorkspacePath, datasetId, ['jpg', 'png', 'PNG', 'jpeg', 'JPEG'], 'sequence_image');
// }

// async function sequence_pcl(db, mediaRelativePath, hostWorkspacePath, datasetId) {
//   return populateSequence(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'sequence_pcl');
// }

// async function sequence_pcl_image(db, mediaRelativePath, hostWorkspacePath, datasetId) {
//   return populateMultiviewSequence(db, mediaRelativePath, hostWorkspacePath, datasetId, ['bin'], 'sequence_pcl_image');
// }

/**
 * Populate elementary data entries (image, pcl)
 * @param {Level} db 
 * @param {string} mediaRelativePath
 * @param {string} datasetId 
 */
async function populateSimple(db, mediaRelativePath, datasetId,
                                     ext = ['jpg', 'png'],
                                     dataType = 'image') {
  const {folders, total} = await storage.parseFolder(mediaRelativePath, ext);
  const bm = new batchManager.BatchManager(db);
  const bar1 = new cliProgress.SingleBar({
    format: 'Dataset creation | {bar} | {percentage}% || {value}/{total} files'
  });
  bar1.start(total, 0);
  for await (const files of Object.values(folders)) {
    for await (const url of files) {
      const id = generateKey();
      let value = { id, dataset_id: datasetId, type: dataType, path: url, children: ''}
      if (dataType=='image') value.thumbnail = await storage.getThumbnail(url);
      await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value});
      bar1.increment();
    }
  }
  await bm.flush();
  bar1.stop();
}

// async function populateMultiview(db, mediaRelativePath, hostWorkspacePath, datasetId,
//                                  ext = ['bin'],
//                                  type = 'pcl_image') {
//   const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
//   const files = await parseFolder(hostFolder, ext);
//   const bm = new batchManager.BatchManager(db);
//   for await (const f of files) {
//     const id = generateKey();
//     const path = workspaceToMount(hostWorkspacePath, f);
//     const f2 = f.replace('pcls/', 'images/')
//                        .replace(/velodyne_/g, 'cam_')
//                        .replace('bin', 'jpg');
//     if (fs.existsSync(f2)) {
//       const value = { id, dataset_id: datasetId, type, path: [path, workspaceToMount(hostWorkspacePath, f2)]};
//       await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value});
//     } else {
//       console.warn(`Multi view not available for data ${f}`);
//     }
//   }
//   await bm.flush();
// }

// /**
//  * Populate data entries for sequences of pcl with image
//  * {
//  *  id: string,
//  *  dataset_id: string,
//  *  type: sequence_xxx,
//  *  path: string (pcl folder path),
//  *  children: {timestamp: number, img_ids: [string, string]}
//  *  url: string
//  * }
//  * @param {Level} db 
//  * @param {string} datasetId
//  * @param {string} dataType sequence_image/sequence_pcl
//  */
// async function populateMultiviewSequence(db, mediaRelativePath, hostWorkspacePath, datasetId,
//                                           ext = ['bin'],
//                                           type = 'sequence_pcl_image') {
//     const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
//     const files = await parseFolder(hostFolder, ext);
//     const bm = new batchManager.BatchManager(db);
    
//     const folderReducer = (total, file) => {
//       const dirname = path.dirname(file);
//       if (!total[dirname]) {
//         total[dirname] = [];
//       }
//       total[dirname].push(file);
//       return total;
//     }
  
//     const folders = files.reduce(folderReducer, {});
//     let counter = 0;
//     for await (const folderPath of Object.keys(folders)) {
//         const id = generateKey();
//         const sortedFrames = folders[folderPath].sort((a, b) => a.localeCompare(b))
//                               .map((f, idx) => {
//                                 const f2 = f.replace('pcls/', 'images/')
//                                                 .replace(/velodyne_/g, 'cam_')
//                                                 .replace('bin', 'jpg');
//                                 return {timestamp: idx, path: [workspaceToMount(hostWorkspacePath, f), workspaceToMount(hostWorkspacePath, f2)]} 
//                               });
//         const value = {
//           id,
//           dataset_id: datasetId,
//           type,
//           path: workspaceToMount(hostWorkspacePath, folderPath),
//           children: sortedFrames
//         }
//         await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value});
//         counter++;
//     }
//     console.info(`Read ${counter} sequences.`);
//     await bm.flush();
// }

// /**
//  * Populate data entries for sequences of images/pcl
//  * {
//  *  id: string,
//  *  dataset_id: string,
//  *  type: sequence_xxx,
//  *  path: '',
//  *  children: {timestamp: number, path: [string]}
//  * }
//  * @param {Level} db 
//  * @param {string} datasetId
//  * @param {string} dataType sequence_image/sequence_pcl
//  */
// async function populateSequence(db, mediaRelativePath, hostWorkspacePath, datasetId,
//                                        ext = ['jpg', 'png'],
//                                        dataType = 'sequence_image') {

//   const hostFolder = path.resolve(hostWorkspacePath, mediaRelativePath);
//   const { folders } = await parseFolder(hostFolder, ext);
//   const bm = new batchManager.BatchManager(db);
//   const bar1 = new cliProgress.SingleBar({
//     format: 'Dataset creation | {bar} | {percentage}% || {value}/{total} sequences'
//   });
//   bar1.start(Object.keys(folders).length, 0);
//   for await (const [folderPath, files] of Object.entries(folders)) {
//     const id = generateKey();
//     const url = workspaceToMount(hostWorkspacePath, folderPath);
//     const sortedFrames = files.sort((a, b) => a.localeCompare(b))
//                                     .map((f, idx) => { return {timestamp: idx, path: workspaceToMount(hostWorkspacePath, f)} });
//     const value = { id, dataset_id: datasetId, type: dataType, path: url, children: sortedFrames}
//     await bm.add({ type: 'put', key: dbkeys.keyForData(datasetId, id), value: value});
//     bar1.increment();
//   }
//   bar1.stop();
//   await bm.flush();
// }

// const workspaceToMount = (hostWorkspacePath, f) => {
//   return path.normalize(f.replace(hostWorkspacePath, MOUNTED_WORKSPACE_PATH));
// }

module.exports = {
  image,
  pcl,
  // pcl_image,
  // sequence_image,
  // sequence_pcl,
  // sequence_pcl_image,
  // MOUNTED_WORKSPACE_PATH
}
