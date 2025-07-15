const express = require('express');
const { getClientIP, getLocationFromIP, updateUserLocationFromIP } = require('../utils/geolocation');
const authMiddleware = require('../milddleware/authMiddleware');
const router = express.Router();

// Test endpoint to get IP and location information
router.get('/ip-info', (req, res) => {
    try {
        const ipAddress = getClientIP(req);
        
        res.json({
            success: true,
            data: {
                ip_address: ipAddress,
                headers: {
                    'x-forwarded-for': req.headers['x-forwarded-for'],
                    'x-real-ip': req.headers['x-real-ip'],
                    'cf-connecting-ip': req.headers['cf-connecting-ip'],
                },
                connection_ip: req.connection?.remoteAddress,
                socket_ip: req.socket?.remoteAddress,
                req_ip: req.ip
            }
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Test endpoint to get geolocation from IP
router.get('/geolocation/:ip?', async (req, res) => {
    try {
        const ipAddress = req.params.ip || getClientIP(req);
        const locationData = await getLocationFromIP(ipAddress);
        
        res.json({
            success: true,
            data: locationData
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Endpoint to manually update user location from their current IP
router.post('/update-location', authMiddleware, async (req, res) => {
    try {
        const { user_id } = req;
        const ipAddress = getClientIP(req);
        
        const result = await updateUserLocationFromIP(user_id, ipAddress);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
