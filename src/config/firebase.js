const admin = require('firebase-admin');
require('dotenv').config();

let db = null;

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        if (!privateKey.includes('\n') && privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }
        
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1).replace(/\\n/g, '\n');
        }
        
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey
            })
        });
        
        db = admin.firestore();
        console.log('✅ Firebase initialized successfully');
    } else {
        console.log('⚠️  Firebase credentials not provided. Using memory-only storage.');
        db = {
            collection: () => ({
                doc: () => ({
                    get: async () => ({ exists: false }),
                    set: async () => {},
                })
            })
        };
    }
} catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.error('Tip: Make sure FIREBASE_PRIVATE_KEY is properly formatted with newlines');
    db = {
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: false }),
                set: async () => {},
            })
        })
    };
}

module.exports = { admin, db };
