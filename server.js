const express = require('express');
const path = require('path');
const cors = require('cors');
const nunjucks = require('nunjucks');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('availability.db');

// Database initialization
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Template engine setup
nunjucks.configure('templates', {
    autoescape: true,
    express: app
});
app.set('view engine', 'html');

// Routes
app.get('/', (req, res) => {
    res.render('index.html');
});

app.get('/admin', (req, res) => {
    db.all(`
        SELECT * FROM availability 
        ORDER BY date, start_time
    `, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }
        res.render('admin.html', { submissions: rows });
    });
});

app.post('/api/submit-availability', (req, res) => {
    const { email, slots } = req.body;
    
    if (!email || !slots || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid submission data'
        });
    }

    const stmt = db.prepare(`
        INSERT INTO availability (email, date, start_time, end_time)
        VALUES (?, ?, ?, ?)
    `);

    try {
        db.serialize(() => {
            slots.forEach(slot => {
                stmt.run(email, slot.date, slot.startTime, slot.endTime);
            });
            stmt.finalize();
            
            res.json({
                success: true,
                message: 'Availability submitted successfully'
            });
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            success: false,
            message: 'Error storing availability'
        });
    }
});

// Start server
const PORT = 5500;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});