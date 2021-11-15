/**
 * Summary of plugins for the application:
 * You need to add your plugin to the pluginsList in order for 
 * it to be displayed when creating a new annotation task.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

// import {PluginRectangle} from '../plugins/rectangle';

/**
 * List of all plugin names
 */
export const pluginsList = [
    'rectangle',
    'polygon',
    'cuboid',
    'segmentation',
    'tracking',
    'keypoints',
    'smart-rectangle',
    'smart-segmentation',
    'smart-tracking',
    'sequence-rectangle',
    'sequence-cuboid',
    'sequence-polygon',
    'sequence-keypoints',
    'sequence-segmentation',
    'custom'
];

/**
 * Return data input type for each plugin
 * @param {String} pluginName 
 */
export const getDataType = (pluginName) => {

    switch (pluginName) {
        case 'sequence-keypoints':
        case 'sequence-rectangle':
        case 'sequence-polygon':
        case 'tracking':
        case 'smart-tracking':
        case 'sequence-segmentation': return 'sequence_image';
        case 'sequence-cuboid': return 'sequence_pcl';
        case 'cuboid': return 'pcl';
        default:
        case 'rectangle':  return 'image'; // PluginRectangle.dataType;
    }
}

/**
 * Default label schema values for each plugin.
 * Each category sub property is one of the following types:
 * - dropdown: mono-selection, one value must be given by default
 * - list: idem, but all values are displayed
 * - checkbox: boolean, one value must be given by default (true if none)
 * @param {string} pluginName
 */
export const defaultLabelValues = (pluginName) => {
    switch(pluginName) {
        case 'sequence-segmentation':
        case 'smart-segmentation':
        case 'segmentation': {
            return {
                category: [
                    {name: 'car', color: "green", idx: 1, instance: true},
                    {name: 'person', color: "#eca0a0", idx: 2, instance: true},
                    {name: 'road', color: "blue", idx: 3, instance: false}
                ],
                default: 'person'
            }
        }
        case 'smart-rectangle': {
            return {
                category: [
                    {name: 'car', color: "green"},
                    {name: 'person', color: "#eca0a0"},
                ],
                default: 'person'
            }
        }
        case 'smart-tracking':
        case 'tracking': {
            return {
                category: [
                    {name: 'car', color: "green", properties: []},
                    {name: 'person', color: "#eca0a0", properties: [
                        {name: 'posture', type: 'dropdown', enum: ['standing', 'bending', 'sitting', 'lying'], 
                        persistent: false, default: 'standing'}
                    ]},
                ],
                default: 'person'
            };
        }

        case 'rectangle':
        case 'sequence-rectangle':
        default: {
            return {
                category: [
                    {
                        name: 'car', color: "green", properties: [
                            {name: 'isBlue', type: 'checkbox', default: false}
                        ]
                    },
                    {
                        name: 'person', color: "#eca0a0", properties: [
                            {name: 'size', type: 'dropdown', enum: ['little', 'big'], default: 'little'}
                        ]
                    }
                ],
                default: 'person'
            }
        }
    }
}

export const defaultSettings = (pluginName) => {
    switch(pluginName) {
        case 'sequence-keypoints':
        case 'keypoints': {
            return {
                radius: 3,
                colorFillType: "order",
                vertexNames: [
                    'nose', 'leye','reye','lshoulder','rshoulder','lelbow','relbow','lwrist','rwrist',
                    'lhip','rhip','lknee','rknee','lankle','rankle','lfoot','rfoot'
                ],
                edges: [[0,1],[0,2],[0,3],[3,4],[3,5],[4,6],[5,7],[6,8],[3,9],[4,10],[10,11],[9,11],[10,12],[11,13],[12,14],[13,15],[14,16]],
                edgeColorType: "node"
            }
        }
        case 'smart-segmentation':
            return {
                model: 'https://raw.githubusercontent.com/pixano/pixano.github.io/master/models/box_model/model.json'
            }
        default: {
            return {}
        }
    }
}