require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const db = new sqlite3.Database('availability.db');

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Helper function to send email
async function sendEmail(emails, date, time, locations) {
    const validEmails = emails.filter(email => email.includes('@'));

    if (validEmails.length === 0) {
        console.error('No valid recipients found. Skipping email.');
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: validEmails.join(', '),
        subject: 'You’ve been matched for a meetup!',
        html: `
            <h2>Exciting news! You've been matched for a meetup!</h2>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Time:</strong> ${time}</p>
            <p><strong>Location:</strong> ${locations}</p>
            <p>Please connect via email to finalize your plans.</p>
            <p>Best regards,<br>CrimsonMeet Team</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.response);
    } catch (err) {
        console.error('❌ Error sending email:', err);
    }
}

// Helper function to calculate time overlap in hours
function calculateOverlap(start1, end1, start2, end2) {
    const overlapStart = Math.max(new Date(`1970-01-01T${start1}Z`), new Date(`1970-01-01T${start2}Z`));
    const overlapEnd = Math.min(new Date(`1970-01-01T${end1}Z`), new Date(`1970-01-01T${end2}Z`));
    return Math.max(0, (overlapEnd - overlapStart) / (1000 * 60 * 60));
}

// Function to determine location compatibility
function areLocationsCompatible(loc1, loc2) {
    return loc1 === loc2 || loc1 === 'Ok with both' || loc2 === 'Ok with both';
}

// Match users, prioritizing groups of 4 → 3 → pairs
async function matchUsers() {
    console.log('🚀 Starting matching process:', new Date().toISOString());

    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM availability 
                WHERE matched = 0 AND date >= date('now') 
                ORDER BY date, start_time
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (!rows.length) {
            console.log('ℹ️ No unmatched availability found.');
            return;
        }

        const groupedMatches = [];
        const usedEmails = new Set();
        const matchedOnce = new Set(); // Track users who selected "one" preference

        for (const groupSize of [4, 3, 2]) {
            const availableUsers = rows.filter(user => 
                !usedEmails.has(user.email) && 
                (!matchedOnce.has(user.email) || user.matching_preference === 'all') // Allow "one" preference only once
            );

            for (const anchor of availableUsers) {
                if (usedEmails.has(anchor.email)) continue;

                const potentialMatches = availableUsers.filter(other =>
                    !usedEmails.has(other.email) &&
                    other.email !== anchor.email &&
                    other.date === anchor.date &&
                    calculateOverlap(anchor.start_time, anchor.end_time, other.start_time, other.end_time) >= 1 &&
                    areLocationsCompatible(anchor.locations, other.locations)
                );

                if (potentialMatches.length >= groupSize - 1) {
                    const selectedMembers = potentialMatches.slice(0, groupSize - 1).concat(anchor);
                    const groupId = Date.now();

                    groupedMatches.push({ groupId, group: selectedMembers });
                    selectedMembers.forEach(member => usedEmails.add(member.email));

                    // If user selected "one", prevent them from further matching
                    selectedMembers.forEach(member => {
                        if (member.matching_preference === "one") {
                            matchedOnce.add(member.email);
                        }
                    });
                }
            }
        }

        if (!groupedMatches.length) {
            console.log('❌ No viable matches found.');
            return;
        }

        // Process and update the database
        for (const { groupId, group } of groupedMatches) {
            console.log(`✅ Group ${groupId} matched:`, group.map(g => g.email).join(', '));

            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    group.forEach(member => {
                        db.run(`
                            INSERT INTO matches (group_id, email, date, start_time, end_time, locations)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [groupId, member.email, member.date, member.start_time, member.end_time, member.locations]);

                        db.run(`UPDATE availability SET matched = 1 WHERE id = ?`, [member.id]);
                    });

                    db.run('COMMIT', err => (err ? reject(err) : resolve()));
                });
            });

            // Send email to matched users
            const emails = group.map(g => g.email);
            await sendEmail(emails, group[0].date, `${group[0].start_time} - ${group[0].end_time}`, group[0].locations);
        }

        console.log(`🎉 Matching process completed. Created ${groupedMatches.length} group(s).`);
    } catch (error) {
        console.error('❌ Error in matching process:', error);
    }
}

matchUsers();
