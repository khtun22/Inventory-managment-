const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /login
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// POST /login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM user WHERE username = ? AND password = ?', [username, password]);
        if (rows.length > 0) {
            req.session.user = rows[0];
            res.redirect('/dashboard');
        } else {
            res.render('login', { title: 'Login', errorMessage: 'Invalid username or password' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { title: 'Login', errorMessage: 'An error occurred. Please try again.' });
    }
});

// GET /register
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// POST /register
router.post('/register', async (req, res) => {
    const { username, password, confirmPassword, email, phoneno } = req.body;

    // Validate username length
    if (username.length < 3) {
        return res.render('register', { title: 'Register', errorMessage: 'Username must be at least 3 characters long' });
    }

    // Validate password length
    if (password.length < 8) {
        return res.render('register', { title: 'Register', errorMessage: 'Password must be at least 8 characters long' });
    }

    // Validate passwords match
    if (password !== confirmPassword) {
        return res.render('register', { title: 'Register', errorMessage: 'Passwords do not match' });
    }

    try {
        // Check if the username or email already exists
        const [existingUser] = await db.query(
            'SELECT * FROM user WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            if (existingUser[0].username === username) {
                return res.render('register', { title: 'Register', errorMessage: 'Username is already taken' });
            }
            if (existingUser[0].email === email) {
                return res.render('register', { title: 'Register', errorMessage: 'Email is already registered' });
            }
        }

        // Insert new user
        await db.query('INSERT INTO user (username, password, email, phoneno) VALUES (?, ?, ?, ?)', [
            username,
            password,
            email,
            phoneno,
        ]);

        // Fetch the newly registered user
        const [newUser] = await db.query('SELECT * FROM user WHERE username = ?', [username]);
        if (newUser.length > 0) {
            req.session.user = newUser[0]; // Set session for the new user
            return res.redirect('/dashboard'); // Redirect to dashboard
        }

        res.render('register', { title: 'Register', errorMessage: 'An error occurred. Please try again.' });
    } catch (err) {
        console.error(err);
        res.render('register', { title: 'Register', errorMessage: 'An error occurred. Please try again.' });
    }
});

// GET /dashboard
router.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('dashboard', { title: 'Dashboard', user: req.session.user });
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out.');
        }
        res.redirect('/login');
    });
});

module.exports = router;
