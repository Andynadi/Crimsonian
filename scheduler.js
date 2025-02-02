const schedule = require('node-schedule');
const { exec } = require('child_process');

// Schedule the matching script to run every 4 hours
schedule.scheduleJob('0 */4 * * *', () => {
    console.log('Running matching script...');
    exec('node matchAndEmail.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running script: ${error.message}`);
            return;
        }
        console.log(stdout);
        if (stderr) console.error(`stderr: ${stderr}`);
    });
});

console.log('Scheduler is running... Waiting for the next cycle.');
