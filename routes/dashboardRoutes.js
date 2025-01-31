const express = require('express');
const router = express.Router();
const db = require('../models/db'); // Import the db module

// Middleware to protect routes (optional, if user authentication is implemented)
router.use((req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }
    next();
});

router.get('/dashboard', (req, res) => {
    res.render('dashboard', { user: req.session.user, userid: req.session.user.id });
});

// In transaction page





// Add store page


module.exports = router;