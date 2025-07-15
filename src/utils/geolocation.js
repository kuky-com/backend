const axios = require('axios');
const Users = require('@/models/users');

/**
 * Extract the real IP address from the request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getClientIP(req) {
    // Check for IP address from various headers
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, get the first one
        return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
        return realIP;
    }
    
    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    
    // Fallback to connection remote address
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip ||
           '127.0.0.1';
}

/**
 * Get geolocation from IP address using ip-api.com (free service)
 * @param {string} ipAddress - IP address to geolocate
 * @returns {Promise<Object>} Object containing latitude, longitude, and other location data
 */
async function getLocationFromIP(ipAddress) {
    try {
        // Skip localhost and private IPs
        if (!ipAddress || 
            ipAddress === '127.0.0.1' || 
            ipAddress === '::1' || 
            ipAddress.startsWith('192.168.') ||
            ipAddress.startsWith('10.') ||
            ipAddress.startsWith('172.')) {
            return {
                success: false,
                message: 'Private or localhost IP address',
                latitude: null,
                longitude: null,
                city: null,
                country: null,
                ipAddress
            };
        }

        // Use ip-api.com for geolocation (free service, no API key required)
        const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
            timeout: 5000,
            params: {
                fields: 'status,message,country,countryCode,region,regionName,city,lat,lon,timezone,query'
            }
        });

        const data = response.data;

        if (data.status === 'success') {
            return {
                success: true,
                latitude: data.lat,
                longitude: data.lon,
                city: data.city,
                region: data.regionName,
                country: data.country,
                countryCode: data.countryCode,
                timezone: data.timezone,
                ipAddress: data.query
            };
        } else {
            return {
                success: false,
                message: data.message || 'Failed to get location',
                latitude: null,
                longitude: null,
                city: null,
                country: null,
                ipAddress
            };
        }
    } catch (error) {
        console.error('Error getting location from IP:', error.message);
        
        // Fallback to alternative service (ipapi.co)
        try {
            const fallbackResponse = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
                timeout: 5000
            });
            
            const fallbackData = fallbackResponse.data;
            
            if (fallbackData.latitude && fallbackData.longitude) {
                return {
                    success: true,
                    latitude: fallbackData.latitude,
                    longitude: fallbackData.longitude,
                    city: fallbackData.city,
                    region: fallbackData.region,
                    country: fallbackData.country_name,
                    countryCode: fallbackData.country_code,
                    timezone: fallbackData.timezone,
                    ipAddress: fallbackData.ip
                };
            }
        } catch (fallbackError) {
            console.error('Fallback geolocation service also failed:', fallbackError.message);
        }

        return {
            success: false,
            message: error.message,
            latitude: null,
            longitude: null,
            city: null,
            country: null,
            ipAddress
        };
    }
}

/**
 * Update user location based on IP address
 * @param {number} userId - User ID
 * @param {string} ipAddress - IP address
 * @returns {Promise<Object>} Location update result
 */
async function updateUserLocationFromIP(userId, ipAddress) {
    try {
        const locationData = await getLocationFromIP(ipAddress);
        
        if (locationData.success && locationData.latitude && locationData.longitude) {
            
            await Users.update(
                {
                    last_latitude: locationData.latitude,
                    last_longitude: locationData.longitude,
                },
                {
                    where: { id: userId }
                }
            );

            console.log(`Updated user ${userId} location: ${locationData.latitude}, ${locationData.longitude} (${locationData.city}, ${locationData.country})`);
            
            return {
                success: true,
                updated: true,
                ...locationData
            };
        } else {
            console.log(`Could not get valid location for user ${userId} with IP ${ipAddress}: ${locationData.message}`);
            return {
                success: false,
                updated: false,
                ...locationData
            };
        }
    } catch (error) {
        console.error('Error updating user location from IP:', error.message);
        return {
            success: false,
            updated: false,
            message: error.message,
            ipAddress
        };
    }
}

module.exports = {
    getClientIP,
    getLocationFromIP,
    updateUserLocationFromIP
};
