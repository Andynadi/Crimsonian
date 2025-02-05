const express = require('express');
const path = require('path');
const cors = require('cors');
const nunjucks = require('nunjucks');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('availability.db');

// Database Initialization
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        date TEXT NOT NULL CHECK (date >= date('now')),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        locations TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        matched INTEGER DEFAULT 0,
        matching_preference TEXT DEFAULT 'all'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS matches (
        group_id TEXT NOT NULL,
        email TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        locations TEXT NOT NULL
    )`);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Template Engine
nunjucks.configure('templates', {
    autoescape: true,
    express: app
});
app.set('view engine', 'html');

// Routes
app.get('/', (req, res) => res.render('index.html'));

app.get('/admin', (req, res) => {
    db.all(`SELECT * FROM availability ORDER BY date, start_time`, [], (err, rows) => {
        if (err) return res.status(500).send('Database error');
        res.render('admin.html', { submissions: rows });
    });
});

// API: Submit Availability (Prevents Duplicates)
app.post('/api/submit-availability', (req, res) => {
    const { email, slots, matchingPreference = 'all' } = req.body;

    if (!email || !slots || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid submission data' });
    }

    if (!['all', 'one'].includes(matchingPreference)) {
        return res.status(400).json({ success: false, message: 'Invalid matching preference' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION', err => {
            if (err) return res.status(500).json({ error: "Database error: Unable to start transaction." });

            let duplicateFound = false;

            slots.forEach(slot => {
                const { date, startTime, endTime, locations } = slot;

                db.get(`
                    SELECT id FROM availability WHERE email = ? AND date = ? AND start_time = ? AND end_time = ? AND locations = ?
                `, [email, date, startTime, endTime, locations], (err, row) => {
                    if (err) return res.status(500).json({ error: "Database error." });

                    if (row) {
                        duplicateFound = true;
                    } else {
                        db.run(`
                            INSERT INTO availability (email, date, start_time, end_time, locations, matched, matching_preference)
                            VALUES (?, ?, ?, ?, ?, 0, ?)
                        `, [email, date, startTime, endTime, locations, matchingPreference]);
                    }
                });
            });

            db.run('COMMIT', () => {
                if (duplicateFound) {
                    return res.status(400).json({ error: "Some slots were already submitted." });
                } else {
                    return res.json({ success: true, message: "Availability submitted successfully!" });
                }
            });
        });
    });
});

// API: Delete Availability Entry
app.delete('/api/delete-entry/:id', (req, res) => {
    db.run(`DELETE FROM availability WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Failed to delete entry' });
        res.json({ success: true, message: 'Entry deleted successfully' });
    });
});

// Start Server
const PORT = 5500;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
