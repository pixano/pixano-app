/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

export const UPDATE_WAITING = 'UPDATE_WAITING';

export const updateWaiting = (waiting = true) => {
  return {
      type: UPDATE_WAITING,
      waiting
  }
}

const _requestHelper = (method, url = "/api/v1/", body = undefined, dispatch = null) => {
  
  const messageContent = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (body && method !== 'GET') {
    messageContent.body = JSON.stringify(body);
  }
  if (dispatch) {
    dispatch(updateWaiting(true));
  }
  return new Promise((resolve, reject) => {
    return fetch(encodeURI(url), messageContent).then((response) => {
      if (dispatch) {
        dispatch(updateWaiting(false)); 
      }
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        const res = contentType && contentType.includes("application/json") ? 
                  response.json() : {};
        resolve(res);
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          // In case of error, json response is embedded in a Promise
          response.json().then(error => {
            reject(error);
          });          
        } else {
          reject({})
        }
      }
    })
  });
}

export const GET = (url = "/api/v1/", body = {}, dispatch = null) => {
  return _requestHelper('GET', url, body, dispatch);
}

export const POST = (url = "/api/v1/", body = {}, dispatch = null) => {
  return _requestHelper('POST', url, body, dispatch);
}

export const PUT = (url = "/api/v1/", body = {}, dispatch = null) => {
  return _requestHelper('PUT', url, body, dispatch);
}

export const DELETE = (url = "/api/v1/", body = {}, dispatch = null) => {
  return _requestHelper('DELETE', url, body, dispatch);
}
