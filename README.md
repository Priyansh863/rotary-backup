# RFID & Ticket Management System

A Node.js Express application that handles RFID and Ticket operations with separate MongoDB connections.

## Features

- **Separate MongoDB Connections**: Two different MongoDB databases for RFID and Ticket data
- **Direct MongoDB Queries**: Uses native MongoDB driver without Mongoose models
- **Web Interface**: HTML form with inputs for RFID and Ticket operations
- **RESTful APIs**: Multiple endpoints for processing, searching, and managing data

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Database URLs**:
   Edit the database connection strings in `config/database.js`:
   ```javascript
   const DB1_URI = 'mongodb://localhost:27017/rfid_database';    // RFID Database
   const DB2_URI = 'mongodb://localhost:27017/ticket_database';  // Ticket Database
   ```

3. **Update Collection Names**:
   In `routes/rfid.js` and `routes/ticket.js`, replace collection names with your actual collection names:
   ```javascript
   const collection = db.collection('your_rfid_collection_name');
   const collection = db.collection('your_ticket_collection_name');
   ```

4. **Start the Server**:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

5. **Access the Application**:
   Open http://localhost:3000 in your browser

## API Endpoints

### RFID APIs (Database 1)
- `POST /api/rfid/process` - Process RFID data
- `GET /api/rfid/search/:rfidId` - Search for RFID record
- `POST /api/rfid/create` - Create new RFID record

### Ticket APIs (Database 2)
- `POST /api/ticket/process` - Process ticket data
- `GET /api/ticket/search/:ticketId` - Search for ticket record
- `POST /api/ticket/validate` - Validate ticket
- `POST /api/ticket/create` - Create new ticket record

## Web Interface

The application includes a user-friendly web interface with:

- **RFID Section**: Two input fields for RFID operations
  - Input 1: For processing and creating RFID records
  - Input 2: For searching RFID records

- **Ticket Section**: Two input fields for Ticket operations
  - Input 1: For processing, validating, and creating tickets
  - Input 2: For searching ticket records

## Request/Response Examples

### RFID Processing
```javascript
// Request
POST /api/rfid/process
{
  "rfidId": "RFID123456"
}

// Response
{
  "success": true,
  "message": "RFID processed successfully",
  "data": {
    "rfidId": "RFID123456",
    "status": "accessed",
    "lastAccessed": "2025-09-26T10:30:00.000Z"
  }
}
```

### Ticket Processing
```javascript
// Request
POST /api/ticket/process
{
  "ticketId": "TICKET789"
}

// Response
{
  "success": true,
  "message": "Ticket processed successfully",
  "data": {
    "ticketId": "TICKET789",
    "status": "used",
    "usedAt": "2025-09-26T10:30:00.000Z"
  }
}
```

## Environment Variables

You can use environment variables to configure database connections:

```bash
export DB1_URI="mongodb://your-rfid-db-connection-string"
export DB2_URI="mongodb://your-ticket-db-connection-string"
export PORT=3000
```

## File Structure

```
nodejs-app/
├── app.js                 # Main Express server
├── package.json          # Dependencies and scripts
├── config/
│   └── database.js       # MongoDB connection configuration
├── routes/
│   ├── rfid.js          # RFID API routes
│   └── ticket.js        # Ticket API routes
└── public/
    └── index.html       # Web interface
```

## Notes

- Replace collection names in the route files with your actual MongoDB collection names
- Update database connection strings to match your MongoDB setup
- The application uses direct MongoDB queries without Mongoose models
- All API responses include success/error status and appropriate error handling