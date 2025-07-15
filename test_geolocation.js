// Simple test for the geolocation functionality
const { getLocationFromIP } = require('./src/utils/geolocation');

async function testGeolocation() {
    console.log('Testing geolocation functionality...');
    
    // Test with Google's public DNS IP
    try {
        const result = await getLocationFromIP('8.8.8.8');
        console.log('Result for 8.8.8.8:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error testing geolocation:', error);
    }
    
    // Test with localhost (should be skipped)
    try {
        const result = await getLocationFromIP('127.0.0.1');
        console.log('Result for localhost:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error testing localhost:', error);
    }
}

if (require.main === module) {
    testGeolocation();
}

module.exports = { testGeolocation };
