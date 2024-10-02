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
const UserPurposes = require('../models/user_purposes')
const UserInterests = require('../models/user_interests')
const Purposes = require('../models/purposes')
const Interests = require('../models/interests')
const Tags = require('../models/tags')
const { OpenAI } = require('openai');
const { Op, Sequelize } = require('sequelize');
var admin = require("firebase-admin");
const { v4: uuidv4 } = require('uuid')

var serviceAccount = require("../config/serviceAccountKey.json");
const { getProfile } = require('./users');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

async function getUserDetails(user_id) {
    const interests = await UserInterests.findAll({
        where: { user_id },
        attributes: {
            include: [
              [Sequelize.col('interest.name'), 'name'],
            ],
          },
        include: [
            { model: Interests, attributes: [['name', 'name']] }
        ]
    });

    const purposes = await UserPurposes.findAll({
        where: { user_id },
        attributes: {
            include: [
              [Sequelize.col('purpose.name'), 'name'],
            ],
          },
        include: [
            { model: Purposes, attributes: [['name', 'name']] }
        ]
    });

    return {
        interests: interests.map(ui => ({
            name: ui.interest.name,
            type: ui.type
        })),
        purposes: purposes.map(up => up.purpose.name)
    };
}

function generateMatchingPrompt(user1Details, user2Details) {
    const prompt = `Match these two users based on their likes, dislikes, and purposes.
  
    User 1 Likes: ${user1Details.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
    User 1 Dislikes: ${user1Details.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
    User 1 Purposes: ${user1Details.purposes.join(', ')}
  
    User 2 Likes: ${user2Details.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
    User 2 Dislikes: ${user2Details.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
    User 2 Purposes: ${user2Details.purposes.join(', ')}
  
    Give a matching score between 0 to 100 and explain the common areas and differences.`;

    return prompt
}

async function matchUsers(userId1, userId2) {
    try {
        const user1Details = await getUserDetails(userId1);
        const user2Details = await getUserDetails(userId2);

        console.log({user1Details, user2Details})
        const prompt = generateMatchingPrompt(user1Details, user2Details);

        const response = await openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt: prompt,
            max_tokens: 150,
            temperature: 0.7
        });

        return response.choices[0].text.trim();
    } catch (error) {
        console.error('Error matching users:', error);
        throw error;
    }
}

async function getExploreList({ user_id }) {
    try {
        const suggestions = [];
        const idSuggestions = [];

        const allUserIds = await Users.findAll({
            where: {
                is_active: true
            },
            attributes: ['id'],
            raw: true
        })

        for (const user of allUserIds) {
            if (user.id !== user_id) {
                const matchResult = await matchUsers(user_id, user.id);
                idSuggestions.push({ id: user.id, matchResult });
            }
        }

        idSuggestions.sort((a, b) => {
            const scoreA = parseInt(a.matchResult.match(/\d+/)[0]);
            const scoreB = parseInt(b.matchResult.match(/\d+/)[0]);
            return scoreB - scoreA;
        });

        for(const rawuser of idSuggestions) {
            if(suggestions.length > 20) {
                break
            }

            const userInfo = await getProfile({user_id: rawuser.id})
            suggestions.push(userInfo.data)
        }

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
        const matches = await Matches.findAll({
            where: {
                [Op.or]: [
                    { sender_id: user_id },
                    { receiver_id: user_id }
                ],
                status: 'accepted',
            },
            raw: true
        })

        const finalMatches = []
        for(const match of matches) {
            if(match.sender_id === user_id) {
                const userInfo = await getProfile({user_id: match.receiver_id})
                finalMatches.push({...match, profile: userInfo.data})
            } else {
                const userInfo = await getProfile({user_id: match.sender_id})
                finalMatches.push({...match, profile: userInfo.data})
            }
        }

        return Promise.resolve({
            message: 'Matches list',
            data: finalMatches
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
                const conversation_id = await createConversation(user_id, friend_id)
                if (conversation_id) {
                    existMatch = await Matches.update({ status: 'accepted', conversation_id, response_date: new Date() }, {
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