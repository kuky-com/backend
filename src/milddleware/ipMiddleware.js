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
        
        // Log IP for debugging (can be removed in production)
        console.log(`Request from IP: ${clientIP} - ${req.method} ${req.originalUrl}`);
        
        next();
    } catch (error) {
        console.error('Error in IP middleware:', error);
        // Continue processing even if IP extraction fails
        req.clientIP = null;
        next();
    }
}

module.exports = ipMiddleware;
