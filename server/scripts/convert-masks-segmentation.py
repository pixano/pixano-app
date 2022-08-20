# ex. : python server/scripts/convert-masks-segmentation.py --workspace /data/DATASETs/Confiance/UC_Valeo_Scene_understanding/Dataset_Woodscape --input Data/pred_rgb --datapath Data/rgb_images
import os
import json

from certifi import where
import cv2
import base64
import numpy as np

# 1) parse args
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--workspace", help="workspace in which all data is stored. Paths will be relative to this workspace so that Pixano can be started with this same workspace.", type=str, required=True)
parser.add_argument("--input", help="input folder containing the masks in png images (local to workspace)", type=str, required=True)
parser.add_argument("--output", help="path where to export the converted data (local to workspace)", type=str)
parser.add_argument("--datapath", help="path of original data corresponding to the input masks (local to workspace)", type=str, required=True)
args = parser.parse_args()

# 2) configure input/output
workspace = args.workspace
input_folder = args.workspace + '/' + args.input
if args.output:
	output_path = args.workspace + '/' + args.output
else:
	output_path = os.path.abspath(os.path.join(input_folder, os.pardir))
print("input_folder=",input_folder)
print("output_path=",output_path)
taskname = os.path.basename(os.path.dirname(input_folder)) + "-seg"
output_folder =  output_path + "/" + taskname
output_task_file = output_path + "/" + taskname + ".json"

# 2) utils functions
def writeb64(img):
	'''writeb64: convert png image to base 64 string'''
	retval, buffer = cv2.imencode('.png', img)
	pic_str = base64.b64encode(buffer)
	pic_str = pic_str.decode()
	return "data:image/png;base64," + pic_str

def rgb_to_hex(srgb):
	'''rgb_to_hex: convert color from rgb representation (str([R,G,B])) to hex representation (str)'''
	lsrgb = srgb.replace("]", "").replace("[", "").split(',')#split string
	bgr = (int(lsrgb[2]),int(lsrgb[1]),int(lsrgb[0]))
	return '#%02x%02x%02x' % bgr# representation in Pixano is BGR


# 3) extract data from masks and write corresponding annotation files
if not os.path.exists(output_folder):
	os.makedirs(output_folder)

colors = []#original colors (strings)
gen_ids = []#generated ids (strings)

for image_mask in os.listdir(input_folder):
	print("image=",input_folder + "/" + image_mask)
	annotation_file = os.path.splitext(image_mask)[0] + ".json"
	annotations = []
	img = cv2.imread(input_folder + "/" + image_mask)
	# annotations
	if type(img) is np.ndarray:# if img is empty (None), there are no annotations
		mask_shape = (img.shape[0],img.shape[1],4)# add an alpha chanel to the mask
		mask = np.zeros(mask_shape, dtype="uint8")# mask used ids instead of colors and transparency for unlabelled
		# annotations : 1 id per color
		flat_colors = np.reshape(img, (img.shape[0]*img.shape[1],3))# we assume png without transparency : shape=x,y,3
		existing_colors = np.unique(flat_colors,axis=0)
		#print("existing_colors=", existing_colors)
		for col in existing_colors:
			if np.array_equal(col, [0,0,0]):
				continue# [0,0,0] is for background
			scol = str(col.tolist()).replace(" ", "")#suppress spaces to be able to interpret easier
			if scol in colors:
				idx = colors.index(scol)
				sid = gen_ids[idx]
			else:
				idx = len(colors)
				sid = str([0,0,idx+1]).replace(" ", "")# only semantic degmentation here # starts from 1 #suppress spaces to have the same representation then from javascript
				gen_ids.append(sid)
				colors.append(scol)
			ann = {
				"category": "class"+str(idx+1),
				"options": {},
				"id": sid
			}
			annotations.append(ann)
			# convert the mask with ids instead of colors
			mask[np.where((img==col).all(axis=2))] = [idx+1,0,0,255]# representation in Pixano is BGRa
		
		# mask annotation: id 0 = mask
		ann = {
			"id": 0,
			"mask": writeb64(mask)
		}
		annotations.append(ann)

	# complete the file
	data = {
		"type": "image",
		"path": args.datapath+'/'+image_mask,
		"children": ""
	}
	annotation_file_content = {
		"task_name": taskname,
		"annotations": annotations,
		"data": data
	}
	# write file
	print("writing=",os.path.join(output_folder, annotation_file))
	with open(os.path.join(output_folder, annotation_file), "w") as f:
		f.write(json.dumps(annotation_file_content, indent=1))


# 4) write a task file based on known informations
categories = []
for idx in range(0,len(gen_ids)):
	cat = {
		"name": "class"+str(idx+1),
		"color": rgb_to_hex(colors[idx]),
		"idx": idx+1,
		"instance": False,#by default, this is a semantic segmentation
		"properties": []
	}
	categories.append(cat)
label_schema = {
	"category": categories,
	"default": "class"+"1"
}
spec = {
	"plugin_name": "segmentation",
	"data_type": "image",
	"label_schema": label_schema
}
dataset = {
	"path": args.datapath,
	"data_type": "image"
}
task_file_content = {
	"name": taskname,
	"version": "0.9",
	"dataset": dataset,
	"spec": spec
}

# write file
with open(output_task_file, "w") as f:
	f.write(json.dumps(task_file_content, indent=1))