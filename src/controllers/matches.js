const Users = require('@/models/users');
const VerificationCode = require('@/models/verification_code');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto')
const bcrypt = require('bcrypt');
const Matches = require('../models/matches');
const UserPurpose = require('../models/user_purpose')
const UserInterest = require('../models/user_interest')
const Purposes = require('../models/purposes')
const Interests = require('../models/interests')
const Tags = require('../models/tags')
const { OpenAI } = require('openai');
const { Op } = require('sequelize');
var admin = require("firebase-admin");
const { v4: uuidv4 } = require('uuid')

var serviceAccount = require("../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

async function getUserDetails(user_id) {
    const interests = await UserInterest.findAll({
        where: { user_id },
        include: [{ model: Interests }]
    });

    const purposes = await UserPurpose.findAll({
        where: { user_id },
        include: [{ model: Purposes }]
    });

    return {
        interests: interests.map(ui => ({
            name: ui.Interest.name,
            type: ui.interest_type
        })),
        purposes: purposes.map(up => up.Purpose.name)
    };
}

function generateMatchingPrompt(user1Details, user2Details) {
    return `Match these two users based on their likes, dislikes, and purposes.
  
    User 1 Likes: ${user1Details.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
    User 1 Dislikes: ${user1Details.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
    User 1 Purposes: ${user1Details.purposes.join(', ')}
  
    User 2 Likes: ${user2Details.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
    User 2 Dislikes: ${user2Details.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
    User 2 Purposes: ${user2Details.purposes.join(', ')}
  
    Give a matching score between 0 to 100 and explain the common areas and differences.`;
}

async function matchUsers(userId1, userId2) {
    try {
        const user1Details = await getUserDetails(userId1);
        const user2Details = await getUserDetails(userId2);

        const prompt = generateMatchingPrompt(user1Details, user2Details);

        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: prompt,
            max_tokens: 150,
            temperature: 0.7
        });

        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error('Error matching users:', error);
        throw error;
    }
}

async function getExploreList({ user_id }) {
    try {
        const suggestions = [];

        const allUserIds = Users.findAll({
            where: {
                is_active: true
            },
            attributes: ['id']
        })

        for (const userId of allUserIds) {
            if (userId !== user_id) {
                const matchResult = await matchUsers(user_id, userId);
                suggestions.push({ userId, matchResult });
            }
        }

        suggestions.sort((a, b) => {
            const scoreA = parseInt(a.matchResult.match(/\d+/)[0]);
            const scoreB = parseInt(b.matchResult.match(/\d+/)[0]);
            return scoreB - scoreA;
        });

        return Promise.resolve({
            message: 'Explore list',
            data: suggestions
        })
    } catch (error) {
        return Promise.resolve(error)
    }
}

async function getMatches({ user_id }) {
    try {
        const matches = Matches.findAll({
            where: {
                [Op.or]: [
                    { sender_id: user_id },
                    { receiver_id: user_id }
                ],
                status: 'accepts'
            }
        })

        return Promise.resolve({
            message: 'Matches list',
            data: matches
        })
    } catch (error) {
        return Promise.resolve(error)
    }
}

async function rejectSuggestion({ user_id, friend_id }) {
    try {
        let existMatch = await Matches.findOne({
            where: {
                [Op.or]: [
                    { sender_id: user_id, receiver_id: friend_id },
                    { sender_id: friend_id, receiver_id: user_id }
                ]
            }
        })

        if (!existMatch) {
            existMatch = await Matches.create({
                sender_id: user_id,
                receiver_id: friend_id
            })
        }

        existMatch = Matches.update({ status: 'rejected' }, {
            where: { id: existMatch.id }
        })

        return Promise.resolve({
            message: 'Suggestion rejected',
            data: existMatch
        })
    } catch (error) {
        return Promise.resolve(error)
    }
}

async function acceptSuggestion({ user_id, friend_id }) {
    try {
        let existMatch = await Matches.findOne({
            where: {
                [Op.or]: [
                    { sender_id: user_id, receiver_id: friend_id },
                    { sender_id: friend_id, receiver_id: user_id }
                ]
            }
        })

        if (!existMatch) {
            existMatch = await Matches.create({
                sender_id: user_id,
                receiver_id: friend_id,
                status: 'sent'
            })
        } else {
            if (existMatch.status === 'sent') {
                const conversation_id = createConversation(user_id, friend_id)
                if (conversation_id) {
                    existMatch = await Matches.update({ status: 'accepted', conversation_id }, {
                        where: {
                            id: existMatch.id
                        }
                    })
                }
            }
        }

        return Promise.resolve({
            message: 'Suggestion accepted',
            data: existMatch
        })
    } catch (error) {
        return Promise.resolve(error)
    }
}

const createConversation = async (user1Id, user2Id) => {
    try {
        const conversation_id = uuidv4();

        await db.collection('conversations').doc(conversation_id).set({
            id: conversation_id,
            participants: [user1Id, user2Id],
            messages: []
        });

        return conversation_id
    } catch (error) {
        console.error('Error creating conversation: ', error);
        throw new Error('Failed to create conversation');
    }
}

module.exports = {
    getExploreList,
    getMatches,
    acceptSuggestion,
    rejectSuggestion
}