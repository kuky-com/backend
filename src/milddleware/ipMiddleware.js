const { getClientIP } = require('../utils/geolocation');

/**
 * Middleware to extract and log client IP address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function ipMiddleware(req, res, next) {
    try {
        // Extract the client IP address
        const clientIP = getClientIP(req);
        
        // Add IP to request object for easy access
        req.clientIP = clientIP;
        
        // Log IP and client information for debugging
        const clientInfo = {
            ip: clientIP,
            platform: req.headers['x-client-platform'],
            userAgent: req.headers['x-client-user-agent'] || req.headers['user-agent'],
            language: req.headers['x-client-language'],
            timezone: req.headers['x-client-timezone'],
            timestamp: req.headers['x-client-timestamp'],
        };
        
        console.log(`Request from ${clientInfo.platform || 'unknown'} - IP: ${clientIP} - ${req.method} ${req.originalUrl}`, clientInfo);
        
        next();
    } catch (error) {
        console.error('Error in IP middleware:', error);
        // Continue processing even if IP extraction fails
        req.clientIP = null;
        next();
    }
}

module.exports = ipMiddleware;
