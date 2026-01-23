const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');

// Initialize with local default credentials
// This works because the user is already logged in via firebase CLI
admin.initializeApp({
    storageBucket: 'zyphe-af0bf.firebasestorage.app'
});

const storage = new Storage();
const bucketName = 'zyphe-af0bf.firebasestorage.app';

async function setCors() {
    console.log(`Setting CORS for bucket: ${bucketName}...`);
    try {
        await storage.bucket(bucketName).setCorsConfiguration([
            {
                maxAgeSeconds: 3600,
                method: ['GET'],
                origin: ['*'], // Relaxes it for all origins to ensure localhost:3000 works
                responseHeader: ['Content-Type'],
            },
        ]);
        console.log('Successfully updated CORS configuration.');
    } catch (error) {
        console.error('Failed to set CORS:', error);
        process.exit(1);
    }
}

setCors();
