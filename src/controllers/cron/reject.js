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
                // {
                //     profile_approved: 'resubmitted',
                // }
            ],
            createdAt: {
                [Op.lt]: new Date(new Date() - 3 * 60 * 60 * 1000)
            },
        },
        raw: true,
    });

    console.log(`Found ${pendingUsers.length} pending users for profile review`);

    for (let i = 0; i < pendingUsers.length; i++) {
        try {
            const user = pendingUsers[i];

            let reasons = []

            if (user.likeCount === 0) {
                reasons.push('Missing interest/hobbies')
            }

            // if (!user.location) {
            //     reasons.push('Missing location address')
            // }

            // if (!user.birthday) {
            //     reasons.push('Missing birthday')
            // }

            // if (!user.pronouns) {
            //     reasons.push('Missing pronouns')
            // }

            // if (!user.gender) {
            //     reasons.push('Missing gender')
            // }

            if (!user.journey_category_id || !user.journey_id) {
                reasons.push('Missing journey')
            }

            if (!user.avatar) {
                reasons.push('Missing profile picture')
            } else {
                const avatarData = await scanImage({ image: user.avatar })
                const avatarDataLabels = avatarData.data

                if (avatarDataLabels.length > 0 &&
                    (avatarDataLabels.includes('Sexual') || avatarDataLabels.includes('Nudity')
                        || avatarDataLabels.includes('Suggestive') || avatarDataLabels.includes('Adult')
                        || avatarDataLabels.includes('Violence') || avatarDataLabels.includes('Hate')
                        || avatarDataLabels.includes('Drugs') || avatarDataLabels.includes('Alcohol')
                        || avatarDataLabels.includes('Weapons') || avatarDataLabels.includes('Spam')
                        || avatarDataLabels.includes('Scam') || avatarDataLabels.includes('Fake'))) {
                    reasons.push('Profile picture contains inappropriate content')
                }
            }

            if (!user.video_intro) {
                reasons.push('Missing video intro')
            } else {
                const response = await axios.post('https://6sx3m5nsmex2xyify3lb3x7s440xkxud.lambda-url.ap-southeast-1.on.aws', {
                    audio_uri: user.video_intro,
                })

                if (response && response.data && response.data.transcript_text && response.data.transcript_text.length < 50) {
                    reasons.push('Your video is invalid, please reupload better video')
                }
            }

            if (reasons.length > 0) {
                // console.log({status: 'rejected', reasons: reasons.join('\n'), user_id: user.id})
                try {
                    await profileAction({ status: 'rejected', reason: reasons.join('\n'), user_id: user.id })
                } catch (error) {
                    console.log({ error })
                }
            } else {
                // console.log({status: 'approved', user_id: user.id})
                // try {
                //     await profileAction({ status: 'approved', user_id: user.id })
                // } catch (error) {
                //     console.log({ error })
                // }
            }
        } catch (error) {
            console.log({ error })
        }
    }

    return res.status(200).json({
        message: 'All profile processed',
    });
}

module.exports = {
    autoRejectProfile
}