# Pixano API

This document lists the API of the Pixano server that enable the creation of new users, annotation tasks and labels. They can be used if you want to automate some processes without using the interface (e.g. create users, populate labels with pre-annotation, etc.). A [powershell](../server/scripts/autogen.ps1) is available for example.

## REST API definition

| Action                            | Verb      | URL               | Input Body      | Response                          |
| ----------------------------------|---------- |:----------------- | --------------: | --------------------------------: |
| Request login                     | POST      | /login            | {username, pwd} | 200 OKconfig / 401 Unauthorized   |
| Add new user                      | POST      | /signup           | {username, pwd} | 200 OK / 401 Unauthorized         |
| Update user                       | PUT       | /users/{username} | `RestUser`      | 204 No content / 401 Unauthorized |
| Delete user                       | DELETE    | /users/{username} |                 | 204 No Content / 401 Unauthorized |
| Get user profile                  | GET       | /profile          |                 | `RestUser` + 200 OK / 401 Unauthorized |
| Get list of all datasets          | GET       | /datasets         |                 | `DbDataset[]`                     |
| Create dataset and elementary data items| POST| /datasets         | `DbDataset`     | `DbDataset` + 201 Created / 400 Bad Request / 401 Unauthorized |
| Get detail of dataset {dataset_id}| GET       | /datasets/{dataset_id} |            | `DbDataset`                       |
| Delete dataset {datasets_id}      | DELETE    | /datasets/{dataset_id} |            | 204 No Content / 401 Unauthorized |
| Get data info                     | GET       | /datasets/{dataset_id}/data/{data_id} |  | `DbData`                     |
| Get list of all label specifications| GET     | /specs            |                 | `DbSpec[]`                        |
| Create a label specification      | POST      | /specs            | `DbSpec`        | `DbSpec` + 201 Created / 401 Unauthorized |
| Get detail of spec {spec_id}      | GET       | /specs/{spec_id}  |                 | `DbSpec`                          |
| Update detail of spec {spec_id} (caution)| PUT| /specs/{spec_id}  | `DbSpec`        | 204 No Content / 401 Unauthorized |
| Delete spec {spec_id}             | DELETE    | /specs/{spec_id}  |                 | 204 No Content / 401 Unauthorized |
| Get list of all tasks             | GET       | /tasks            |                 | `RestTask[]`                      |
| Create task, subsequent data and jobs| POST   | /tasks            | `RestTask`      | `RestTask` + 201 Created / 401 Unauthorized |
| Get detail of task {task_name}    | GET       | /tasks/{task_name}|                 | `RestTask`                        |
| Delete task {task_name}           | DELETE    | /tasks/{task_name}|                 | 204 No Content / 401 Unauthorized |
| Fetch jobs for a task_name        | GET       | /tasks/{task_name}/jobs?page={p}&status={LabellingStatus}&worker={string}&sort={SortParam} | | `DbResult[]` |
| Get a specific annotation result of a data | GET | /tasks/{task_name}/results/{data_id} | | `DbResult`                  |
| Get previous annotation result | GET | /tasks/{task_name}/results/data_id}/previous?status={LabellingStatus}&worker={string}&sort={SortParam} | | `DbResult` |
| Get next labelling history from a specific data | GET | /tasks/{task_name}/results/{data_id}/next?status={LabellingStatus}&worker={string}&sort={SortParam} | | `DbResult` |
| Fetch one random job for a given task and objective| GET | /tasks/{task_name}/jobs/next?objective={objective} |  | `DbJob` |
| Update job (interruption or status update)| PUT| /tasks/{task_name}/jobs/{job_id}   | `RestJobUpdate`      | 204 No Content / 401 Unauthorized |
| Update batch of jobs (status only)| PUT       | /tasks/{task_name}/jobs             | `RestBatchJobUpdate` | 204 No Content / 401 Unauthorized |
| Fetch labels for a data           | GET       | /tasks/{task_name}/labels/{data_id} |                      | any |
| Update labels for a data          | PUT       | /tasks/{task_name}/labels/{data_id} | any                  | 204 No Content / 401 Unauthorized |

