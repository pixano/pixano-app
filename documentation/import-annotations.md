## Import existing annotations / predictions

Create an `annotation` folder as such:
```
data-test   
│
│───images
│   │    xxx.jpg
│   └─── yyy.jpg
│       
└───annotations
    │─── task1.json
    └─── task1
        │    xxx.json
        └─── yyy.json
```
The `task1.json` file contains global task settings (task type, task categories, image folder, etc) and its correspoding `task1` folder contains an annotation file for each image.

Example of annotation specification file for bounding box annotation:

```json
// task1.json
{
 "name": "task1",
 "spec": {
  "plugin_name": "rectangle",
  "label_schema": {
   "category": [
    {
     "name": "car",
     "color": "green",
     "properties": [
      {
       "name": "isBlue",
       "type": "checkbox",
       "default": false
      }
     ]
    },
    {
     "name": "person",
     "color": "#eca0a0",
     "properties": [
      {
       "name": "size",
       "type": "dropdown",
       "enum": [
        "little",
        "big"
       ],
       "default": "little"
      }
     ]
    }
   ],
   "default": "person"
  }
 },
 "dataset": {
  "path": "images/",
  "data_type": "image"
 }
}
```

Example of annotation file for bounding box annotation:
```json
// xxx.json
{
 "task_name": "box",
 "annotations": [
  {
   "id": "m83ihfsoplq",
   "geometry": {
    "vertices": [
     0.4001610305958132, // left
     0.23466666666666666, // top
     0.5048309178743962, // right
     0.6906666666666667 // bottom
    ],
    "type": "rectangle"
   },
   "category": "person",
   "options": {
    "size": "little"
   }
  }
 ],
 "data": {
  "type": "image",
  "children": "",
  "path": "images/xxx.jpg"
 }
}
```