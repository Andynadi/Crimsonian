const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const db = new sqlite3.Database('availability.db');

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com', // Namecheap's SMTP server
    port: 465, // Use port 465 for STARTTLS
    secure: true, // Use STARTTLS
    auth: {
    user: 'hello@crimsonmeet.com', // Your email
    pass: 'A1n2d3r4i5' // Your generated app password
    }
    });
    
// Helper function to send email
function sendEmail(emails, date, time, locations) {
    if (!emails || emails.length === 0) {
        console.error('No recipients defined. Skipping email.');
        return;
    }

    const mailOptions = {
        from: 'hello@crimsonmeet.com',
        to: emails.join(', '), // Join emails array into a comma-separated string
        subject: 'You’ve been matched for a meetup!',
        text: `Hi there! You've been matched for a meetup on ${date} from ${time}, location: ${locations}.
        Please connect via email to finalize your plans.`
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
        } else {
            console.log('Email sent successfully:', info.response);
        }
    });
}

// Match users
function matchUsers() {
    console.log('System Time (UTC):', new Date().toISOString());

    // Remove `created_at` filter for testing
    const query = `
        SELECT * FROM availability
        ORDER BY date, start_time, locations
    `;

    console.log('Executing Query:', query);

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return;
        }

        console.log('Rows fetched from availability:', rows);

        if (rows.length === 0) {
            console.log('No rows found. Exiting matching process.');
            return;
        }

        const availabilitiesByUser = {};
        rows.forEach(row => {
            if (!availabilitiesByUser[row.email]) {
                availabilitiesByUser[row.email] = [];
            }
            availabilitiesByUser[row.email].push(row);
        });

        const groupedMatches = [];
        const usedEmails = new Set();

        // Helper function to calculate overlap duration (in hours)
        function calculateOverlap(start1, end1, start2, end2) {
            const overlapStart = Math.max(new Date(`1970-01-01T${start1}Z`), new Date(`1970-01-01T${start2}Z`));
            const overlapEnd = Math.min(new Date(`1970-01-01T${end1}Z`), new Date(`1970-01-01T${end2}Z`));
            const overlapDuration = (overlapEnd - overlapStart) / (1000 * 60 * 60);
            return Math.max(0, overlapDuration); // Return 0 if no overlap
        }

        // Try to form groups of 3 or 4
        Object.values(availabilitiesByUser).forEach(userAvailabilities => {
            if (usedEmails.has(userAvailabilities[0].email)) return;

            const bestSlot = userAvailabilities.find(slot => {
                const potentialMatches = rows.filter(other => {
                    return (
                        other.email !== slot.email &&
                        !usedEmails.has(other.email) &&
                        other.date === slot.date &&
                        calculateOverlap(slot.start_time, slot.end_time, other.start_time, other.end_time) >= 1 &&
                        (
                            other.locations === slot.locations ||
                            slot.locations === 'Ok with both' ||
                            other.locations === 'Ok with both'
                        )
                    );
                });

                return potentialMatches.length >= 2;
            });

            if (!bestSlot) return;

            const potentialMatches = rows.filter(other => {
                return (
                    other.email !== bestSlot.email &&
                    !usedEmails.has(other.email) &&
                    other.date === bestSlot.date &&
                    calculateOverlap(bestSlot.start_time, bestSlot.end_time, other.start_time, other.end_time) >= 1 &&
                    (
                        other.locations === bestSlot.locations ||
                        bestSlot.locations === 'Ok with both' ||
                        other.locations === 'Ok with both'
                    )
                );
            });

            if (potentialMatches.length >= 2) {
                const group = [bestSlot, ...potentialMatches.slice(0, 3)];
                const groupId = Date.now();
                groupedMatches.push({ groupId, group });

                group.forEach(member => usedEmails.add(member.email));
            }
        });

        groupedMatches.forEach(({ groupId, group }) => {
            console.log(`Group ID: ${groupId}, Matched Users: ${group.map(g => g.email).join(', ')}`);
            group.forEach(member => {
                db.run(`
                    INSERT INTO matches (group_id, email, date, start_time, end_time, locations)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [groupId, member.email, member.date, member.start_time, member.end_time, member.locations]);

                const emails = group.map(g => g.email);
                sendEmail(emails, group[0].date, `${group[0].start_time} - ${group[0].end_time}`, group[0].locations);
            });
        });

        console.log('Matching process completed.');
    });
}

// Run the matching script
matchUsers();
