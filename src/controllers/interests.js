const Users = require('@/models/users');
const VerificationCode = require('@/models/verification_code');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto')
const bcrypt = require('bcrypt');
const Sessions = require('../models/sessions');
const UserPurpose = require('../models/user_purpose')
const UserInterest = require('../models/user_interest')
const Purposes = require('../models/purposes')
const Interests = require('../models/interests')
const Tags = require('../models/tags')
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

async function getPurposes({ user_id }) {
    try {
        const purposes = await UserPurpose.findAll({
            where: {
                user_id: user_id
            },
            include: [
                { model: Purposes }
            ]
        })

        return Promise.resolve({
            message: "Success",
            data: purposes
        })
    } catch (error) {
        console.error('Error user purposes:', error);
        return Promise.reject(error)
    }
}

async function getLikes({ user_id }) {
    try {
        const likes = await UserInterest.findAll({
            where: {
                user_id: user_id,
                interest_type: 'like'
            },
            include: [
                { model: Interests }
            ]
        })

        return Promise.resolve({
            message: "Success",
            data: likes
        })
    } catch (error) {
        console.error('Error user likes:', error);
        return Promise.reject(error)
    }
}

async function getDislikes({ user_id }) {
    try {
        const likes = await UserInterest.findAll({
            where: {
                user_id: user_id,
                interest_type: 'dislike'
            },
            include: [
                { model: Interests }
            ]
        })

        return Promise.resolve({
            message: "Success",
            data: likes
        })
    } catch (error) {
        console.error('Error user dislikes:', error);
        return Promise.reject(error)
    }
}

const getUserInterests = async (user_id) => {
    const userInterests = await db.user_interest.findAll({
        where: { user_id },
        include: [
            { model: Interests }
        ]
    });

    return userInterests.map(ui => ({
        interest: ui.interest.name,
        type: ui.interest_type
    }));
};

async function updatePurposes({ user_id, purposes }) {
    try {

        const currentUserPurposes = await UserPurpose.findAll({
            where: { user_id },
            include: [{ model: Purposes }]
        });

        const currentPurposeIds = currentUserPurposes.map(up => up.purpose_id);

        const purposeRecords = await Promise.all(purposes.map(async (name) => {
            const [purpose] = await Purposes.findOrCreate({
                where: { name: name }
            });
            return purpose;
        }));

        const newPurposeIds = purposeRecords.map(p => p.id);

        await UserPurpose.destroy({
            where: {
                user_id,
                purpose_id: { [Op.notIn]: newPurposeIds }
            }
        });

        await Promise.all(newPurposeIds.map(async (purpose_id) => {
            if (!currentPurposeIds.includes(purpose_id)) {
                await UserPurpose.create({ user_id, purpose_id });
            }
        }));

        const newUserPurposes = await UserPurpose.findAll({
            where: { user_id },
            include: [{ model: Purposes }]
        });

        return Promise.resolve({
            message: 'User purposes updated successfully.',
            data: newUserPurposes
        })
    } catch (error) {
        console.error('Error user update purposes:', error);
        return Promise.reject(error)
    }
}

async function updateLikes({ user_id, likes }) {
    try {

        const currentUserLikes = await UserInterest.findAll({
            where: { user_id, interest_type: 'like' },
            include: [{ model: Interests }]
        });

        const currentLikesIds = currentUserLikes.map(up => up.interest_id);

        const interestRecords = await Promise.all(likes.map(async (name) => {
            const [interest] = await Interests.findOrCreate({
                where: { name: name }
            });
            return interest;
        }));

        const newInterestIds = interestRecords.map(p => p.id);

        await UserInterest.destroy({
            where: {
                user_id,
                interest_type: 'like',
                interest_id: { [Op.notIn]: newInterestIds }
            }
        });

        await Promise.all(newInterestIds.map(async (interest_id) => {
            if (!currentLikesIds.includes(interest_id)) {
                await UserInterest.create({ user_id, interest_type: 'like', interest_id });
            }
        }));

        const newUserLikes = await UserInterest.findAll({
            where: { user_id, interest_type: 'like' },
            include: [{ model: Interests }]
        });

        return Promise.resolve({
            message: 'User likes updated successfully.',
            data: newUserLikes
        })
    } catch (error) {
        console.error('Error user update likes:', error);
        return Promise.reject(error)
    }
}

async function updateDislike({ user_id, dislikes }) {
    try {

        const currentUserDislikes = await UserInterest.findAll({
            where: { user_id, interest_type: 'dislikes' },
            include: [{ model: Interests }]
        });

        const currentDislikesIds = currentUserDislikes.map(up => up.interest_id);

        const interestRecords = await Promise.all(dislikes.map(async (name) => {
            const [interest] = await Interests.findOrCreate({
                where: { name: name }
            });
            return interest;
        }));

        const newInterestIds = interestRecords.map(p => p.id);

        await UserInterest.destroy({
            where: {
                user_id,
                interest_type: 'dislikes',
                interest_id: { [Op.notIn]: newInterestIds }
            }
        });

        await Promise.all(newInterestIds.map(async (interest_id) => {
            if (!currentDislikesIds.includes(interest_id)) {
                await UserInterest.create({ user_id, interest_type: 'dislikes', interest_id });
            }
        }));

        const newUserDislikes = await UserInterest.findAll({
            where: { user_id, interest_type: 'dislikes' },
            include: [{ model: Interests }]
        });

        return Promise.resolve({
            message: 'User dislikes updated successfully.',
            data: newUserDislikes
        })
    } catch (error) {
        console.error('Error user update dislikes:', error);
        return Promise.reject(error)
    }
}

const getTagIdsByName = async (tagNames) => {
    const tags = await db.tags.findAll({
        where: {
            name: tagNames
        }
    });

    return tags.map(tag => ({ name: tag.name, id: tag.id }));
};

async function updateProfileTag({ user_id }) {
    try {
        const interests = await getUserInterests(user_id)

        let likes = [];
        let dislikes = [];

        interests.forEach((userInterest) => {
            if (userInterest.interestType === 'like') {
                likes.push(userInterest.Interest.name);
            } else if (userInterest.interestType === 'dislike') {
                dislikes.push(userInterest.Interest.name);
            }
        });

        const tags = await Tags.findAll({
            attributes: ['name']
        })

        const prompt = `Based on the following user interests, categorize this user into the most suitable category based on the provided tags:
  
        Likes: ${likes.join(', ')}
        Dislikes: ${dislikes.join(', ')}
        
        Tags: ${tags.join(', ')}
        
        Provide a category for the user based on these tags.`

        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt,
            max_tokens: 150,
        });

        const bestTagName = response.data.choices[0].text.trim();
        const bestTag = tags.find(tag => tag.name.toLowerCase() === bestTagName.toLowerCase());
        const updatedUser = await Users.update({ profile_tag: bestTag.id }, {
            id: user_id
        })

        return Promise.resolve({
            message: 'User profile tag has been updated!',
            data: updatedUser
        })

    } catch (error) {
        console.error('Error user update dislikes:', error);
        return Promise.reject(error)
    }
}

module.exports = {
    getPurposes,
    getLikes,
    getDislikes,
    updatePurposes,
    updateLikes,
    updateDislike,
    updateProfileTag
}