const Users = require('@/models/users');
const { default: OpenAI } = require('openai');
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const Tags = require('../models/tags');
const Journeys = require('../models/journeys');
const JourneyCategories = require('../models/journey_categories');
const { Sequelize, where, Op } = require('sequelize');
const ReviewUsers = require('../models/review_users');
const { raw } = require('body-parser');
const Matches = require('../models/matches');
const ProfileViews = require('../models/profile_views');
const BlockedUsers = require('../models/blocked_users');
const { isStringInteger } = require('../utils/utils');
var firebaseAdmin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    storageBucket: 'kuky-105e6.appspot.com'
});
const db = firebaseAdmin.firestore();

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

const predefinedTags = [
    "outdoor sport", "indoor sport", "outdoor activities", "indoor activities",
    "adventure", "travel", "food_and_drink", "cooking", "gaming", "movies",
    "music", "reading", "technology", "programming", "art", "photography",
    "fashion", "fitness", "wellness", "personal development", "business",
    "finance", "education", "science", "history", "politics", "environment",
    "animals", "pets", "gardening", "DIY", "fishing", "hunting", "cars",
    "motorcycles", "cycling", "hiking", "camping", "water sports", "snow sports",
    "team sports", "individual sports", "board games", "video games", "literature",
    "poetry", "writing", "design", "architecture", "socializing", "volunteering",
    "entrepreneurship"
];

async function analyzeAllUserTags() {
    try {
        const users = await Users.findAll({
            where: { is_active: true },
            attributes: ['id'],
            raw: true
        }); 
        
        for (const user of users) {
            try {
                await Users.update(
                    { matching_tags: [] },
                    { where: { id: user.id } }
                );
                const result = await analyzeUserTags(user.id);
                await Users.update(
                    { matching_tags: result.data },
                    { where: { id: user.id } }
                );
            } catch (error) {
                console.log(`Error analyzing tags for user ${user.id}:`, error);
            }
        }
        return Promise.resolve({
            message: 'All user tags analyzed successfully',
        });
    } catch (error) {
        console.log('Error analyzing all user tags:', error);
        return Promise.reject(error);
    }
}

async function analyzeUserTags(user_id) {
    try {
        let userInfo = await getUser(user_id);

        if(userInfo.interests.length === 0 && 
            !userInfo.video_intro_transcript && 
            !userInfo.video_purpose_transcript && 
            !userInfo.video_interests_transcript) {
            return Promise.resolve({
                data: [],
                message: 'No interests or video transcripts available for analysis',
            });
        }

        const interests = userInfo.interests.filter(item => item.user_interests.interest_type === 'like').map((interest) => interest.name).join(', ') + '';
        const dislikes = userInfo.interests.filter(item => item.user_interests.interest_type === 'dislike').map((dislike) => dislike.name).join(', ') + '';

        const prompt = `
                   You are a user tagging system. Your goal is to analyze user information and assign relevant tags from a predefined list.
                    Be precise and assign only tags that are strongly related to the provided information. If no clear tag applies, do not assign one.
                    Consider nuances in language and infer interests even if not explicitly stated.

                    Predefined Tags: ${predefinedTags.join(', ')}

                    User Information:
                    Likes: ${interests}
                    Dislikes: ${dislikes}
                    ${userInfo.video_intro_transcript ? `Introduction video Transcription: ${userInfo.video_intro_transcript}` : ''}
                    ${userInfo.video_purpose_transcript ? `Journey video Transcription: ${userInfo.video_purpose_transcript}` : ''}
                    ${userInfo.video_interests_transcript ? `Interest video Transcription: ${userInfo.video_interests_transcript}` : ''}

                    Based on the above information, list the most relevant tags from the Predefined Tags list.
                    Format your output as a comma-separated list of tags, e.g., "tag1,tag2,tag3". If not enough information is provided, return an empty list.
                    Do not include any additional text or explanations, just the tags.
                    `;
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
            });

            const result = response.choices[0]?.message?.content?.trim();

            return Promise.resolve({
                data: result.split(',').map(tag => tag.trim()),
                message: 'Update successfully',
            });
        } catch (error) {
            console.log({ error });
        }
    } catch (error) {
        console.log({ error })
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
        // check if user has interests or video transcripts
        if(interests.length === 0 && 
            dislikes.length === 0 &&
            !userInfo.video_intro_transcript && 
            !userInfo.video_purpose_transcript && 
            !userInfo.video_interests_transcript) {
            return Promise.resolve({
                data: userInfo,
                message: 'No interests or video transcripts available for analysis',
            });
        }
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

            try {
                const tags = await analyzeUserTags(user_id);
                if (tags.data.length > 0){
                    await Users.update(
                        { matching_tags: tags.data },
                        { where: { id: user_id } }
                    );
                }
            } catch (error) {
                
            }

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

async function getSimpleProfile({ user_id }) {
    try {
        try {
            const user = await Users.scope(['simpleProfile', 'blurVideo']).findOne({
                where: { id: user_id },
                include: [{ model: Journeys }, { model: JourneyCategories }],
            });

            if (!user) {
                return Promise.reject('User not found');
            }

            console.log({ user })

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
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error);
    }
}


async function getFriendProfile({ user_id, friend_id }) {
    try {
        const findCondition = isStringInteger(friend_id)
            ? { id: friend_id }
            : Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('referral_id')),
                friend_id.toString().trim().toLowerCase()
            );

        const user = await Users.scope(['includeBlurVideo']).findOne({
            where: findCondition,
            include: [{ model: Purposes }, { model: Journeys }, { model: JourneyCategories }, { model: Interests }, { model: Tags }],
        });

        if (!user) {
            return Promise.reject('User not found');
        }

        if (user_id) {
            const blocked = await BlockedUsers.findOne({
                where: {
                    [Op.or]: [
                        {
                            user_id: user_id,
                            blocked_id: user.id,
                        },
                        {
                            user_id: user.id,
                            blocked_id: user_id,
                        },
                    ],
                },
            });

            if (blocked) {
                return Promise.resolve({
                    message: 'User info retrieved successfully',
                    data: {
                        blocked: true,
                        user: {},
                        match: null,
                    },
                });
            }
        }


        if (user_id) {
            await ProfileViews.create({
                userId: user.id,
                viewerId: user_id,
            });
        }

        let match = null

        if (user_id) {
            match = await Matches.scope({ method: ['withIsFree', user_id] }).findOne({
                where: {
                    [Op.or]: [
                        { sender_id: user_id, receiver_id: user.id },
                        { sender_id: user.id, receiver_id: user_id },
                    ],
                },
                order: [['id', 'desc']],
            });
        }

        const reviewsData = await getReviewStats(user.id);

        return Promise.resolve({
            message: 'User info retrieved successfully',
            data: {
                user: {
                    ...user.toJSON(),
                    reviewsCount: reviewsData.reviewsCount,
                    avgRating: reviewsData.avgRating,
                },

                match,
            },
        });
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error);
    }
}

module.exports = {
    createSummary,
    getProfile,
    getReviewStats,
    getUser,
    getUserAvatar,
    analyzeUser,
    getSimpleProfile,
    getFriendProfile,
    db,
    firebaseAdmin,
    analyzeUserTags,
    analyzeAllUserTags,
    predefinedTags,
};
