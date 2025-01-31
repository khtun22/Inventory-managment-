const express = require('express');
const router = express.Router();
const db = require('../models/db');

// POST /addstores
router.post('/addstore', async (req, res) => {
    try {
        const stores = JSON.parse(req.body.stores); // Parse JSON data from stores
        const userid = req.body.userid; // Get userid from the form data

        if (!userid) {
            return res.status(400).send('User ID is missing.');
        }

        if (!stores || stores.length === 0) {
            return res.status(400).send('No stores to save.');
        }

        // Query the database to get existing store names for this user
        const [existingStores] = await db.query('SELECT storename FROM store WHERE userid = ?', [userid]);
        const existingStoreNames = existingStores.map(store => store.storename.toLowerCase());

        // Filter out duplicate stores
        const filteredStores = stores.filter(store => !existingStoreNames.includes(store.storeName.toLowerCase()));

        if (filteredStores.length === 0) {
            // If all stores are duplicates, show a message and render the same page
            return res.render('addstore', { 
                user: req.session.user, 
                userid, 
                successMessage: 'No new stores added.' 
            });
        }

        // Prepare values for bulk insert
        const values = filteredStores.map(store => [store.storeName, userid]);

        // Insert new stores into the database
        const query = 'INSERT INTO store (storename, userid) VALUES ?';
        await db.query(query, [values]);

        // Render addstore.ejs with success message
        res.render('addstore', { 
            user: req.session.user, 
            userid, 
            successMessage: `${filteredStores.length} store(s) successfully added.` 
        });
    } catch (error) {
        console.error('Error saving stores:', error);
        res.status(500).send('Error saving stores.');
    }
});

router.get('/addstore', (req, res) => {
    res.render('addstore', { 
        user: req.session.user, 
        userid: req.session.user.userid // Ensure the correct field
    });
});

router.post('/in', async (req, res) => {
    const userid = req.session.user.userid; 
    console.log(userid);
    try {
        const { transactionId, tranName, tranDate, totalQty, items } = req.body;
        

        if (!transactionId || !userid ||!tranDate || !totalQty || !items || items.length === 0) {
            return res.status(400).send('Missing required fields or no items to save.');
        }

        // Start a transaction
        await db.query('START TRANSACTION');

        // Insert data into the transaction table
        const transactionQuery = `
            INSERT INTO transaction (transactionid, tranname, trandate, trantotalqty, userid)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.query(transactionQuery, [transactionId, tranName, tranDate, totalQty, userid]);

        // Insert data into the item and transaction_detail tables
        const itemInsertQuery = `
            INSERT INTO item (itemid, itemname, itemqty, alertqty, alertcon, expdate, alertdate, categoryid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const transactionDetailInsertQuery = `
            INSERT INTO transaction_detail (transactionid, itemid, tranqty)
            VALUES (?, ?, ?)
        `;

        for (const item of items) {
            const {
                itemId,
                itemName,
                itemQty,
                alertQty,
                alertCondition,
                expDate,
                alertDate,
                categoryId,
            } = item;
            const expDateValue = expDate || null;
            // Insert into item table
            await db.query(itemInsertQuery, [
                itemId,
                itemName,
                itemQty,
                alertQty,
                alertCondition,
                expDateValue,
                alertDate,
                categoryId,
            ]);

            // Insert into transaction_detail table
            await db.query(transactionDetailInsertQuery, [transactionId, itemId, itemQty]);
        }

        // Commit the transaction
        await db.query('COMMIT');
        res.status(200).send('Transaction and items saved successfully.');
    } catch (error) {
        console.error('Error saving transaction:', error);
        await db.query('ROLLBACK');
        res.status(500).send('Error saving transaction.');
    }
});


router.get('/in', async (req, res) => {
    
    try {
        const userid = req.session.user.userid; 
        const [rows] = await db.query('SELECT storeid, storename FROM store WHERE userid = ?', [req.session.user.userid]);
        const [transaction] = await db.query(
            `SELECT MAX(transactionid) AS maxTransactionId FROM transaction WHERE userid = ?`,
            [userid]
        );
        const nextTransactionId = transaction[0].maxTransactionId ? transaction[0].maxTransactionId + 1 : 1;
        const [items] = await db.query('SELECT MAX(itemid) AS maxItemId FROM item');
        const maxItemId = items[0].maxItemId || 0; // If no item exists, set maxItemId to 0

        res.render('in', { 
            user: req.session.user, 
            stores: rows, // Pass the stores to the page
            nextTransactionId, 
            maxItemId,
            userid: req.session.user.userid 
        });
    } catch (error) {
        console.error('Error fetching stores or transaction ID:', error);
        res.render('in', { 
            user: req.session.user, 
            stores: [], 
            nextTransactionId: 1, 
            maxItemId: 0,
            userid: req.session.user.userid 
        });
    }
});

router.get('/addcategory', async (req, res) => {
    try {
        const [stores] = await db.query('SELECT storeid, storename FROM store WHERE userid = ?', [req.session.user.userid]);
        res.render('addcategory', { user: req.session.user, userid: req.session.user.userid, stores });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.render('addcategory', { user: req.session.user, userid: req.session.user.userid, stores: [] });
    }
});

router.get('/categorys/:storeId', async (req, res) => {
    try {
        const storeId = req.params.storeId;
        const [categorys] = await db.query('SELECT categoryid, categoryname FROM category WHERE storeid = ?', [storeId]);
        res.json(categorys); // Send categorys as JSON response
    } catch (error) {
        console.error('Error fetching categorys:', error);
        res.status(500).send('Error fetching categorys.');
    }
});

router.post('/addcategory', async (req, res) => {
    try {
        const categorys = JSON.parse(req.body.categorys); // Parse JSON data from the hidden input
        const userid = req.body.userid; // Get the user ID from the form

        if (!userid) {
            return res.status(400).send('User ID is missing.');
        }

        if (!categorys || categorys.length === 0) {
            return res.status(400).send('No categorys to save.');
        }

        // Fetch existing store and category pairs for this user
        const [existingcategorys] = await db.query(`
            SELECT l.categoryname, l.storeid 
            FROM category l
            JOIN store s ON l.storeid = s.storeid
            WHERE s.userid = ?
        `, [userid]);

        const existingcategoryPairs = existingcategorys.map(category => ({
            storeId: category.storeid,
            categoryName: category.categoryname.toLowerCase()
        }));

        // Filter out duplicate store and category pairs
        const filteredcategorys = categorys.filter(category => 
            !existingcategoryPairs.some(existing => 
                existing.storeId === parseInt(category.storeId) && 
                existing.categoryName === category.categoryName.toLowerCase()
            )
        );

        if (filteredcategorys.length === 0) {
            // If all categorys are duplicates, render a message and stay on the same page
            return res.render('addcategory', { 
                user: req.session.user, 
                userid: req.session.user.userid, 
                stores: [], 
                successMessage: 'No new categorys added. All categorys already exist in the database.' 
            });
        }

        // Prepare data for bulk insertion
        const values = filteredcategorys.map(category => [category.categoryName, category.storeId]);

        // Insert data into the database
        const query = 'INSERT INTO category (categoryname, storeid) VALUES ?';
        await db.query(query, [values]);

        // Render addcategory.ejs with success message
        res.render('addcategory', { 
            user: req.session.user, 
            userid: req.session.user.userid, 
            stores: [], 
            successMessage: `${filteredcategorys.length} category(s) successfully added.` 
        });
    } catch (error) {
        console.error('Error saving categorys:', error);
        res.status(500).send('Error saving categorys.');
    }
});

module.exports = router; 