## Database structure

| Key | Value | Description |
|:-------|:---- |:--- |
| v | `DbVersion` | Code version that generate this database |
| u:{username} |`DbUser` | User info |
| d:{dataset_id} | `DbDataset` | Dataset info (relative path folder) |
| d:{dataset_id}:{data_id} | `DbData` | DataImage info |
| s:{spec_id} | `DbSpec` | Custom Label Specifications |
| t:{task_name} | `DbTask` |  A task consists of label specifications and a dataset. |
| j:{task_name}:{job_id} | `DbJob` | Element of an annotation process. Its objective is immutable. Data_id corresponds to either an image, pcl, a sequence of pcl, a sequence of image. |
| r:{task_name}:{data_id} | `DbResult` | Annotation results for a data. History of elementary job already done and next job. Define also current status and cumulated time |
| l:{task_name}:{data_id} | `DbLabel` | Labels for an image |
| ls:{task_name}:{data_id} | `DbLabelStatistics` | Labels statistic for an image |

## Interfaces

```ts
// possible objectives to assign to an annotation job
type Objective =  'to_annotate' | 'to_validate' | 'to_correct';

// possible status a data item can have
type LabellingStatus =  'to_annotate' | 'to_validate' | 'to_correct' | 'done';

// possible types a data item can have
type DataType =  'image' | 'pcl' | 'pcl_image' | 'sequence_pcl' | 'sequence_image' | 'sequence_pcl_image';

// possible roles a user can have
type Role =  'admin' | 'user';

type SortParam =  'status' | 'assigned';

//// Database interfaces

// Code version that generate this database
interface DbVersion {
    version: string;
}

// User info with its given rights
interface DbUser {
    username: string;
    password: string;
    role: string;
    preferences: object;
    last_assigned_jobs: string;
}

// Dataset info
interface DbDataset {
    id: string;
    // relative to workspace
    path: string;
    data_type: DataType
}

// Data item info
interface DbData {
    id: string;
    dataset_id: string;
    type: DataType;
    // path is the data item url or urls in case of multi-view
    // if the data item is a sequence, `path` is only for information
    path: string | string[];
    // if data item is a sequence, each sub item is defined as a `frame`
    children: DbFrame[]
}

interface DbFrame {
    timestamp: number;
    path: string | string[];
}

// Custom Label Specifications
interface DbSpec {
    id: string;
    plugin_name: string;
    data_type: DataType;
    label_schema: object
}

// An annotation task consists of label specifications and a dataset
interface DbTask {
    name: string;
    spec_id: string;
    dataset_id: string;
}

// Element of an annotation process with immutable objective
interface DbJob {
    id: string;
    task_name: string;
    data_id: string;
    objective: Objective;
    assigned_to: string;
    start_at: number;
    duration: number
}

// Annotation jobs summary for a data item
interface DbResult {
    task_name: string;
    data_id: string;
    status: LabellingStatus;
    finished_job_ids: string[];
    current_job_id: string;
    cumulated_time: number;
    annotator: string;
    validator: string;
}

// Labels for an image
interface DbLabel {
    task_name: string;
    data_id: string;
    annotations: any;
}

// Labels statistic for an image
interface DbLabelStatistics {
    task_name: string;
    data_id: string;
    value: any;
}

//// Rest interfaces

// User info
interface RestUser {
    id: string;
    username: string;
    password: string;
    role: string;
    preferences: object;
}

interface RestTask {
    name: string;
    dataset: DbDataset;
    spec: DbSpec;
}

interface RestJobUpdate {
    objective: LabellingStatus;
    comments: any;
}

interface RestBatchJobUpdate {
    job_ids: string[];
    objective: LabellingStatus
}
```

