const { Op } = require("sequelize");
const Matches = require("../../models/matches");
const { addNewPushNotification } = require("../notifications");
const Users = require("../../models/users");
const { profileAction } = require("../admin");
const { default: axios } = require("axios");
const { scanImage } = require("../users");

const autoRejectProfile = async (req, res) => {
    const pendingUsers = await Users.scope('withInterestCount').findAll({
        where: {
            is_active: true,
            email_verified: true,
            [Op.or]: [
                {
                    profile_approved: 'pending',
                },
                {
                    profile_approved: 'resubmitted',
                }
            ],
            createdAt: {
                [Op.lt]: new Date(new Date() - 2 * 60 * 60 * 1000)
            }
        }
    });

    for (let i = 0; i < pendingUsers.length; i++) {
        const user = pendingUsers[i];

        let reasons = []

        if (user.likeCount === 0) {
            reasons.push('Missing interest/hobbies')
        }

        if (user.purposeCount === 0) {
            reasons.push('Missing purpose/journey')
        }

        if (!user.location) {
            reasons.push('Missing location address')
        }

        if (!user.birthday) {
            reasons.push('Missing birthday')
        }

        if (!user.pronouns) {
            reasons.push('Missing pronouns')
        }

        if (!user.gender) {
            reasons.push('Missing gender')
        }

        if (!user.avatar) {
            reasons.push('Missing profile picture')
        } else {
            const avatarData = await scanImage({image: user.avatar})
            const avatarDataLabels = avatarData.data


            if (avatarDataLabels.length > 0 &&
                (avatarDataLabels.includes('Sexual') || avatarDataLabels.includes('Nudity') 
            ||  avatarDataLabels.includes('Suggestive') || avatarDataLabels.includes('Adult')
            ||  avatarDataLabels.includes('Violence') || avatarDataLabels.includes('Hate')
            ||  avatarDataLabels.includes('Drugs') || avatarDataLabels.includes('Alcohol')
            ||  avatarDataLabels.includes('Weapons') || avatarDataLabels.includes('Spam')
            ||  avatarDataLabels.includes('Scam') || avatarDataLabels.includes('Fake'))){
                reasons.push('Profile picture contains inappropriate content')
            }
        }

        if (reasons.length > 0) {
            // console.log({status: 'rejected', reasons: reasons.join('\n'), user_id: user.id})
            try {
                await profileAction({ status: 'rejected', reason: reasons.join('\n'), user_id: user.id })
            } catch (error) {
                console.log({ error })
            }
        }
    }

    return res.status(200).json({
        message: 'All profile processed',
    });
}

module.exports = {
    autoRejectProfile
}