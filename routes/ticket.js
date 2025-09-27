const express = require('express');
const { getTicketDB } = require('../config/database');
const { ObjectId } = require('mongodb');
const router = express.Router();

// POST endpoint to process ticket data - changes isUsed status for all QR codes with matching ticketId
router.post('/process', async (req, res) => {
    try {
        const { ticketId } = req.body;

        if (!ticketId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Ticket ID is required' 
            });
        }

        const db = getTicketDB();
        const qrCollection = db.collection('qrcodes');

        // Find all QR codes with the given ticketId
        const qrCodes = await qrCollection.find({ ticketId: ticketId }).toArray();

        if (qrCodes.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'No QR codes found for this ticket ID' 
            });
        }

        // Update all QR codes with this ticketId - toggle isUsed status
        const firstQrCode = qrCodes[0];
        const newIsUsedStatus = !firstQrCode.isUsed; // Reverse the current status

        const updateResult = await qrCollection.updateMany(
            { ticketId: ticketId },
            { 
                $set: { 
                    isUsed: newIsUsedStatus,
                    usedAt: new Date()
                }
            }
        );

        res.json({ 
            success: true, 
            message: `QR codes ${newIsUsedStatus ? 'marked as used' : 'marked as unused'}`,
            data: {
                ticketId: ticketId,
                isUsed: newIsUsedStatus,
                updatedCount: updateResult.modifiedCount,
                totalQrCodes: qrCodes.length,
                usedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Ticket processing error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// GET endpoint to retrieve ticket data
router.get('/search/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;

        const db = getTicketDB();
        const ticketsCollection = db.collection('tickets');
        const qrCollection = db.collection('qrcodes');

        // Find ticket record
        let ticketQuery = { ticketId: ticketId };

        
        // If ticketId looks like a valid ObjectId, add _id to query as well
      
        const ticketRecord = await ticketsCollection.findOne(ticketQuery);

        console.log(ticketRecord,"==========================================");
        
        // Find all QR codes for this ticket
        const qrCodes = await qrCollection.find({ ticketId: new ObjectId(ticketRecord._id) }).toArray();

        if (!ticketRecord && qrCodes.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Ticket not found' 
            });
        }

        res.json({ 
            success: true, 
            data: {
                ticket: ticketRecord,
                qrCodes: qrCodes,
                totalQrCodes: qrCodes.length
            }
        });

    } catch (error) {
        console.error('Ticket search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// POST endpoint to update payment status by ticketId and paymentId


// POST endpoint to update payment by ticketId and paymentId
router.post('/payment/update', async (req, res) => {
    try {
        const { ticketId, paymentId } = req.body;

        if (!ticketId || !paymentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Both Ticket ID and Payment ID are required' 
            });
        }

        const db = getTicketDB();
        const ticketsCollection = db.collection('tickets');

        // Update the ticket with the new payment info
        const updateResult = await ticketsCollection.updateOne(
            { ticketId: ticketId },
            { 
                $set: { 
                    paymentId: paymentId,
                    paymentStatus: 'COMPLETED',
                    updatedAt: new Date()
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Ticket not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Payment information updated successfully',
            data: {
                ticketId: ticketId,
                paymentId: paymentId,
                paymentStatus: 'COMPLETED',
                updateCount: updateResult.modifiedCount
            }
        });

    } catch (error) {
        console.error('Payment update error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// GET endpoint to get all QR codes by ticket ID, payment ID, or phone number
router.get('/qrcodes/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const { type } = req.query; // type can be 'ticket', 'payment', or 'phone'

        console.log('Searching for identifier:', identifier, 'Type:', type);

        const db = getTicketDB();
        const ticketsCollection = db.collection('tickets');
        const qrcodesCollection = db.collection('qrcodes');
        const usersCollection = db.collection('users');

        let tickets = [];
        let searchType = type || 'ticket'; // Default to ticket search
        let userInfo = null;

        // Determine search type if not specified
        if (!type) {
            if (identifier.startsWith('TKT')) {
                searchType = 'ticket';
            } else if (identifier.startsWith('PAY') || /^\d+$/.test(identifier)) {
                // Check if it's a payment ID or could be a phone number
                const ticketByPayment = await ticketsCollection.findOne({ paymentId: identifier });
                if (ticketByPayment) {
                    searchType = 'payment';
                } else {
                    searchType = 'phone';
                }
            } else {
                searchType = 'phone';
            }
        }

        console.log('Final search type:', searchType);

        // Calculate today's date range for Asia timezone (UTC+5:30 - India Standard Time)
        const now = new Date();
        const asiaOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds for IST
        const asiaToday = new Date(now.getTime() + asiaOffset);
        
        // Get start and end of today in Asia timezone
        const todayStart = new Date(asiaToday.getFullYear(), asiaToday.getMonth(), asiaToday.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        // Convert back to UTC for MongoDB query
        const utcTodayStart = new Date(todayStart.getTime() - asiaOffset);
        const utcTodayEnd = new Date(todayEnd.getTime() - asiaOffset);

        console.log('QRCodes search - Asia today range:', todayStart, 'to', todayEnd);
        console.log('QRCodes search - UTC range for query:', utcTodayStart, 'to', utcTodayEnd);

        // Search based on type
        switch (searchType) {
            case 'ticket':
                const ticketRecord = await ticketsCollection.findOne({ 
                    ticketId: identifier,
                });
                if (ticketRecord) {
                    tickets = [ticketRecord];
                }
                break;

            case 'payment':
                tickets = await ticketsCollection.find({ 
                    paymentId: identifier,
                 
                }).toArray();
                break;

            case 'phone':
                // First find user by phone number
                userInfo = await usersCollection.findOne({ phone: identifier });
                if (userInfo) {
                    tickets = await ticketsCollection.find({ 
                        userId: new ObjectId(userInfo._id),
                    }).toArray();
                }
                break;
        }

        if (tickets.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No tickets found for ${searchType}: ${identifier}`
            });
        }

        // Get all QR codes for found tickets created today
        const ticketIds = tickets.map(ticket => new ObjectId(ticket._id));
        const allQrCodes = await qrcodesCollection.find({
            ticketId: { $in: ticketIds }
        }).toArray();

        // Organize data hierarchically
        const result = {
            searchType: searchType,
            searchValue: identifier,
            totalTickets: tickets.length,
            totalQRCodes: allQrCodes.length
        };

        if (searchType === 'phone' && userInfo) {
            result.user = {
                phone: userInfo.phone,
                name: userInfo.name || 'N/A',
                email: userInfo.email || 'N/A'
            };
        }

        // Group QR codes by ticket
        result.tickets = tickets.map(ticket => {
            const ticketQrCodes = allQrCodes.filter(qr => 
                qr.ticketId.toString() === ticket._id.toString()
            );

            return {
                ticketId: ticket.ticketId,
                paymentId: ticket.paymentId || 'N/A',
                paymentStatus: ticket.paymentStatus || 'N/A',
                createdAt: ticket.createdAt,
                totalAmount: ticket.totalAmount || 'N/A',
                qrCodesCount: ticketQrCodes.length,
                qrCodes: ticketQrCodes.map(qr => ({
                    qrCode: qr.qrCode,
                    qrImageUrl: qr.qrImageUrl || null,
                    isUsed: qr.isUsed,
                    validDate: qr.validDate,
                    createdAt: qr.createdAt,
                    usedAt: qr.usedAt || null,
                    scannedBy: qr.scannedBy || null,
                    scannedByAdmin: qr.scannedByAdmin || null
                }))
            };
        });

        res.json({
            success: true,
            message: `Found ${tickets.length} ticket(s) and ${allQrCodes.length} QR code(s) for ${searchType}: ${identifier}`,
            data: result
        });

    } catch (error) {
        console.error('QR codes search error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// GET endpoint to search all tickets and QR codes by payment ID
router.get('/payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;

        const db = getTicketDB();
        const ticketsCollection = db.collection('tickets');
        const qrcodesCollection = db.collection('qrcodes');

        // Calculate today's date range for Asia timezone (UTC+5:30 - India Standard Time)
        const now = new Date();
        const asiaOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds for IST
        const asiaToday = new Date(now.getTime() + asiaOffset);
        
        // Get start and end of today in Asia timezone
        const todayStart = new Date(asiaToday.getFullYear(), asiaToday.getMonth(), asiaToday.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        // Convert back to UTC for MongoDB query
        const utcTodayStart = new Date(todayStart.getTime() - asiaOffset);
        const utcTodayEnd = new Date(todayEnd.getTime() - asiaOffset);

        console.log('Payment search - Asia today range:', todayStart, 'to', todayEnd);
        console.log('Payment search - UTC range for query:', utcTodayStart, 'to', utcTodayEnd);

        // Find all tickets with this payment ID created today
        const tickets = await ticketsCollection.find({ 
            paymentId: paymentId,
        }).toArray();

        if (tickets.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'No tickets found with this payment ID' 
            });
        }

        // Get all QR codes for these tickets
        const ticketIds = tickets.map(ticket => new ObjectId(ticket._id));

        console.log(ticketIds,"=================ticketIds==================");
        const allQrCodes = await qrcodesCollection.find({
            ticketId: { $in: ticketIds },
        }).toArray();

        // Organize data by payment -> tickets -> QR codes
        const result = {
            paymentId: paymentId,
            totalTickets: tickets.length,
            totalQRCodes: allQrCodes.length,
            tickets: tickets.map(ticket => {
                const ticketQrCodes = allQrCodes.filter(qr => 
                    qr.ticketId.toString() === ticket._id.toString()
                );

                return {
                    ticketId: ticket.ticketId,
                    paymentStatus: ticket.paymentStatus || 'N/A',
                    createdAt: ticket.createdAt,
                    totalAmount: ticket.totalAmount || 'N/A',
                    qrCodesCount: ticketQrCodes.length,
                    qrCodes: ticketQrCodes.map(qr => ({
                        qrCode: qr.qrCode,
                        qrImageUrl: qr.qrImageUrl || null,
                        isUsed: qr.isUsed,
                        validDate: qr.validDate,
                        createdAt: qr.createdAt,
                        usedAt: qr.usedAt || null,
                        scannedBy: qr.scannedBy || null,
                        scannedByAdmin: qr.scannedByAdmin || null
                    }))
                };
            })
        };

        res.json({ 
            success: true, 
            message: `Found ${tickets.length} ticket(s) and ${allQrCodes.length} QR code(s) for payment ID: ${paymentId}`,
            data: result
        });

    } catch (error) {
        console.error('Payment search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// GET endpoint to search all tickets and QR codes by user phone number
router.get('/phone/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        const db = getTicketDB();
        const usersCollection = db.collection('users');
        const ticketsCollection = db.collection('tickets');
        const qrcodesCollection = db.collection('qrcodes');

        // Find user by phone number
        const user = await usersCollection.findOne({ phone: phoneNumber });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'No user found with this phone number' 
            });
        }

        // Calculate today's date range for Asia timezone (UTC+5:30 - India Standard Time)
        const now = new Date();
        const asiaOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds for IST
        const asiaToday = new Date(now.getTime() + asiaOffset);
        
        // Get start and end of today in Asia timezone
        const todayStart = new Date(asiaToday.getFullYear(), asiaToday.getMonth(), asiaToday.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        // Convert back to UTC for MongoDB query
        const utcTodayStart = new Date(todayStart.getTime() - asiaOffset);
        const utcTodayEnd = new Date(todayEnd.getTime() - asiaOffset);

        console.log('Asia today range:', todayStart, 'to', todayEnd);
        console.log('UTC range for query:', utcTodayStart, 'to', utcTodayEnd);

        // Find all tickets for this user created today
        const tickets = await ticketsCollection.find({ 
            userId: new ObjectId(user._id),
        }).toArray();

        if (tickets.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'No tickets found for this user' 
            });
        }

        // Get all QR codes for these tickets created today
        const ticketIds = tickets.map(ticket => new ObjectId(ticket._id));
        const allQrCodes = await qrcodesCollection.find({
            ticketId: { $in: ticketIds },
        }).toArray();

        // Organize data by phone -> tickets -> QR codes
        const result = {
            user: {
                phone: user.phone,
                name: user.name || 'N/A',
                email: user.email || 'N/A',
                userId: user._id
            },
            totalTickets: tickets.length,
            totalQRCodes: allQrCodes.length,
            tickets: tickets.map(ticket => {
                const ticketQrCodes = allQrCodes.filter(qr => 
                    qr.ticketId.toString() === ticket._id.toString()
                );

                return {
                    ticketId: ticket.ticketId,
                    paymentId: ticket.paymentId || 'N/A',
                    paymentStatus: ticket.paymentStatus || 'N/A',
                    createdAt: ticket.createdAt,
                    totalAmount: ticket.totalAmount || 'N/A',
                    qrCodesCount: ticketQrCodes.length,
                    qrCodes: ticketQrCodes.map(qr => ({
                        qrCode: qr.qrCode,
                        qrImageUrl: qr.qrImageUrl || null,
                        isUsed: qr.isUsed,
                        validDate: qr.validDate,
                        createdAt: qr.createdAt,
                        usedAt: qr.usedAt || null,
                        scannedBy: qr.scannedBy || null,
                        scannedByAdmin: qr.scannedByAdmin || null
                    }))
                };
            })
        };

        res.json({ 
            success: true, 
            message: `Found ${tickets.length} ticket(s) and ${allQrCodes.length} QR code(s) for phone: ${phoneNumber}`,
            data: result
        });

    } catch (error) {
        console.error('Phone search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});





// GET endpoint to search by last 5 digits of ticket ID or payment ID (today's QR codes only)
router.get('/search-digits/:digits', async (req, res) => {
    try {
        const { digits } = req.params;
        const { ticketTypes } = req.query;

        // Parse ticket types from query parameter
        let allowedTicketTypes = ['FAMILY', 'ONE_DAY']; // Default to both
        if (ticketTypes) {
            allowedTicketTypes = ticketTypes.split(',').map(type => type.trim());
        }

        console.log('Allowed ticket types:', allowedTicketTypes);

        const db = getTicketDB();
        const ticketsCollection = db.collection('tickets');
        const qrcodesCollection = db.collection('qrcodes');

        // Calculate today's date range for Asia timezone (UTC+5:30 - India Standard Time)
        const now = new Date();

        
        // Get start and end of today in Asia timezone
       
        const ticketRegex = new RegExp(digits + '$');
        console.log("ticketRegex",ticketRegex)
        const initialTickets = await ticketsCollection.find({
            $and: [
            {
                $or: [
                { ticketId: ticketRegex },
                { paymentId: ticketRegex }
                ]
            },
            { paymentStatus: { $ne: 'PENDING' } },
            { 
                ticketType: { 
                    $in: allowedTicketTypes 
                } 
            }
            ]
        }).toArray();

        if (initialTickets.length === 0) {
            return res.status(400).json({
                success: false,
                error: `No tickets found ending with digits: ${digits}`
            });
        }

        console.log(initialTickets,"=================initialTickets==================");

        // Get all unique payment IDs from the initial search results
        const paymentIds = [...new Set(initialTickets
            .map(ticket => ticket.paymentId)
            .filter(paymentId => paymentId && paymentId !== 'N/A')
        )];

        console.log(paymentIds,"=================paymentIds==================");

        // Fetch ALL tickets that have these payment IDs and match ticket type filter
        const allTicketsWithSamePayments = await ticketsCollection.find({
            $and: [
                { paymentId: { $in: paymentIds } },
                { ticketType: { $in: allowedTicketTypes } }
            ]
        }).toArray();

        // Combine with initial tickets and remove duplicates
        const allTicketIds = new Set();
        const tickets = [];

        // Add initial tickets
        initialTickets.forEach(ticket => {
            if (!allTicketIds.has(ticket._id.toString())) {
                allTicketIds.add(ticket._id.toString());
                tickets.push(ticket);
            }
        });

        // Add tickets with same payment IDs
        allTicketsWithSamePayments.forEach(ticket => {
            if (!allTicketIds.has(ticket._id.toString())) {
                allTicketIds.add(ticket._id.toString());
                tickets.push(ticket);
            }
        });

        console.log(tickets,"=================finalTickets==================");

        // Get all QR codes for these tickets
        const ticketIds = tickets.map(ticket => new ObjectId(ticket._id));

        console.log(ticketIds,"=================ticketIds==================");
        // Calculate today's start and end time in UTC
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        console.log('Today UTC range:', todayStart, 'to', todayEnd);

        const allQrCodes = await qrcodesCollection.find({
            ticketId: { $in: ticketIds },
            createdAt: {
            $gte: todayStart,
            $lte: todayEnd
            }
        }).sort({ createdAt: -1 }).toArray(); // Latest first

        // Organize data by tickets -> QR codes
        const result = {
            searchDigits: digits,
            searchDate: todayStart.toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
            totalTickets: tickets.length,
            totalQRCodes: allQrCodes.length,
            tickets: tickets.map(ticket => {
                const ticketQrCodes = allQrCodes.filter(qr => 
                    qr.ticketId.toString() === ticket._id.toString()
                );

                return {
                    _id: ticket._id.toString(),
                    ticketId: ticket.ticketId,
                    paymentId: ticket.paymentId || 'N/A',
                    paymentStatus: ticket.paymentStatus || 'N/A',
                    createdAt: ticket.createdAt,
                    totalAmount: ticket.totalAmount || 'N/A',
                    ticketType: ticket.ticketType || 'N/A',
                    qrCodesCount: ticketQrCodes.length,
                    qrCodes: ticketQrCodes.map(qr => ({
                        _id: qr._id.toString(),
                        qrCode: qr.qrCode,
                        qrImageUrl: qr.qrImageUrl || null,
                        isUsed: qr.isUsed,
                        validDate: qr.validDate,
                        createdAt: qr.createdAt,
                        usedAt: qr.usedAt || null,
                        scannedBy: qr.scannedBy || null,
                        scannedByAdmin: qr.scannedByAdmin || null
                    }))
                };
            })
        };

        res.json({
            success: true,
            message: `Found ${tickets.length} ticket(s) and ${allQrCodes.length} QR code(s) ending with digits: ${digits}`,
            data: result
        });

    } catch (error) {
        console.error('Search digits error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// POST endpoint to update QR code is_used status (individual or bulk)
router.post('/update-qr-status', async (req, res) => {
    try {
        const { qrIds, isUsed } = req.body;

        if (!qrIds || !Array.isArray(qrIds) || qrIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'QR IDs array is required'
            });
        }

        if (typeof isUsed !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isUsed must be a boolean value'
            });
        }

        const db = getTicketDB();
        const qrcodesCollection = db.collection('qrcodes');

        // Convert string IDs to ObjectIds with validation
        const objectIds = [];
        const invalidIds = [];
        
        for (const id of qrIds) {
            try {
                if (ObjectId.isValid(id)) {
                    objectIds.push(new ObjectId(id));
                } else {
                    invalidIds.push(id);
                }
            } catch (error) {
                invalidIds.push(id);
            }
        }

        if (invalidIds.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid ObjectId(s): ${invalidIds.join(', ')}`
            });
        }

        // Update the QR codes
        const updateData = {
            isUsed: isUsed,
            usedAt: isUsed ? new Date() : null
        };

        const updateResult = await qrcodesCollection.updateMany(
            { _id: { $in: objectIds } },
            { $set: updateData }
        );

        res.json({
            success: true,
            message: `${updateResult.modifiedCount} QR code(s) ${isUsed ? 'marked as used' : 'marked as unused'}`,
            data: {
                modifiedCount: updateResult.modifiedCount,
                requestedCount: qrIds.length,
                isUsed: isUsed,
                updatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('QR status update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;