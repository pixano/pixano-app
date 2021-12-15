const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const dbkeys = require('../config/db-keys');
const config = require('../config/config');
const { iterateOnDB } = require('../helpers/utils');
const { expiresIn } = require('../config/middleware');

/**
 * @api {post} /login Request login from username and password
 * @apiName PostLogin
 * @apiGroup User
 * 
 * @apiParam {String} [username] Username
 * @apiParam {String} [password] Password
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Success"
 *       "user": {
 *           "username": "john",
 *           "password": "pwd",
 *           "role": "admin",
 *           "preferences": {},
 *           "curr_assigned_jobs": {},
 *           "queue": {}
 *       }
 *     }: DbUser
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function post_login(req, res) {
  const username = req.body.username;
  const password = req.body.password;
  if (username && password) {
    const exists = await isUserExists(username, password);
    if (exists) {
      let token = jwt.sign({username},
        config.secret,
        { expiresIn }
      );
      const user = await getUserData(username);
      // return the JWT token for the future API calls
      res.cookie('token', token, {
        expires: new Date(Date.now() + 604800000),
        secure: false, // set to true if your using https
        httpOnly: true,
      });
      return res.status(200).json({
        message: 'Authentication successful!',
        user: {...user, username}
      });
    } else {
      return res.status(401).json({
        message: 'Incorrect username or password'
      });
    }
  } else {
    return res.status(401).json({
      message: 'Authentication failed! Please check the request'
    });
  }
}


/**
 * @api {get} /logout Log user out
 * @apiName GetLogout
 * @apiGroup User
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 */
async function get_logout(req, res) {
  res.cookie("token", "", { expires: new Date(0), path: '/' });
  res.sendStatus(200);
}

/**
 * @api {post} /users Add new user
 * @apiName PostUsers
 * @apiGroup User
 * @apiPermission admin
 * 
 * @apiParam {String} [username] Username
 * @apiParam {String} [password] Password
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 201 OK
 * 
 *  @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Username already existing
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function post_users(req, res) {
    const v = req.body;
    if (v.username && v.password) {
      if (await isUserExists(v.username, v.password)) {
        return res.status(400).json({message: 'Username already used'});
      } else {
        await db.put(dbkeys.keyForUser(v.username), {...v, curr_assigned_jobs: {}, queue: {}});
        const user = await getUserData(v.username);
        return res.status(201).json(user);
      }
    } else {
      return res.status(401).json({
        message: 'Signup requires username and password'
      });
    }
}

/**
 * @api {get} /users Get list of users
 * @apiName GetUsers
 * @apiGroup User
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [{
 *       "username": "john",
 *       "password": "pwd",
 *       "role": "admin",
 *       "preferences": {},
 *       "curr_assigned_jobs": {},
 *       "queue": {}
 *     }]: DbUser[]
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function get_users(_, res) {
    const values = [];
    iterateOnDB(db, dbkeys.keyForUser(), false, true)
        .on('data', (value) => values.push(value))
        .on('end', () => res.json(values));
}

/**
 * @api {delete} /users/:username Delete user
 * @apiName DeleteUser
 * @apiGroup User
 * @apiPermission admin
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function delete_user(req,res) {
    checkAdmin(req, async () => {
        if(req.username === req.params.username) {
            // A user try to delete is own account, do nothing and return an error
            res.status(400).json({
                message: 'User account '+req.params.username+' can\'t be deleted when being used'
            });
        } else {
            const key = dbkeys.keyForUser(req.params.username);
            await db.del(key);
            res.status(204).json({});
        }      
    });
}

/**
 * @api {get} /profile Get user details from request token
 * @apiName GetUser
 * @apiGroup User
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "username": "john",
 *       "password": "pwd",
 *       "role": "admin",
 *       "preferences": {},
 *       "curr_assigned_jobs": {},
 *       "queue": {}
 *     }: DbUser
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function get_profile(req, res) {
    const user = await getUserData(req.username);
    if (user) {
        return res.send(user);
    } else {
        return res.status(401).json({
            message: 'User is not valid'
        });
    }
}

/**
 * @api {put} /users/:username Update user info
 * @apiName PutUser
 * @apiGroup User
 * @apiPermission admin
 * 
 * @apiParam {RestUser} body
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 204 No Content
 * 
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 401 Unauthorized
 */
async function put_user(req, res) {
    checkAdmin(req, async () => {
        const config = req.body;
        try {
            config.username = req.params.username;
            const user_key = dbkeys.keyForUser(config.username);
            const currUser = await db.get(user_key);
            await db.put(user_key, {...currUser, ...config });
            res.status(204).json({});
        } catch (err) {
            res.status(400).json({
                message: 'Unknown user '+req.params.username
            });
        }
    });
}

/// Utils

/**
 * Execute callback if admin authorization.
 * @param {level} db 
 * @param {Request} req 
 * @param {Callback} action 
 */
 const checkAdmin = async (req, action) => {
  const user = await db.get(dbkeys.keyForUser(req.username));
  if (user.role === 'admin') {
    action();
  } else {
    res.status(401).json({});
  }
}

/**
 * Determine if user exists.
 * @param {Level} db 
 * @param {String} username 
 * @param {String} password 
 */
 async function isUserExists(username, password) {
  try {
    const user = await db.get(dbkeys.keyForUser(username));
    return user.password === password;
  } catch (err) {
    return false;
  }
}

/**
 * Get user info from its username.
 * @param {String} username 
 */
async function getUserData(username) {
    let userData;
    try {
      userData = await db.get(dbkeys.keyForUser(username));
      delete userData.password;
      return userData;
    } catch (err) {
      return null;
    }
}

module.exports = {
    post_login,
    get_logout,
    post_users,
    get_users,
    put_user,
    delete_user,
    get_profile,
    checkAdmin
}
