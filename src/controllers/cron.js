const cron = require('node-cron');
const { botCron } = require('./cron/bot');
const { sendMatchNotification } = require('./cron/match');
const { autoRejectProfile } = require('./cron/reject');
const { letCompleteProfile, letCompleteProfilePushNotification } = require('./cron/completeProfile');
const { updateUserRankings } = require('./cron/random');
const { checkUnreadMessages } = require('./cron/unreadMessage');
const { autoAnalyzeUser } = require('./cron/journey');

// cron.schedule('*/5 * * * *', async () => {
//     await botCron()
// });

cron.schedule('0 0 * * *', async () => {
    if(process.env.NODE_ENV === 'production')
        await sendMatchNotification()
});

cron.schedule('0 * * * *', async () => {
    if(process.env.NODE_ENV === 'production')
        await autoRejectProfile()
});

cron.schedule('0 9 * * *', async () => {
    if (process.env.NODE_ENV === 'production')
        await letCompleteProfile();
});

cron.schedule('0 9 * * *', async () => {
    if (process.env.NODE_ENV === 'production')
        await letCompleteProfilePushNotification();
});

cron.schedule('0 * * * *', async () => {
    await updateUserRankings()
});

cron.schedule('0 2 * * *', async () => {
    if(process.env.NODE_ENV === 'production')
        await checkUnreadMessages()
});

cron.schedule('15 * * * *', async () => {
    if(process.env.NODE_ENV === 'production')
        await autoAnalyzeUser()
});