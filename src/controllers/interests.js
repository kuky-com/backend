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
const UserPurposes = require('../models/user_purposes')
const UserInterests = require('../models/user_interests')
const Purposes = require('../models/purposes')
const Interests = require('../models/interests')
const Tags = require('../models/tags')
const { OpenAI } = require('openai');
const { Op, Sequelize } = require('sequelize');
const { getProfile } = require('./users');
const { categoryMap } = require('../config/categories');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

async function getPurposes({ user_id }) {
    try {
        const purposes = await UserPurposes.findAll({
            where: {
                user_id: user_id
            },
            attributes: {
                include: [
                    [Sequelize.col('purpose.name'), 'name'],
                ],
            },
            include: [
                { model: Purposes, attributes: [['name', 'name']] }
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
        const likes = await UserInterests.findAll({
            where: {
                user_id: user_id,
                interest_type: 'like'
            },
            attributes: {
                include: [
                    [Sequelize.col('interest.name'), 'name'],
                ],
            },
            include: [
                { model: Interests, attributes: [['name', 'name']] }
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
        const likes = await UserInterests.findAll({
            where: {
                user_id: user_id,
                interest_type: 'dislike'
            },
            attributes: {
                include: [
                    [Sequelize.col('interest.name'), 'name'],
                ],
            },
            include: [
                { model: Interests, attributes: [['name', 'name']] }
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
    const userInterests = await UserInterests.findAll({
        where: { user_id },
        include: [
            { model: Interests, attributes: [['name', 'name']] }
        ]
    });

    return userInterests.map(ui => ({
        interest: ui.interest.name,
        type: ui.interest_type
    }));
};

async function updatePurposes({ user_id, purposes }) {
    try {
        const currentUserPurposes = await UserPurposes.findAll({
            where: { user_id },
            include: [{ model: Purposes }]
        });

        const currentPurposeIds = currentUserPurposes.map(up => up.purpose_id);

        const purposeRecords = await Promise.all(purposes.map(async (name) => {
            let purpose = await Purposes.findOne({
                where: { name: name }
            });
            if (purpose) {
                return purpose
            }
            purpose = await Purposes.create({
                name: name
            });
            await normalizePurposes(purpose.id)
            return purpose
        }));

        const newPurposeIds = purposeRecords.filter(p => p !== null).map(p => p.id);

        await UserPurposes.destroy({
            where: {
                user_id,
                purpose_id: { [Op.notIn]: newPurposeIds }
            }
        });

        await Promise.all(newPurposeIds.map(async (purpose_id) => {
            if (!currentPurposeIds.includes(purpose_id)) {
                try {
                    await UserPurposes.create({ user_id, purpose_id });
                } catch (error) {
                    
                }
            }
        }));

        const newUserPurposes = await UserPurposes.findAll({
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

        const currentUserLikes = await UserInterests.findAll({
            where: { user_id, interest_type: 'like' },
            include: [{ model: Interests }]
        });

        const currentLikesIds = currentUserLikes.map(up => up.interest_id);

        const interestRecords = await Promise.all(likes.map(async (name) => {
            if (name && name.length > 1) {
                let interest = await Interests.findOne({
                    where: { name: name }
                });
                if (interest) {
                    return interest
                }
                interest = await Interests.create({
                    name: name
                });
                await normalizeInterests(interest.id)
                return interest
            } else {
                return null
            }
        }));

        const newInterestIds = interestRecords.filter(p => p !== null).map(p => p.id);

        await UserInterests.destroy({
            where: {
                user_id,
                interest_type: 'like',
                interest_id: { [Op.notIn]: newInterestIds }
            }
        });

        await Promise.all(newInterestIds.map(async (interest_id) => {
            if (!currentLikesIds.includes(interest_id)) {
                try {
                    await UserInterests.create({ user_id, interest_type: 'like', interest_id });
                } catch (error) {
                    
                }
            }
        }));

        const newUserLikes = await UserInterests.findAll({
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

async function updateDislikes({ user_id, dislikes }) {
    try {

        const currentUserDislikes = await UserInterests.findAll({
            where: { user_id, interest_type: 'dislike' },
            include: [{ model: Interests }]
        });

        const currentDislikesIds = currentUserDislikes.map(up => up.interest_id);

        const interestRecords = await Promise.all(dislikes.map(async (name) => {
            if (name && name.length > 1) {
                let interest = await Interests.findOne({
                    where: { name: name }
                });
                if (interest) {
                    return interest
                }
                interest = await Interests.create({
                    name: name
                });
                await normalizeInterests(interest.id)
                return interest
            } else {
                return null
            }
        }));

        const newInterestIds = interestRecords.filter(p => p !== null).map(p => p.id);

        await UserInterests.destroy({
            where: {
                user_id,
                interest_type: 'dislike',
                interest_id: { [Op.notIn]: newInterestIds }
            }
        });

        await Promise.all(newInterestIds.map(async (interest_id) => {
            if (!currentDislikesIds.includes(interest_id)) {
                await UserInterests.create({ user_id, interest_type: 'dislike', interest_id });
            }
        }));

        const newUserDislikes = await UserInterests.findAll({
            where: { user_id, interest_type: 'dislike' },
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
    const tags = await Tags.findAll({
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
            if (userInterest.type === 'like') {
                likes.push(userInterest.interest);
            } else if (userInterest.type === 'dislike') {
                dislikes.push(userInterest.interest);
            }
        });

        const tags = await Tags.findAll({
            attributes: ['id', 'name'],
            raw: true
        })
        const tagNames = tags.map((tag) => tag.name)

        const prompt = `Based on the following user interests, categorize this user into the most suitable category based on the provided tags:
        
        Likes: ${likes.join(', ')}
        Dislikes: ${dislikes.join(', ')}
        
        Tags: ${tagNames.join(', ')}
        
        Provide a category for the user based on these tags.  Just show category name no other words.`
        const response = await openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt,
            max_tokens: 150,
        });
        const bestTagName = response.choices[0].text.trim();
        const bestTag = tags.find(tag => tag.name.toLowerCase() === bestTagName.toLowerCase());

        const updatedUser = await Users.update({ profile_tag: bestTag.id }, {
            where: { id: user_id }
        })

        const userInfo = await getProfile({ user_id })

        return Promise.resolve({
            message: 'User profile tag has been updated!',
            data: userInfo.data
        })

    } catch (error) {
        console.error('Error user update dislikes:', error);
        const updatedUser = await Users.update({ profile_tag: 1 }, {
            where: { id: user_id }
        })

        const userInfo = await getProfile({ user_id })

        return Promise.resolve({
            message: 'User profile tag has been updated!',
            data: userInfo.data
        })
    }
}

async function normalizePurposes(purposeId) {
    try {
        let purposes = []

        if (purposeId) {
            purposes = await Purposes.findAll({
                where: {
                    id: purposeId
                },
                attributes: ['name', 'id'],
                order: [['id', 'asc']]
            })
        } else {
            purposes = await Purposes.findAll({
                attributes: ['name', 'id'],
                order: [['id', 'asc']]
            })
        }

        const categoryNames = Object.keys(categoryMap)

        for (let purpose of purposes) {
            const prompt = `Classify the following purpose into a more specific predefined category, such as '${categoryNames.join("', '")}'. Be specific and assign the purpose to the closest, most relevant category, only show category in the given list.\n\nPurpose: ${purpose.name}\nCategory:`;

            const response = await openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: prompt,
                max_tokens: 10,
            });

            try {
                const normalizedId = categoryMap[response.choices[0].text.trim().toLowerCase()];

                await Purposes.update({ normalized_purpose_id: normalizedId }, { where: { id: purpose.id } });
            } catch (error) {
                console.log({ error })
            }
        }

        //find all invalid purposes word then delete it
        const inValidPurposeIds = await Purposes.findAll({
            where: {
                normalized_purpose_id: {
                    [Op.eq]: null
                }
            },
            attributes: ['id'],
            raw: true
        })

        const ids = inValidPurposeIds.map((item) => item.id)

        await UserPurposes.destroy({
            where: {
                purpose_id: {
                    [Op.in]: ids
                }
            }
        })
        await Purposes.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        })

        return Promise.resolve({
            message: 'Updated purposes!',
        })

    } catch (error) {
        console.log(error);

        return Promise.resolve({
            message: 'Updated purposes!',
        })
    }
}

async function normalizeInterests(interestId) {
    try {
        let interests = []

        if (interestId) {
            interests = await Interests.findAll({
                where: {
                    id: interestId
                },
                attributes: ['name', 'id'],
                order: [['id', 'asc']]
            })
        } else {
            interests = await Interests.findAll({
                attributes: ['name', 'id'],
                order: [['id', 'asc']]
            })
        }

        const categoryNames = Object.keys(categoryMap)

        for (let interest of interests) {
            const prompt = `Classify the following interest into a more specific predefined category, such as '${categoryNames.join("', '")}'. Be specific and assign the interest to the closest, most relevant category, only show category in the given list.\n\nInterest: ${interest.name}\nCategory:`;

            const response = await openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: prompt,
                max_tokens: 10,
            });

            try {
                const normalizedId = categoryMap[response.choices[0].text.trim().toLowerCase()];

                await Interests.update({ normalized_interest_id: normalizedId }, { where: { id: interest.id } });
            } catch (error) {
                console.log({ error })
            }
        }

        //find all invalid interests word then delete it
        const inValidInterestIds = await Interests.findAll({
            where: {
                normalized_interest_id: {
                    [Op.eq]: null
                }
            },
            attributes: ['id'],
            raw: true
        })

        const ids = inValidInterestIds.map((item) => item.id)

        await UserInterests.destroy({
            where: {
                interest_id: {
                    [Op.in]: ids
                }
            }
        })
        await Interests.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        })

        return Promise.resolve({
            message: 'Updated interests!',
        })

    } catch (error) {
        console.log(error);

        return Promise.resolve({
            message: 'Updated interests!',
        })
    }
}

module.exports = {
    getPurposes,
    getLikes,
    getDislikes,
    updatePurposes,
    updateLikes,
    updateDislikes,
    updateProfileTag,
    normalizePurposes,
    normalizeInterests
}