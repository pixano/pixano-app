/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const jwt = require('jsonwebtoken');
const config = require('./config');

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
const checkToken = (req, res, next) => {
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

module.exports = {
  checkToken,
  expiresIn
}
