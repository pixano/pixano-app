/**
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
    'sequence-rectangle',
    'sequence-cuboid',
    'sequence-polygon',
    'sequence-keypoints',
    'sequence-segmentation'
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
