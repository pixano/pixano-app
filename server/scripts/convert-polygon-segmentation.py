import os
import json
import cv2
import base64
import numpy as np

input_folder = "/data/valeo/dataset-valeo-cea/annotations/fisheye/train/object2d/"
output_folder = os.path.abspath(os.path.join(input_folder, os.pardir)) + "/" + os.path.basename(os.path.dirname(input_folder)) + "-seg/"
output_task_file = os.path.abspath(os.path.join(input_folder, os.pardir)) + "/" + os.path.basename(os.path.dirname(input_folder)) + "-seg.json"
print(output_folder)

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

task_file = os.path.abspath(os.path.join(input_folder, os.pardir)) + "/" + os.path.basename(os.path.dirname(input_folder)) + ".json"
with open(task_file, 'r') as f:
    task = json.load(f)

for i, c in enumerate(task["spec"]["label_schema"]["category"]):
    c["idx"] = 1 #i+1
    c["instance"] = False

with open(output_task_file, "w") as f:
    f.write(json.dumps(task, indent=4))

def writeb64(img):
    retval, buffer = cv2.imencode('.png', img)
    pic_str = base64.b64encode(buffer)
    pic_str = pic_str.decode()
    return "data:image/png;base64," + pic_str


for annotation_file in os.listdir(input_folder):
    with open(os.path.join(input_folder, annotation_file), 'r') as f:
        data = json.load(f)

    annotations = data["annotations"]
    annotations_out = []
    timestamps = set([a["timestamp"] for a in annotations])

    for frame in timestamps:
        objs = [o for o in annotations if o["timestamp"] == frame]
        mask = np.zeros((800,1280,4), dtype=np.uint8)

        for obj2d in objs:

            if obj2d["geometry"]["mvertices"]:
                # enveloppe
                points2d = []
                for polygon in obj2d["geometry"]["mvertices"]:
                    pts = np.asarray(polygon, dtype=np.float32)
                    pts = np.resize(pts, (len(pts) // 2, 2)).tolist()
                    pts = np.array(pts)
                    pts = np.multiply(pts, np.array([1280, 800])).astype(np.int32)
                    points2d.append(pts)

            else:
                points2d = np.asarray(obj2d["geometry"]["vertices"], dtype=np.float32)
                points2d = np.resize(points2d, (len(points2d) // 2, 2))
                points2d = [np.multiply(points2d, np.array([1280, 800])).astype(np.int32)]

            mask = cv2.fillPoly(mask, pts=points2d, color=(0,0,1))
        mask_str = writeb64(mask)
        ann = {
            "id": frame,
            "timestamp": frame,
            "mask": mask_str
        }
        annotations_out.append(ann)
    data["annotations"] = annotations_out
    data["task_name"] = os.path.basename(os.path.dirname(input_folder)) + "-seg"

    with open(os.path.join(output_folder, annotation_file), "w") as f:
        f.write(json.dumps(data, indent=4))