const express = require('express');
const router = express.Router();
const db = require('../models/db'); // Import the db module

router.get('/editHistory', (req, res) => {
    res.render('editHistory', { 
        user: req.session.user, 
        userid: req.session.user.userid // Ensure the correct field
    });
});

router.post('/editHistory/getTransactions', async (req, res) => {
    const { filter, startDate, endDate } = req.body;
    const userId = req.session.user.userid;
    try {
        // Base query
        let query = `
            SELECT 
                DISTINCT t.transactionid, t.tranname, t.trantotalqty, t.trandate, 
                s1.storename AS sourceStore, c1.categoryname AS sourceCategory, 
                s2.storename AS targetStore, c2.categoryname AS targetCategory
            FROM transaction t
            LEFT JOIN transaction_detail td ON t.transactionid = td.transactionid
            LEFT JOIN item i ON td.itemid = i.itemid
            LEFT JOIN category c1 ON t.sourceid = c1.categoryid OR i.categoryid = c1.categoryid
            LEFT JOIN store s1 ON c1.storeid = s1.storeid
            LEFT JOIN category c2 ON t.targetid = c2.categoryid
            LEFT JOIN store s2 ON c2.storeid = s2.storeid
            LEFT JOIN user u ON s1.userid = u.userid
            WHERE u.userid = ?
            
        `;
        const queryParams = [userId];

        // Apply filter
        if (filter !== 'ALL') {
            query += ` AND t.tranname = ?`;
            queryParams.push(filter);
        }

        // Apply date range
        if (startDate) {
            query += ` AND t.trandate >= ?`;
            queryParams.push(startDate);
        }
        if (endDate) {
            query += ` AND t.trandate <= ?`;
            queryParams.push(endDate);
        }
        query += ` ORDER BY t.trandate DESC;`;

        // Execute query
        const [results] = await db.query(query, queryParams);
        
        // Format results for the frontend
        const transactions = results.map(row => {
            const trandate = new Date(row.trandate);
            const formattedDate = `${trandate.getDate().toString().padStart(2, '0')}-${(trandate.getMonth() + 1)
                .toString()
                .padStart(2, '0')}-${trandate.getFullYear()} ${trandate
                .getHours()
                .toString()
                .padStart(2, '0')}:${trandate.getMinutes().toString().padStart(2, '0')}`;
            
            const sourceLocation =
            row.sourceStore && row.sourceCategory
                ? `${row.sourceStore}, ${row.sourceCategory}`
                : "None";
        
            const targetLocation =
                row.targetStore && row.targetCategory
                    ? `${row.targetStore}, ${row.targetCategory}`
                    : "None";        
            return {
                transactionid: row.transactionid,
                tranname: row.tranname,
                trantotalqty: row.trantotalqty,
                trandate: formattedDate, // New format
                sourceLocation,
                targetLocation,
            };
        });

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).send('An error occurred while fetching transactions.');
    }
});
router.post('/editHistorydetail', async (req, res) => {
    const { transactionid } = req.body;

    try {
        // Fetch transaction details
        const [transactionDetails] = await db.query(
            `
            SELECT 
                t.transactionid, t.tranname, t.trantotalqty, t.trandate, 
                s1.storename AS sourceStore, c1.categoryname AS sourceCategory, 
                s2.storename AS targetStore, c2.categoryname AS targetCategory
            FROM transaction t
            LEFT JOIN category c1 ON t.sourceid = c1.categoryid
            LEFT JOIN store s1 ON c1.storeid = s1.storeid
            LEFT JOIN category c2 ON t.targetid = c2.categoryid
            LEFT JOIN store s2 ON c2.storeid = s2.storeid
            WHERE t.transactionid = ?
            `,
            [transactionid]
        );

        if (transactionDetails.length === 0) {
            return res.status(404).send('Transaction not found.');
        }

        // Pass the transaction details and transactionid to the editHistorydetail page
        res.render('editHistorydetail', {
            user: req.session.user,
            transaction: transactionDetails[0],
        });
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).send('An error occurred while fetching transaction details.');
    }
});


module.exports = router;