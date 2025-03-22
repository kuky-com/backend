const cron = require('node-cron');
const { botCron } = require('./cron/bot');
const { sendMatchNotification } = require('./cron/match');
const { autoRejectProfile } = require('./cron/reject');

// cron.schedule('*/5 * * * *', async () => {
//     await botCron()
// });

cron.schedule('0 0 * * *', async () => {

    if(process.env.NODE_ENV === 'production')
        await sendMatchNotification()
});

cron.schedule('0 */3 * * *', async () => {
    if(process.env.NODE_ENV === 'production')
        await autoRejectProfile()
});
