# Get some statistics
import requests
import json

# Change this url if needed
PixanoUrl = 'http://localhost:3000/api/v1'


###############
# Admin login #
###############
session = requests.Session()
BodyLogin = { "username": 'admin', "password": 'admin'}
LoginResponse = session.post(f'{PixanoUrl}/login/', json = BodyLogin)
if LoginResponse.status_code == 200:
    print('Login admin ok.')
else:
    print('Failed login:', LoginResponse.json())
    exit(0)

################
# Task looping #
################

TasksResponse = session.get(f'{PixanoUrl}/tasks/')

for task in TasksResponse.json():
    is_sequence = task["dataset"]["data_type"].startswith('sequence_')
    task_type = task["spec"]["plugin_name"]
    dataset_id = task["dataset"]["id"]
    DatasResponse = session.get(f'{PixanoUrl}/datasets/{dataset_id}/data/')
    datas = DatasResponse.json()
    print(f'Processing task {task["name"]}:')
    
    # Count labels
    nb_annotations = 0
    for data in datas:
        DataResponse = session.get(f'{PixanoUrl}/tasks/{task["name"]}/labels/{data["id"]}')
        if task_type in ["rectangle", "polygon", "keypoints"]:
            nb_annotations += len(DataResponse.json()["annotations"])

    # Count images
    nb_images = 0
    if not is_sequence:
        nb_images = len(data)
    else:
        for data in datas:
            nb_images += len(data["children"])


    print('...Nb annotations', nb_annotations)
    print('...Nb images', nb_images)
