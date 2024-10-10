const jwt = require('jsonwebtoken');
const Sessions = require('../models/sessions');
const { Op } = require('sequelize');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied, no token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {

        if (err) return res.status(403).json({ message: 'Invalid token' });

        const session = Sessions.findOne({
            user_id: decodedToken.user_id,
            id: decodedToken.session_id,
            logout_date: {
                [Op.ne]: null
            }
        })

        if(session) {
            req.session_id = decodedToken.session_id;
            req.user_id = decodedToken.user_id;
    
            next();
        } else {
            return res.status(403).json({ message: 'Invalid token' });
        }
    });
}

module.exports = authMiddleware;
