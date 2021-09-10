# Automatic user generation
import requests

# Change this url if needed
PixanoUrl = 'http://localhost:3000/api/v1'

# Change list of users to be created if needed
Users = [
    {
        "username": 'john',
        "password": 'root',
        "role": 'admin',
        "preferences": { "theme": 'white'}
    },
    {
        "username": 'root',
        "password": 'root',
        "role": 'admin',
        "preferences": { "theme": 'white'}
    }  
]

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


##################
# Users creation #
##################
for User in Users:
    CreateUserResponse = session.post(f'{PixanoUrl}/users/', json = User)
    if CreateUserResponse.status_code == 201:
        print(f"+ User {User['username']} created.")
    elif CreateUserResponse.status_code == 400:
        # user already exist, reset their password
        CreateUserResponse = session.put(f'{PixanoUrl}/users/{User["username"]}', json = User)
        print(f"+ User {User['username']} updated.")
    else:
        print('Error for user creation')
        exit(0)

#################
# Task creation #
#################
TaskBody = {
    "name": "my-task",
    "dataset": { "path": 'images/'},
    "spec": {
        "plugin_name": "rectangle",
        "label_schema": {
                "category": [
                    { "name": 'car', "color": "green", "properties": [{"name": 'isBlue', "type": 'checkbox', "default": False}]},
                    { "name": 'person', "color": "#eca0a0", "properties": [{"name": 'size', "type": 'dropdown', "enum": ['little', 'big'], "default": 'little'}]}
                ],
                "default": 'person'
            },
        "data_type": "image",
        "settings": {},
      }
}
TaskResponse = session.post(f'{PixanoUrl}/tasks/', json = TaskBody)
if TaskResponse.status_code == 201:
    print(f"+ Task {TaskBody['name']} created.")
elif TaskResponse.status_code == 400:
    print(f"- Task {TaskBody['name']} already exists.")