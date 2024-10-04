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
const BlockedUsers = require('../models/blocked_users');
const { findUnique } = require('../utils/utils');
const { addNewNotification, addNewPushNotification } = require('./notifications');

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
        ],
        raw: true
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
        ],
        raw: true
    });

    return {
        id: user_id,
        interests: interests.map(ui => ({
            name: ui.name,
            type: ui.interest_type
        })),
        purposes: purposes.map(up => up.name)
    };
}

function generateMatchingPrompt(targetUser, compareUsers) {
    console.log({targetUser})
    let prompt = `I have target person with information about likes, dislikes, and purposes.
  
    Target person Likes: ${targetUser.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
    Target person Dislikes: ${targetUser.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
    Target person Purposes: ${targetUser.purposes.join(', ')}

    Then I have list of several people with their likes, dislikes, and purposes. I want to get order of people that best match with
    my target person, sort from best match to lower: `

    for(const user of compareUsers){
        prompt += `
            Person with ID=${user.id} Likes: ${user.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
            Person with ID=${user.id} Dislikes: ${user.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
            Person with ID=${user.id} Purposes: ${user.purposes.join(', ')}

        `
    }
  
    prompt += `
                Return the list of sorted people ID separate by "," only, no other words`;

    return prompt
}

async function matchUsers(targetId, compareIds) {
    try {
        const targetUser = await getUserDetails(targetId);
        const compareUsers = []
        
        for(const userId of compareIds){
            const user = await getUserDetails(userId.id);
            compareUsers.push(user)
        }
        
        const prompt = generateMatchingPrompt(targetUser, compareUsers);
        console.log({prompt})

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
    console.log({user_id})
    try {
        const suggestions = [];

        const blockedUsers = await BlockedUsers.findAll({
            where: {
                [Op.or]: [
                    { user_id: user_id },
                    { blocked_id: user_id }
                ],
            },
            raw: true
        })

        const mactchedUsers = await Matches.findAll({
            where: {
                [Op.or]: [
                    {
                        [Op.or]: [
                            { sender_id: user_id, status: 'rejected' },
                            { sender_id: user_id, status: 'accepted' },
                            { receiver_id: user_id, status: 'rejected' },
                            { receiver_id: user_id, status: 'accepted' },
                        ],
                    },
                    { sender_id: user_id, status: 'sent' },
                ],
                
            },
            raw: true
        })

        const blockedUserIds = blockedUsers.map((item) => item.user_id === user_id ? item.blocked_id : item.user_id)
        const matchedUserIds = mactchedUsers.map((item) => item.sender_id === user_id ? item.receiver_id : item.sender_id)

        const avoidUserIds = findUnique(blockedUserIds, matchedUserIds)

        console.log({avoidUserIds, blockedUserIds, matchedUserIds})

        const allUserIds = await Users.findAll({
            where: {
                is_active: true,
                id: {
                    [Op.notIn]: [user_id, ...avoidUserIds]
                }
            },
            attributes: ['id'],
            raw: true
        })

        let matchResult = []
        let idSuggestions = []
        if(allUserIds.length > 1) {
            try {
                matchResult = await matchUsers(user_id, allUserIds);
                console.log({matchResult})
                idSuggestions = matchResult.match(/\d+/g);
            } catch (error) {
                idSuggestions = allUserIds.map((item) => item.id)
            }
        } else {
            idSuggestions = allUserIds.map((item) => item.id)
        }
        
        
        console.log({idSuggestions})

        for(const rawuser of idSuggestions) {
            if(suggestions.length > 20) {
                break
            }

            const userInfo = await getProfile({user_id: rawuser})
            
            suggestions.push(userInfo.data)
        }

        console.log({suggestions})
        return Promise.resolve({
            message: 'Explore list',
            data: suggestions
        })
    } catch (error) {
        console.log({error})
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
            raw: true,
            order: [['last_message_date', 'DESC']],
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
        console.log({error})
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

        existMatch = await Matches.update({ status: 'rejected' }, {
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
                    const updatedMatches = await Matches.update({ status: 'accepted', conversation_id, response_date: new Date() }, {
                        where: {
                            id: existMatch.id
                        },
                    })

                    existMatch = await Matches.findOne({
                        where: {
                            id: existMatch.id
                        },
                        include: [
                            { model: Users, as: 'sender' },
                            { model: Users, as: 'receiver' },
                        ]
                    })

                    console.log({existMatch})

                    addNewNotification(user_id, friend_id, existMatch.id, 'new_match', 'You get new match!', 'Congratulation! You get new match!')
                    addNewNotification(friend_id, user_id, existMatch.id, 'new_match', 'You get new match!', 'Congratulation! You get new match!')
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

async function updateLastMessage({ user_id, conversation_id, last_message }) {
    try {
        const updatedMatch = await Matches.update({ last_message, last_message_date: new Date(), last_message_sender: user_id}, {
            where: {
                [Op.or]: [
                    { sender_id: user_id },
                    { receiver_id: user_id }
                ],
                conversation_id: conversation_id
            }
        })

        const existMatch = await Matches.findOne({
            where: {
                [Op.or]: [
                    { sender_id: user_id },
                    { receiver_id: user_id }
                ],
                conversation_id: conversation_id
            }
        })

        try {
            if(existMatch.sender_id === user_id) {
                addNewPushNotification(existMatch.receiver_id, existMatch.sender_id, existMatch.id, 'message', 'New message', last_message)
            } else {
                addNewPushNotification(existMatch.sender_id, existMatch.receiver_id, existMatch.id, 'message', 'New message', last_message)
            }
        } catch (error) {
            console.log({error})
        }

        return Promise.resolve({
            data: existMatch
        })
    } catch (error) {
        console.log({error})
        return Promise.resolve(error)
    }
}

module.exports = {
    getExploreList,
    getMatches,
    acceptSuggestion,
    rejectSuggestion,
    updateLastMessage
}