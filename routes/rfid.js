const express = require('express');
const { getRFIDDB } = require('../config/database');
const router = express.Router();

// POST endpoint to process RFID data
router.post('/process', async (req, res) => {
    try {
        const { card_no } = req.body;

        if (!card_no) {
            return res.status(400).json({ 
                success: false, 
                error: 'Card number is required' 
            });
        }

        const db = getRFIDDB();
        const collection = db.collection('rfid_tags');

        const rfidRecord = await collection.findOne({ card_no: card_no });

        if (!rfidRecord) {
            return res.status(404).json({ 
                success: false, 
                error: 'RFID card not found' 
            });
        }

        // Reverse the is_scan status
        const newIsScanStatus = !rfidRecord.is_scan;
        const currentTime = new Date();

        // Update the record with reversed status
        const updateResult = await collection.updateOne(
            { card_no: card_no },
            { 
                $set: { 
                    is_scan: newIsScanStatus,
                    time: currentTime,
                    date_modified: currentTime
                }
            }
        );

        res.json({ 
            success: true, 
            message: 'RFID status reversed successfully',
            data: {
                card_no: rfidRecord.card_no,
                rfid: rfidRecord.rfid,
                is_scan: newIsScanStatus,
                time: currentTime,
                date_modified: currentTime,
                updateCount: updateResult.modifiedCount
            }
        });

    } catch (error) {
        console.error('RFID processing error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// GET endpoint to retrieve RFID data
router.get('/search/:card_no', async (req, res) => {
    try {
        const { card_no } = req.params;

        const db = getRFIDDB();
        const collection = db.collection('rfid_tags');

        console.log('Searching for card_no:', card_no, 'Type:', typeof card_no);
        console.log('Query object:', {card_no: card_no});

        const rfidRecord = await collection.findOne(
            {card_no: card_no}
        );

        console.log('RFID search result:', rfidRecord);

        if (!rfidRecord) {
            return res.status(404).json({ 
                success: false, 
                error: 'RFID card not found' 
            });
        }


          if(rfidRecord.is_scan){
            return res.status(400).json({
                success: false,
                error: 'Card is already scanned',
                data:rfidRecord
            });
        }


              const currentTime = new Date();


            await collection.updateOne(
            { card_no: card_no },
            { 
                $set: { 
                    is_scan: true,
                    time: currentTime,
                    date_modified: currentTime
                }
            }
        );
        res.json({ 
            success: true, 
            data: {
                card_no: rfidRecord.card_no,
                rfid: rfidRecord.rfid,
                is_scan: true,
                time: currentTime,
                date_modified: currentTime
            }
        });

    } catch (error) {
        console.error('RFID search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// POST endpoint to create new RFID record
router.post('/create', async (req, res) => {
    try {
        const { card_no, rfid } = req.body;

        if (!card_no) {
            return res.status(400).json({ 
                success: false, 
                error: 'Card number is required' 
            });
        }

        const db = getRFIDDB();
        const collection = db.collection('rfid_tags');

        const currentTime = new Date();
        const newRfid = {
            card_no,
            rfid: rfid || card_no,
            is_scan: false,
            time: currentTime,
            date_modified: currentTime,
            date_added: currentTime
        };

        const result = await collection.insertOne(newRfid);

        res.json({ 
            success: true, 
            message: 'RFID card created successfully',
            data: {
                insertedId: result.insertedId,
                ...newRfid
            }
        });

    } catch (error) {
        console.error('RFID creation error:', error);
        if (error.code === 11000) {
            res.status(400).json({ 
                success: false, 
                error: 'Card number already exists' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Internal server error' 
            });
        }
    }
});

module.exports = router;