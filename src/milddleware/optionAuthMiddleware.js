const jwt = require('jsonwebtoken');
const Sessions = require('../models/sessions');
const { Op } = require('sequelize');

function optionAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const deviceId = req.headers['device-id'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            jwt.verify(token, process.env.JWT_SECRET, async (err, decodedToken) => {
                if (err) return res.status(403).json({ message: 'Invalid token' });

                const session = await Sessions.findOne({
                    where: {
                        user_id: decodedToken.user_id,
                        id: decodedToken.session_id,
                        device_id: deviceId ?? '',
                        logout_date: {
                            [Op.eq]: null,
                        },
                    },
                    raw: true,
                });

                if (session && session.id) {
                    req.session_id = decodedToken.session_id;
                    req.user_id = decodedToken.user_id;

                    next();
                } else {
                    next();
                }
            });
        } else {
            next()
        }


    } catch (error) {
        console.log({ error })
        next();
    }
}

module.exports = optionAuthMiddleware;