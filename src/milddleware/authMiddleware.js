const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied, no token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {

        if (err) return res.status(403).json({ message: 'Invalid token' });

        req.session_id = decodedToken.session_id;
        req.user_id = decodedToken.user_id;

        next();
    });
}

module.exports = authMiddleware;
