require('dotenv').config();
const { MongoClient } = require('mongodb');

// Database connection strings - replace with your actual MongoDB URIs
const DB1_URI = process.env.DB1_URI 
const DB2_URI = process.env.DB2_URI
// MongoDB clients
let db1Client = null;
let db2Client = null;
let db1 = null;
let db2 = null;

// Connect to first database (RFID)
const connectDB1 = async () => {
    try {
        db1Client = new MongoClient(DB1_URI);
        await db1Client.connect();
        db1 = db1Client.db('rfid_db');
        console.log('Connected to RFID Database (DB1)');
    } catch (error) {
        console.error('Error connecting to RFID Database:', error.message);
        process.exit(1);
    }
};

// Connect to second database (Ticket)
const connectDB2 = async () => {
    try {
        db2Client = new MongoClient(DB2_URI);
        await db2Client.connect();
        db2 = db2Client.db("test");
        console.log('Connected to Ticket Database (DB2)');
    } catch (error) {
        console.error('Error connecting to Ticket Database:', error.message);
    }
};

// Get database instances
const getRFIDDB = () => {
    if (!db1) {
        throw new Error('RFID Database not connected');
    }
    return db1;
};

const getTicketDB = () => {
    if (!db2) {
        throw new Error('Ticket Database not connected');
    }
    return db2;
};

// Graceful shutdown
const closeConnections = async () => {
    try {
        if (db1Client) {
            await db1Client.close();
            console.log('RFID Database connection closed');
        }
        if (db2Client) {
            await db2Client.close();
            console.log('Ticket Database connection closed');
        }
    } catch (error) {
        console.error('Error closing database connections:', error);
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    await closeConnections();
    process.exit(0);
});

module.exports = {
    connectDB1,
    connectDB2,
    getRFIDDB,
    getTicketDB,
    closeConnections
};