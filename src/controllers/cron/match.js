const { Op } = require("sequelize");
const Matches = require("../../models/matches");
const { addNewPushNotification } = require("../notifications");
const Users = require("../../models/users");

const sendMatchNotification = async (req, res) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(twoDaysAgo.getDate() - 3);
    const matches = await Matches.findAll({
        where: {
            status: 'sent',
            sent_date: {
                [Op.gt]: threeDaysAgo,
                [Op.lt]: twoDaysAgo,
            },
        },
        order: [['sent_date', 'DESC']],
        include: [
            { model: Users, as: 'sender' },
        ]
    });

    console.log({ matches })
    for (const match of matches) {
        await addNewPushNotification(match.get('receiver_id'), match, null, 'new_request', `${match.get('sender').full_name} wants to connect with you! 🤝`, 'Tap to view their request and support each other!');
    }

    return res.status(200).json({
        message: 'Notification sent',
    });
}

module.exports = {
    sendMatchNotification
}