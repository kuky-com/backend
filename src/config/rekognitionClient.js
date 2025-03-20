const { RekognitionClient } = require('@aws-sdk/client-rekognition');

const rekognitionClient = new RekognitionClient({
    region: 'ap-southeast-2', // Replace with your AWS region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

module.exports = { rekognitionClient };