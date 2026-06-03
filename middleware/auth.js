// middleware/auth.js
const jwt = require('jsonwebtoken');

function protect(req, res, next) {
  // The frontend sends the token in the Authorization header like:
  // "Authorization: Bearer eyJhbGci..."
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1]; // extract the token part

  try {
    // Verify the token using our secret key
    // If it's invalid or expired, this throws an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the admin's info to the request so routes can use it
    req.admin = decoded; // { id, email, role }
    next(); // pass control to the actual route
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

module.exports = protect;