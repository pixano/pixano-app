/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const jwt = require('jsonwebtoken');
const config = require('./config');
const got = require('got');
let certs;
let aud;
// Authentification token duration
// expires in 24 hours
const expiresIn = '24h';

/**
 * Middleware to determine if the request
 * is well authentificated using the public token
 * of the user.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
const checkWhoToken = (req, res, next) => {
  // let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
  let token = req.cookies.token || '';
  if (!token) {
    return res.status(401).json({
      failed: true,
      message: 'Auth token is not supplied'
    });
  }
  if (token.startsWith('Bearer ')) {
    // Remove Bearer from string
    token = token.slice(7, token.length);
  }

  if (token) {
    jwt.verify(token, config.secret, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          failed: true,
          message: 'Token is not valid'
        });
      } else {
        // the token is valid
        token = updateTokenIfAlmostDead(token, decoded);
        req.username = decoded.username;
        req.token = token;
        res.cookie('token', token, {
          expires: new Date(Date.now() + 604800000),
          secure: false, // set to true if your using https
          httpOnly: true,
          sameSite: 'lax'
        });
        next();
      }
    });
  } else {
    return res.json({
      failed: true,
      message: 'Auth token is not supplied'
    });
  }
}

/**
 * If too old, create a new token
 * @param {string} token 
 * @param {object} decoded 
 */
function updateTokenIfAlmostDead(token, decoded) {
  const current_time = new Date().getTime() / 1000;
  // remaining time before token obsolete in s.
  const remainingTime = (decoded.exp - current_time).toFixed(1);
	if (remainingTime < 60 * 60) {
    const newToken = jwt.sign({ username: decoded.username },
      config.secret, { expiresIn }
    );
    return newToken;
  }
  return token;
}


/**
 * Get user email from its request
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {email: "string"}
 */
 function checkWhoGoogle(req, res, next) {
  let info = { email : "ramachandra-sah.ganesh@valeo.com"};
 
  // UNCOMMENT FOR PROD
  // const assertion = req.header('X-Goog-IAP-JWT-Assertion');
  // validateAssertion(assertion).then(function(info){
  //     req.username = info.email;
  //     next();
  // });
  req.username = info.email;
  next();
}



/**
 * Execute callback if admin authorization.
 * @param {level} db 
 * @param {Request} req 
 * @param {Callback} action 
 */


async function certificates() {
  if (!certs) {
    let response = await got('https://www.gstatic.com/iap/verify/public_key');
    certs = JSON.parse(response.body);
  }
  return certs;
}

async function getMetadata(itemName) {
  const endpoint = 'http://metadata.google.internal';
  const path = '/computeMetadata/v1/project/';
  const url = endpoint + path + itemName;

  let response = await got(url, {
    headers: {'Metadata-Flavor': 'Google'},
  });
  return response.body;
}

async function audience() {
  if (!aud) {
    let project_number = await getMetadata('numeric-project-id');
    let project_id = await getMetadata('project-id');

    aud = '/projects/' + project_number + '/apps/' + project_id;
  }
  return aud;
}

async function validateAssertion(assertion) {
  if (!assertion) {
    return {};
  }
  // Decode the header to determine which certificate signed the assertion
  const encodedHeader = assertion.split('.')[0];
  const decodedHeader = Buffer.from(encodedHeader, 'base64').toString('utf8');
  const header = JSON.parse(decodedHeader);
  const keyId = header.kid;

  // Fetch the current certificates and verify the signature on the assertion
  const certs = await certificates();
  const payload = jwt.verify(assertion, certs[keyId]);

  // Check that the assertion's audience matches ours
  const aud = await audience();
  if (payload.aud !== aud) {
    throw new Error('Audience mismatch. {$payload.aud} should be {$aud}.');
  }

  // Return the two relevant pieces of information
  return {
    email: payload.email,
    sub: payload.sub,
  };
}











module.exports = {
  checkWhoToken,
  checkWhoGoogle,
  expiresIn
}
