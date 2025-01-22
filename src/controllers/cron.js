const cron = require('node-cron');
const { botCron } = require('./cron/bot');
const { sendMatchNotification } = require('./cron/match');

// cron.schedule('*/5 * * * *', async () => {
//     await botCron()
// });

// cron.schedule('0 0 * * *', async () => {
//     await sendMatchNotification()
// });
