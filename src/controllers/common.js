const Users = require('@/models/users');
const { default: OpenAI } = require('openai');
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const Tags = require('../models/tags');
const Journeys = require('../models/journeys');
const JourneyCategories = require('../models/journey_categories');
const { Sequelize, where } = require('sequelize');
const ReviewUsers = require('../models/review_users');
const { raw } = require('body-parser');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function getUser(user_id) {
    try {
        const user = await Users.scope(['askJPFGeneral', 'askJPFSpecific', 'withInterestCount', 'includeBlurVideo']).findOne({
            where: { id: user_id },
            attributes: { exclude: ['password'] },
            include: [{ model: Purposes }, { model: Interests }, { model: Tags }, { model: Journeys }, { model: JourneyCategories }],
        });

        // console.log({ user })

        if (!user) {
            return Promise.reject('User not found');
        }

        return Promise.resolve(user);
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error);
    }
}

async function getProfile({ user_id }) {
    try {
        const user = await Users.scope(['askJPFGeneral', 'askJPFSpecific', 'withInterestCount', 'includeBlurVideo']).findOne({
            where: { id: user_id },
            include: [
                { model: Purposes },
                { model: Interests },
                { model: Tags },
                { model: Journeys },
                { model: JourneyCategories }
            ],
        });

        if (!user) {
            return Promise.reject('User not found');
        }

        const reviewsData = await getReviewStats(user_id);

        return Promise.resolve({
            message: 'User info retrieved successfully',
            data: {
                ...user.toJSON(),
                reviewsCount: reviewsData.reviewsCount,
                avgRating: reviewsData.avgRating,
            },
        });
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error);
    }
}

async function createSummary(user_id) {
    try {
        const userInfo = await getUser(user_id);

        if (!userInfo.video_intro_transcript) return

        const interests = userInfo.interests.filter(item => item.user_interests.interest_type === 'like').map((interest) => interest.name).join(', ') + '';
        const dislikes = userInfo.interests.filter(item => item.user_interests.interest_type === 'dislike').map((dislike) => dislike.name).join(', ') + '';

        const prompt = `With the following information, create a summary of the user, it should very impressive to other people and make the user feel good about themselves. 
    The summary should has less than 50 words. There is may some empty information so just ignore it.
    Full name: ${userInfo.full_name}
    Interested journey: ${userInfo.journey?.name ?? ''}
    Interesting: ${interests}
    Dislikes: ${dislikes}
    What he/she said in the video intro: ${userInfo.video_intro_transcript ?? ''}
    What he/she said in the video journey: ${userInfo.video_purpose_transcript ?? ''}
    What he/she said in the video interests: ${userInfo.video_interests_transcript ?? ''}
    `;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
            });

            const summary = response.choices[0]?.message?.content?.trim()

            await Users.update(
                { summary: summary },
                { where: { id: user_id } }
            );
        } catch (error) {
            console.log({ error });
        }
    } catch (error) {
        console.log({ error })
    }
}

async function getReviewStats(user_id) {
    const reviewsObj = await Users.findOne({
        where: { id: user_id },
        attributes: {
            include: [
                [
                    Sequelize.fn('COUNT', Sequelize.col('reviews.id')),
                    'reviewsCount',
                ],
                [Sequelize.fn('AVG', Sequelize.col('reviews.rating')), 'avgRating'],
            ],
        },
        group: ['users.id'],
        include: [
            {
                model: ReviewUsers,
                attributes: [],
                as: 'reviews',
                where: {
                    status: 'approved',
                },
            },
        ],
    });
    const data = reviewsObj?.toJSON();
    return {
        reviewsCount: data?.reviewsCount || 0,
        avgRating: data?.avgRating || 0,
    };
}

async function getUserAvatar(user_id) {
    try {
        const user = await Users.findOne({
            where: { id: user_id },
            attributes: ['avatar'],
        });

        if (!user) {
            return Promise.reject('User not found');
        }

        return Promise.resolve(user.avatar);
    } catch (error) {
        console.log('Error fetching user avatar:', error);
        return Promise.reject(error);
    }
}

async function analyzeUser(user_id) {
    try {
        let userInfo = await getUser(user_id);
        const journeys = await Journeys.findAll({
            attributes: ['id', 'name'],
            raw: true
        })

        const journeyList = journeys.map((journey) => `${journey.name} - ${journey.id}`).join('\n')

        const interests = userInfo.interests.filter(item => item.user_interests.interest_type === 'like').map((interest) => interest.name).join(', ') + '';
        const dislikes = userInfo.interests.filter(item => item.user_interests.interest_type === 'dislike').map((dislike) => dislike.name).join(', ') + '';

        const prompt = `We have following information and list of journeys, please analyze the user and give us best matching journey for the user.
                        Full name: ${userInfo.full_name}
                        Interested journey: ${userInfo.journey?.name ?? ''}
                        Interesting: ${interests}
                        Dislikes: ${dislikes}
                        What he/she said in the video intro: ${userInfo.video_intro_transcript ?? ''}
                        What he/she said in the video journey: ${userInfo.video_purpose_transcript ?? ''}
                        What he/she said in the video interests: ${userInfo.video_interests_transcript ?? ''}


                        #List of journeys - format is name - id: 
                        ${journeyList}

                        #In the response return only journey id, no other text, no explanation, no other information.
                    `;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
            });

            const journey_id = parseInt(response.choices[0]?.message?.content?.trim())
            const journey = await Journeys.findOne({ where: { id: journey_id }, raw: true })

            await Users.update(
                { journey_id: journey.id, journey_category_id: journey.category },
                { where: { id: user_id } }
            );

            userInfo = await getUser(user_id);

            return Promise.resolve({
                data: userInfo,
                message: 'Update successfully',
            });
        } catch (error) {
            console.log({ error });
        }
    } catch (error) {
        console.log({ error })
    }
}

module.exports = {
    createSummary,
    getProfile,
    getReviewStats,
    getUser,
    getUserAvatar,
    analyzeUser
};
