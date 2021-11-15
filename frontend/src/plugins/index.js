/**
 * Summary of plugins for the application:
 * You need to add your plugin to the pluginsList in order for 
 * it to be displayed when creating a new annotation task.
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import '../helpers/attribute-picker';


/**
 * List of all plugin names
 */
export const pluginsList = [
	'classification',
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
        case 'segmentation':
            return {
				category: [
					{ name: 'class1', color: "blue", idx: 1, instance: true, properties: [] },
					{ name: 'class2', color: "#eca0a0", idx: 2, instance: false, properties: [] },
					{
						name: 'class3', color: "green", idx: 3, instance: true, properties: [
							{ name: 'checkbox example', type: 'checkbox', default: false },
							{ name: 'dropdown example', type: 'dropdown', enum: ['something', 'something else', 'anything else'], default: 'something' },
							{ name: 'textfield example', type: 'textfield', default: 'some text' }
						]
					}
				],
				default: 'class1'
			};

        case 'smart-tracking':
        case 'tracking':
            return {
					category: [
						{ name: 'class1', color: "blue", properties: [] },
						{ name: 'class2', color: "#eca0a0", properties: [] },
						{
							name: 'class3', color: "green", properties: [
								{ name: 'checkbox example', type: 'checkbox', default: false, persistent: true },
								{ name: 'dropdown example', type: 'dropdown', enum: ['something', 'something else', 'anything else'], default: 'something', persistent: false },
								{ name: 'textfield example', type: 'textfield', default: 'some text' }
							]
						}
					],
					default: 'class1'
				};

		case 'classification':
			return {
				category: [
					{
						name: 'classification', color: "black", properties: [
							{ name: 'checkbox example', type: 'checkbox', default: false },
							{ name: 'dropdown example', type: 'dropdown', enum: ['something', 'something else', 'anything else'], default: 'something' },
							{ name: 'textfield example', type: 'textfield', default: 'some text' }
						]
					}
				],
				default: 'classification'
			};

		case 'sequence-rectangle':
		case 'smart-rectangle':
        case 'rectangle':
        default:
            return {
					category: [
						{ name: 'class1', color: "blue", properties: [] },
						{ name: 'class2', color: "#eca0a0", properties: [] },
						{
							name: 'class3', color: "green", properties: [
								{ name: 'checkbox example', type: 'checkbox', default: false },
								{ name: 'dropdown example', type: 'dropdown', enum: ['something', 'something else', 'anything else'], default: 'something' },
								{ name: 'textfield example', type: 'textfield', default: 'some text' }
							]
						}
					],
					default: 'class1'
				};
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