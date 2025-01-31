const express = require('express');
const router = express.Router();
const db = require('../models/db');


router.get('/items01/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const [items] = await db.query(
            'SELECT itemid, itemname, itemqty FROM item WHERE categoryid = ?',
            [categoryId]
        );
        res.json(items); // Send items as a JSON response
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).send('Error fetching items.');
    }
});


router.get('/adjustment', async (req, res) => {
    const userid = req.session.user.userid;
    try {
        const [rows] = await db.query('SELECT storeid, storename FROM store WHERE userid = ?', [req.session.user.userid]);
        const [adjustment] = await db.query(
            `SELECT MAX(adjustmentid) AS maxAdjustmentId FROM adjustment WHERE userid = ?`,
            [userid]
        );
        const nextAdjustmentId = adjustment[0].maxAdjustmentId ? adjustment[0].maxAdjustmentId + 1 : 1;
        

        res.render('adjustment', { 
            user: req.session.user, 
            stores: rows, // Pass the stores to the page
            nextAdjustmentId, 
            userid: req.session.user.userid 
        });
    } catch (error) {
        console.error('Error fetching stores or transaction ID:', error);
        res.render('adjustment', { 
            user: req.session.user, 
            stores: [], 
            nextAdjustmentId: 1, 
            userid: req.session.user.userid 
        });
    }
});

router.post('/adjustment', async (req, res) => {
    const { nextAdjustmentId, reason, description, adjDate, totalQty, adjustmentItems } = req.body;
    const userid = req.session.user.userid;
    try {
        // Start a transaction
        await db.query('START TRANSACTION');

        // Insert data into the transaction table
        const insertAdjustmentQuery = `
            INSERT INTO adjustment (adjustmentid, reason, adjustdate, description, adjtotalqty, userid) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.query(insertAdjustmentQuery, [nextAdjustmentId, reason, adjDate, description, totalQty, userid]);

        // Insert data into transaction_detail table
        const insertAdjustmentDetailQuery = `
            INSERT INTO adjustment_detail (adjustmentid, itemid, adjustqty) 
            VALUES ?
        `;
        const transactionDetailValues = adjustmentItems.map(item => [
            nextAdjustmentId,
            item.itemId,
            item.adjustmentQty,
        ]);
        await db.query(insertAdjustmentDetailQuery, [transactionDetailValues]);

        // Update item table
        for (const item of adjustmentItems) {
            const updateItemQtyQuery = `
                UPDATE item 
                SET itemqty = ? 
                WHERE itemid = ?
            `;
            await db.query(updateItemQtyQuery, [item.adjustmentQty, item.itemId]);
        }

        // Commit the transaction
        await db.query('COMMIT');

        res.status(200).json({ message: 'Adjustment successfully saved!' });
    } catch (error) {
        console.error('Error processing transaction:', error);

        // Rollback the transaction in case of any error
        await db.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to save transaction.' });
    }
});


module.exports = router;