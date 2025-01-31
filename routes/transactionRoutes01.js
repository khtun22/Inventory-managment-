const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.post('/out', async (req, res) => {
    const { nextTransactionId, tranName, tranDate, totalQty, outgoingItems } = req.body;
    const userid = req.session.user.userid; 
    try {
        // Start a transaction
        await db.query('START TRANSACTION');

        // Insert data into the transaction table
        const insertTransactionQuery = `
            INSERT INTO transaction (transactionid, tranname, trantotalqty, trandate, userid) 
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.query(insertTransactionQuery, [nextTransactionId, tranName, totalQty, tranDate, userid]);

        // Insert data into transaction_detail table
        const insertTransactionDetailQuery = `
            INSERT INTO transaction_detail (transactionid, itemid, tranqty) 
            VALUES ?
        `;
        const transactionDetailValues = outgoingItems.map(item => [
            nextTransactionId,
            item.itemId,
            item.outgoingQty,
        ]);
        await db.query(insertTransactionDetailQuery, [transactionDetailValues]);

        // Update item table
        for (const item of outgoingItems) {
            const updateItemQtyQuery = `
                UPDATE item 
                SET itemqty = ? 
                WHERE itemid = ?
            `;
            await db.query(updateItemQtyQuery, [item.remainingQty, item.itemId]);
        }

        // Commit the transaction
        await db.query('COMMIT');

        res.status(200).json({ message: 'Transaction successfully saved!' });
    } catch (error) {
        console.error('Error processing transaction:', error);

        // Rollback the transaction in case of any error
        await db.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to save transaction.' });
    }
});

router.get('/items/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const [items] = await db.query(
            'SELECT itemid, itemname, itemqty FROM item WHERE categoryid = ? AND itemqty > 0',
            [categoryId]
        );
        res.json(items); // Send items as a JSON response
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).send('Error fetching items.');
    }
});


router.get('/out', async (req, res) => {
    const userid = req.session.user.userid; 
    try {
        const [rows] = await db.query('SELECT storeid, storename FROM store WHERE userid = ?', [req.session.user.userid]);
        const [transaction] = await db.query(
            `SELECT MAX(transactionid) AS maxTransactionId FROM transaction WHERE userid = ?`,
            [userid]
        );
        const nextTransactionId = transaction[0].maxTransactionId ? transaction[0].maxTransactionId + 1 : 1;
       

        res.render('out', { 
            user: req.session.user, 
            stores: rows, // Pass the stores to the page
            nextTransactionId, 
            userid: req.session.user.userid 
        });
    } catch (error) {
        console.error('Error fetching stores or transaction ID:', error);
        res.render('out', { 
            user: req.session.user, 
            stores: [], 
            nextTransactionId: 1, 
            userid: req.session.user.userid 
        });
    }
});

router.get('/transfer', async (req, res) => {
    const userid = req.session.user.userid; 
    try {
        const [rows] = await db.query('SELECT storeid, storename FROM store WHERE userid = ?', [req.session.user.userid]);
        const [transaction] = await db.query(
            `SELECT MAX(transactionid) AS maxTransactionId FROM transaction WHERE userid = ?`,
            [userid]
        );
        const nextTransactionId = transaction[0].maxTransactionId ? transaction[0].maxTransactionId + 1 : 1;
       
        res.render('transfer', { 
            user: req.session.user, 
            stores: rows, // Pass the stores to the page
            nextTransactionId, 
            userid: req.session.user.userid 
        });
    } catch (error) {
        console.error('Error fetching stores or transaction ID:', error);
        res.render('transfer', { 
            user: req.session.user, 
            stores: [], 
            nextTransactionId: 1, 
            userid: req.session.user.userid 
        });
    }
});

router.post('/transfer', async (req, res) => {
    const { transactionId, tranName, totalQty, tranDate, sourceCategoryId, targetCategoryId, items } = req.body;
    const userid = req.session.user.userid; 
    try {
        
        // Insert into `transaction` table
        await db.query(
            `INSERT INTO transaction (transactionid, tranname, trantotalqty, trandate, sourceid, targetid, userid)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, tranName, totalQty, tranDate, sourceCategoryId, targetCategoryId, userid]
        );

        // Insert into `transaction_detail` and update `item` table
        for (const item of items) {
            const { itemId, transferQty, remainingQty } = item;

            // Insert into `transaction_detail` table
            await db.query(
                `INSERT INTO transaction_detail (transactionid, itemid, tranqty)
                 VALUES (?, ?, ?)`,
                [transactionId, itemId, transferQty]
            );

            // Update `item` table (update itemqty for the source category)
            await db.query(
                `UPDATE item
                 SET itemqty = ?
                 WHERE itemid = ?`,
                [remainingQty, itemId]
            );

            // Insert new data for the target category
            const [existingItem] = await db.query(
                `SELECT itemid FROM item WHERE itemname = ? AND categoryid = ?`,
                [item.itemName, targetCategoryId]
            );

            if (existingItem.length > 0) {
                // If the item already exists in the target category, update its quantity
                await db.query(
                    `UPDATE item
                     SET itemqty = itemqty + ?
                     WHERE itemid = ?`,
                    [transferQty, existingItem[0].itemid]
                );
            } else {
                // If the item doesn't exist, insert a new row
                
                
                // Fetch the current max itemid from the database
                const [maxItemIdResult] = await db.query(`SELECT MAX(itemid) AS maxItemId FROM item`);
                const maxItemId = maxItemIdResult[0].maxItemId || 0; // If no item exists, default to 0
                const newItemId = maxItemId + 1;
            
                // Insert the new item into the database with the calculated itemid
                await db.query(
                    `INSERT INTO item (itemid, itemname, itemqty, categoryid)
                        VALUES (?, ?, ?, ?)`,
                    [newItemId, item.itemName, transferQty, targetCategoryId]
                );
                
            }
        }

        res.status(200).send('Transaction saved successfully.');
    } catch (error) {
        console.error('Error processing transfer:', error);
        res.status(500).send('An error occurred while processing the transfer.');
    }
});



module.exports = router;