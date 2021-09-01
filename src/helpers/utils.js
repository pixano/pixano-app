/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

export function commonJson(entities) {
    if (entities.length == 0) {
      return;
    } else if (entities.length == 1) {
      return entities[0];
    }
    function getKeys(object) {
      function iter(o, p) {
          if (Array.isArray(o)) { 
            result.push(p.join('.'));
            return; 
          }
          if (o && typeof o === 'object') {
              var keys = Object.keys(o);
              if (keys.length) {
                  keys.forEach((k) => { iter(o[k], p.concat(k)); });
              }
              return;
          }
          result.push(p.join('.'));
      }
      var result = [];
      iter(object, []);
      return result;
    }
    const commonEntity = JSON.parse(JSON.stringify(entities)).shift();
    const keys = getKeys(commonEntity);
    keys.forEach((key) => {
      const commonAttr = key.split('.').reduce((o, p) => (o && o.hasOwnProperty(p)) ? o[p] : null, commonEntity);
      for (const e of entities) {
        const entityAttr = key.split('.').reduce((o, p) => (o && o.hasOwnProperty(p)) ? o[p] : null, e);
        if (!entityAttr || JSON.stringify(entityAttr) != JSON.stringify(commonAttr)) {
          // remove from commonEntity
          deleteObjProp(commonEntity, key);
          break;
        }
      }
    });
    return commonEntity;
}

function deleteObjProp(obj, path) {
  if (!obj || !path) {
    return;
  }
  if (typeof path === 'string') {
    path = path.split('.');
  }
  for (var i = 0; i < path.length - 1; i++) {
    obj = obj[path[i]];
    if (typeof obj === 'undefined') {
      return;
    }
  }
  delete obj[path.pop()];
};

export function colorToRGBA(color) {
    // Returns the color as an array of [r, g, b, a] -- all range from 0 - 255
    // color must be a valid canvas fillStyle. This will cover most anything
    // you'd want to use.
    // Examples:
    // colorToRGBA('red')  # [255, 0, 0, 255]
    // colorToRGBA('#f00') # [255, 0, 0, 255]
    var cvs, ctx;
    cvs = document.createElement('canvas');
    cvs.height = 1;
    cvs.width = 1;
    ctx = cvs.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data;
}

function byteToHex(num) {
    // Turns a number (0-255) into a 2-character hex number (00-ff)
    return ('0'+num.toString(16)).slice(-2);
}

export function colorToHex(color) {
    // Convert any CSS color to a hex representation
    // Examples:
    // colorToHex('red')            # '#ff0000'
    // colorToHex('rgb(255, 0, 0)') # '#ff0000'
    var rgba, hex;
    rgba = colorToRGBA(color);
    hex = [0,1,2].map(
        function(idx) { return byteToHex(rgba[idx]); }
        ).join('');
    return "#"+hex;
}

export const isEqual = (value, other) => {

	// Get the value type
	var type = Object.prototype.toString.call(value);

	// If the two objects are not the same type, return false
	if (type !== Object.prototype.toString.call(other)) return false;

	// If items are not an object or array, return false
	if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

	// Compare the length of the length of the two items
	var valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
	var otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
	if (valueLen !== otherLen) return false;

	// Compare two items
	var compare = function (item1, item2) {

		// Get the object type
		var itemType = Object.prototype.toString.call(item1);

		// If an object or array, compare recursively
		if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
			if (!isEqual(item1, item2)) return false;
		}

		// Otherwise, do a simple comparison
		else {

			// If the two items are not the same type, return false
			if (itemType !== Object.prototype.toString.call(item2)) return false;

			// Else if it's a function, convert to a string and compare
			// Otherwise, just compare
			if (itemType === '[object Function]') {
				if (item1.toString() !== item2.toString()) return false;
			} else {
				if (item1 !== item2) return false;
			}

		}
	};

	// Compare properties
	if (type === '[object Array]') {
		for (var i = 0; i < valueLen; i++) {
			if (compare(value[i], other[i]) === false) return false;
		}
	} else {
		for (var key in value) {
			if (value.hasOwnProperty(key)) {
				if (compare(value[key], other[key]) === false) return false;
			}
		}
	}

	// If nothing failed, return true
	return true;

};

export function getProperty(obj, path) {
  return path.split('.').reduce((p,c)=>p&&p[c]||null, obj);
}

export function setProperty(obj, path, value) {
  path.split('.')
   .reduce((o,p,i) => o[p] = path.split('.').length === ++i ? value : o[p] || {}, obj)
}

/**
 * Retrieve input text value from change event
 * @param {Event} e 
 */
export function getValue(e) {
  const path = e.composedPath();
  const input = path[0];
  const value = input.value;
  return value;
}

/**
 * Unix duration to text time in (hr:)min:sec
 * @param {Number} time 
 */
export function format(time) {
  // Hours, minutes and seconds
  const hrs = ~~(time / 3600);
  const mins = ~~((time % 3600) / 60);
  const secs = ~~time % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  let ret = "";
  if (hrs > 0) {
      ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
  }
  ret += "" + mins + ":" + (secs < 10 ? "0" : "");
  ret += "" + secs;
  return ret;
}

/**
 * Unix date to text time in day / month / year, time
 * @param {Number} time 
 */
export function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}