const { Op } = require("sequelize");
const Matches = require("../../models/matches");
const { addNewPushNotification } = require("../notifications");
const Users = require("../../models/users");
const { requestCompleteProfileAction, requestCompleteProfileActionPush } = require("../admin");
const { default: axios } = require("axios");
const { scanImage } = require("../users");

const letCompleteProfile = async (req, res) => {
    await requestCompleteProfileAction({ user_id: 1593 })

    // const pendingUsers = await Users.findAll({
    //     where: {
    //         is_active: true,
    //         email_verified: true,
    //         [Op.or]: [
    //             {
    //                 profile_approved: 'pending',
    //             },
    //             {
    //                 profile_approved: 'rejected',
    //             }
    //         ],
    //         createdAt: {
    //             [Op.gt]: new Date(new Date() - 48 * 60 * 60 * 1000),
    //             [Op.lt]: new Date(new Date() - 24 * 60 * 60 * 1000),
    //         }
    //     }
    // });

    // for (let i = 0; i < pendingUsers.length; i++) {
    //     const user = pendingUsers[i];

    //     try {
    //         // console.log({ letCompleteProfile: user.id })
    //         await requestCompleteProfileAction({ user_id: user.id })
    //     } catch (error) {
    //         console.log({ error })
    //     }
    // }

    return res.status(200).json({
        message: 'All profile processed',
    });
}

const letCompleteProfilePushNotification = async (req, res) => {
    await requestCompleteProfileActionPush({ user_id: 1593 })
    // const pendingUsers = await Users.findAll({
    //     where: {
    //         is_active: true,
    //         email_verified: true,
    //         [Op.or]: [
    //             {
    //                 profile_approved: 'pending',
    //             },
    //             {
    //                 profile_approved: 'rejected',
    //             }
    //         ],
    //         createdAt: {
    //             [Op.gt]: new Date(new Date() - 72 * 60 * 60 * 1000),
    //             [Op.lt]: new Date(new Date() - 48 * 60 * 60 * 1000),
    //         }
    //     }
    // });

    // for (let i = 0; i < pendingUsers.length; i++) {
    //     const user = pendingUsers[i];

    //     try {
    //         await requestCompleteProfileActionPush({ user_id: user.id })
    //     } catch (error) {
    //         console.log({ error })
    //     }
    // }

    return res.status(200).json({
        message: 'All profile processed',
    });
}

module.exports = {
    letCompleteProfile,
    letCompleteProfilePushNotification
}