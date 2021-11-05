# <img src="frontend/images/pixano_logo.png" alt="Pixano" height="100"/>

Choose Your Plugin Guide
===============

## List of available plugins
* "Basic" 2D plugins
	* [keypoints](#keypoints)
	* [polygon](#polygon)
	* [rectangle](#rectangle)
	* [segmentation](#segmentation)
	* [tracking](#tracking)
* Smart 2D plugins
	* [smart-rectangle](#smart-rectangle)
	* [smart-segmentation](#smart-segmentation)
	* [smart-tracking](#smart-tracking)
* 3D annotator plugin [cuboid](#cuboid)
* Sequences
	* [sequence-cuboid](#sequence-cuboid)
	* [sequence-keypoints](#sequence-keypoints)
	* [sequence-polygon](#sequence-polygon)
	* [sequence-rectangle](#sequence-rectangle)
	* [sequence-segmentation](#sequence-segmentation)


## List of available plugins
* [cuboid](#cuboid)
* [keypoints](#keypoints)
* [polygon](#polygon)
* [rectangle](#rectangle)
* [smart-rectangle](#smart-rectangle)
* [segmentation](#segmentation)
* [smart-segmentation](#smart-segmentation)
* [sequence-cuboid](#sequence-cuboid)
* [sequence-keypoints](#sequence-keypoints)
* [sequence-polygon](#sequence-polygon)
* [sequence-rectangle](#sequence-rectangle)
* [sequence-segmentation](#sequence-segmentation)
* [tracking](#tracking)
* [smart-tracking](#smart-tracking)

## Generic buttons and shortcuts (available for all 2D plugins)
| Button | Key Shortcut | Description |
| ----------| -------| -----|
| icon="navigation" |  | `Select/Edit shape or instance` |
| icon="add_circle_outline" |  | `Create a new object` |
| icon="tonality" |  | `Hide/Show labels` |
|  | `Tab`        | `Loop throught the scene shapes/instances` |
|  | `Escape`     | `Unselect shapes or instance` |
|  | `Delete`     | `Delete selected shapes or instance` |
|  | `m`          | `Darken   image` |
|  | `p`          | `Brighten image` |
|  | `Ctrl+C`     | `Copy in clipboard currently selected shapes/instance` |
|  | `Ctrl+V`     | `Create new shapes/instance (with new ids) from the clipboard content` |
|  | `Ctrl+Space` | `Toggle labels (hide / show)` |

## ??? unused plugins :
- tracking-point
- keypoints-box
- sequence-point-rectangle
- => à supprimer ?


## keypoints
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here]().


### Specific buttons and shortcuts
| Button | Key Shortcut | Description |
| ----------| -------| -----|
| icon="swap_horiz" | `c` | `Swap nodes` |
|  | `h` | `AllVisible` |

## polygon
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here]().

### Specific buttons and shortcuts
| Button | Key Shortcut | Description |
| ----------| -------| -----|
| icon="call_merge" |  | `Group polygons` |
| icon="call_split" |  | `Split polygon` |
| icon="timeline" | | `Polyline/Polygon` |


## rectangle
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here](https://playcode.io/709884/).

## smart-rectangle
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here](https://playcode.io/738813/).

### Specific buttons and shortcuts
| Button | Key Shortcut | Description |
| ----------| -------| -----|
| icon="flare" |  | `Smart mode` |
| icon="call_split" |  | `Split polygon` |
| icon="timeline" | | `Polyline/Polygon` |
| ${increase} | `+` | `ROI increase` |
| ${decrease} | `-` | `ROI decrease` |


## tracking
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here]().
## smart-tracking
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here]().


## segmentation
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here]().

### Specific buttons and shortcuts
| Button | Key Shortcut | Description |
| ----------| -------| -----|
| icon="brush" |  | `Add instance (Brush style)` |
| ${union} | `Shift` | `Add to the selected instance` |
| ${subtract} | `Ctrl` | `Remove from the selected instance` |
| icon="lock" |  | `Lock instances on click` |
| icon="tonality" |  | `Filter isolated` |
| icon="filter_center_focus" |  | `Lock instances on click` |
| icon="face" |  | `Switch instance/semantic` |
| ${increase} | `+` | `Brush size increase` |
| ${decrease} | `-` | `Brush size decrease` |

## smart-segmentation
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here](https://playcode.io/723293/).

### Specific buttons and shortcuts
| Button | Shortcut | behaviour |
| ----------| -------| -----|
| Same | as | [segmentation](#segmentation) |
| icon="add_circle_outline" |  | `Smart create` |


## Sequences
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here]().
### sequence-cuboid
### sequence-keypoints
### sequence-polygon
### sequence-rectangle
### sequence-segmentation



## cuboid
### When should you use this plugin ?
### Demo / video
A demonstration video is available for this plugin [here]().  
An interactive demonstration is available for this plugin [here](https://playcode.io/709984/).

### Buttons and shortcuts
| Button | Key Shortcut | Description |
| ----------| -------| -----|
| icon="3d_rotation" |  | `rotate` |
| icon="swap_horiz" |  | `swap` |
| ${camera} |  | `toggleView` |
|  | `n`          | `Switch to create mode` |
|  | `Escape`     | `Unselect shapes` |
|  | `Delete`     | `Delete selected shapes` |
|  | `Ctrl+C`     | `Copy in clipboard currently selected cuboid` |
|  | `Ctrl+V`     | `Create new cuboid (with new id) from the clipboard content` |
|  | `+`          | `Scale up size of points in pointcloud` |
|  | `-`          | `Scale down size of points in pointcloud` |



