const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const AdminSessions = require('../models/admin_sessions');

function authAdminMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied, no token provided' });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decodedToken) => {

        if (err) return res.status(403).json({ message: 'Invalid token' });

        const session = await AdminSessions.findOne({
            where: {
                admin_id: decodedToken.admin_id,
                id: decodedToken.session_id,
                logout_date: {
                    [Op.eq]: null
                },
            },
            raw: true
        })

        if (session && session.id) {
            req.session_id = decodedToken.session_id;
            req.admin_id = decodedToken.admin_id;

            next();
        } else {
            return res.status(403).json({ message: 'Invalid token' });
        }
    });
}

module.exports = authAdminMiddleware;
