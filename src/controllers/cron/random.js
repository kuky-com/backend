const Users = require("../../models/users");

async function updateUserRankings() {
    try {
        const users = await Users.findAll({ profile_approved: 'approved' });

        for (const user of users) {
            const randomRanking = Math.floor(Math.random() * 900) + 101;

            user.score_ranking = randomRanking;
            await user.save();
        }

        console.log('User rankings updated successfully.');
    } catch (error) {
        console.error('Error updating user rankings:', error);
    }
}

module.exports = { updateUserRankings };