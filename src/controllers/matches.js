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

// var serviceAccount = require("../config/serviceAccountKey.json");
const { getProfile } = require('./users');
const BlockedUsers = require('../models/blocked_users');
const { findUnique } = require('../utils/utils');
const { addNewNotification, addNewPushNotification } = require('./notifications');
const { sendRequestEmail } = require('./email');


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
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
    let prompt = `I have target person with information about likes, dislikes, and purposes.
  
    Target person Likes: ${targetUser.interests.filter(i => i.type === 'like').map(i => i.name).join(', ')}
    Target person Dislikes: ${targetUser.interests.filter(i => i.type === 'dislike').map(i => i.name).join(', ')}
    Target person Purposes: ${targetUser.purposes.join(', ')}

    Then I have list of several people with their likes, dislikes, and purposes. I want to get order of people that best match with
    my target person, sort from best match to lower: `

    for (const user of compareUsers) {
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

        for (const userId of compareIds) {
            const user = await getUserDetails(userId.id);
            compareUsers.push(user)
        }

        const prompt = generateMatchingPrompt(targetUser, compareUsers);

        const response = await openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt: prompt,
            max_tokens: 150,
            temperature: 0.7
        });

        return response.choices[0].text.trim();
    } catch (error) {
        console.log('Error matching users:', error);
        throw error;
    }
}

async function findLessMatches({ user_id }) {
    try {
        const currentUser = await Users.findByPk(user_id);

        if (!currentUser) {
            return Promise.reject('User not found')
        }

        const currentUserProfileTag = currentUser.profile_tag;

        const currentUserInterests = await Interests.findAll({
            include: [{
                model: UserInterests,
                where: { user_id: user_id, interest_type: 'like' },
                attributes: [],
            }],
            attributes: ['normalized_interest_id'],
            group: ['interests.normalized_interest_id', 'interests.id'],
        });

        const currentUserInterestGroupIds = currentUserInterests.map(interest => interest.normalized_interest_id);

        const currentUserDislikes = await Interests.findAll({
            include: [{
                model: UserInterests,
                where: { user_id: user_id, interest_type: 'dislike' },
                attributes: [],
            }],
            attributes: ['normalized_interest_id'],
            group: ['interests.normalized_interest_id', 'interests.id'],
        });

        const currentUserDislikeGroupIds = currentUserDislikes.map(interest => interest.normalized_interest_id);

        const currentUserPurposes = await Purposes.findAll({
            include: [{
                model: UserPurposes,
                where: { user_id: user_id },
                attributes: [],
            }],
            attributes: ['normalized_purpose_id'],
            group: ['purposes.normalized_purpose_id', 'purposes.id'],
        });

        const currentUserPurposeGroupIds = currentUserPurposes.map(purpose => purpose.normalized_purpose_id);

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
                            { sender_id: user_id, status: 'deleted' },
                            { receiver_id: user_id, status: 'rejected' },
                            { receiver_id: user_id, status: 'accepted' },
                            { receiver_id: user_id, status: 'deleted' },
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

        const matchingUsers = await Users.findAll({
            where: {
                is_active: true,
                is_hidden_users: false,
                profile_approved: true,
                profile_tag: {
                    [Op.ne]: null
                },
                id: { [Op.notIn]: [user_id, ...avoidUserIds] },
            },
            attributes: ['id', 'profile_tag'],
        });

        const matchedUsersWithScores = [];

        for (const user of matchingUsers) {
            const userId = user.id;

            const userInterests = await Interests.findAll({
                include: [{
                    model: UserInterests,
                    where: { user_id: userId, interest_type: 'like' },
                    attributes: [],
                }],
                attributes: ['normalized_interest_id'],
                group: ['interests.normalized_interest_id', 'interests.id'],
            });

            const userInterestGroupIds = userInterests.map(interest => interest.normalized_interest_id);

            const userDislikes = await Interests.findAll({
                include: [{
                    model: UserInterests,
                    where: { user_id: userId, interest_type: 'dislike' },
                    attributes: [],
                }],
                attributes: ['normalized_interest_id'],
                group: ['interests.normalized_interest_id', 'interests.id'],
            });

            const userDislikeGroupIds = userDislikes.map(interest => interest.normalized_interest_id);

            const userPurposes = await Purposes.findAll({
                include: [{
                    model: UserPurposes,
                    where: { user_id: userId },
                    attributes: [],
                }],
                attributes: ['normalized_purpose_id'],
                group: ['purposes.normalized_purpose_id', 'purposes.id'],
            });

            const userPurposeGroupIds = userPurposes.map(purpose => purpose.normalized_purpose_id);

            const matchingInterestGroupIds = currentUserInterestGroupIds.filter(groupId =>
                userInterestGroupIds.includes(groupId)
            );

            const matchingDislikeGroupIds = currentUserDislikeGroupIds.filter(groupId =>
                userDislikeGroupIds.includes(groupId)
            );

            const matchingPurposeGroupIds = currentUserPurposeGroupIds.filter(groupId =>
                userPurposeGroupIds.includes(groupId)
            );

            if (user.profile_tag !== currentUserProfileTag && matchingDislikeGroupIds.length === 0 &&
                matchingInterestGroupIds.length === 0 && matchingPurposeGroupIds.length === 0) {
                matchedUsersWithScores.push({
                    user_id: userId,
                });
            }
        }

        const suggestions = []
        for (const rawuser of matchedUsersWithScores) {
            if (suggestions.length > 20) {
                break
            }

            const userInfo = await getProfile({ user_id: rawuser.user_id })

            suggestions.push(userInfo.data)
        }

        return Promise.resolve({
            message: 'Less matches list',
            data: suggestions
        })
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function findBestMatches({ user_id, page = 1, limit = 20 }) {
    try {
        const currentUser = await Users.findByPk(user_id);

        if (!currentUser) {
            return Promise.reject('User not found')
        }

        const currentUserProfileTag = currentUser.profile_tag;

        const currentUserInterests = await Interests.findAll({
            include: [{
                model: UserInterests,
                where: { user_id: user_id, interest_type: 'like' },
                attributes: [],
            }],
            attributes: ['normalized_interest_id'],
            group: ['interests.normalized_interest_id', 'interests.id'],
        });

        const currentUserInterestGroupIds = currentUserInterests.map(interest => interest.normalized_interest_id);

        const currentUserDislikes = await Interests.findAll({
            include: [{
                model: UserInterests,
                where: { user_id: user_id, interest_type: 'dislike' },
                attributes: [],
            }],
            attributes: ['normalized_interest_id'],
            group: ['interests.normalized_interest_id', 'interests.id'],
        });

        const currentUserDislikeGroupIds = currentUserDislikes.map(interest => interest.normalized_interest_id);

        const currentUserPurposes = await Purposes.findAll({
            include: [{
                model: UserPurposes,
                where: { user_id: user_id },
                attributes: [],
            }],
            attributes: ['normalized_purpose_id'],
            group: ['purposes.normalized_purpose_id', 'purposes.id'],
        });

        const currentUserPurposeGroupIds = currentUserPurposes.map(purpose => purpose.normalized_purpose_id);

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
                            { sender_id: user_id, status: 'deleted' },
                            { receiver_id: user_id, status: 'rejected' },
                            { receiver_id: user_id, status: 'accepted' },
                            { receiver_id: user_id, status: 'deleted' },
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

        const matchingUsers = await Users.findAll({
            where: {
                is_active: true,
                is_hidden_users: false,
                profile_approved: true,
                profile_tag: {
                    [Op.ne]: null
                },
                id: { [Op.notIn]: [user_id, ...avoidUserIds] },
            },
            attributes: ['id', 'profile_tag'],
        });

        const matchedUsersWithScores = [];

        for (const user of matchingUsers) {
            const userId = user.id;

            const userInterests = await Interests.findAll({
                include: [{
                    model: UserInterests,
                    where: { user_id: userId, interest_type: 'like' },
                    attributes: [],
                }],
                attributes: ['normalized_interest_id'],
                group: ['interests.normalized_interest_id', 'interests.id'],
            });

            const userInterestGroupIds = userInterests.map(interest => interest.normalized_interest_id);

            const userDislikes = await Interests.findAll({
                include: [{
                    model: UserInterests,
                    where: { user_id: userId, interest_type: 'dislike' },
                    attributes: [],
                }],
                attributes: ['normalized_interest_id'],
                group: ['interests.normalized_interest_id', 'interests.id'],
            });

            const userDislikeGroupIds = userDislikes.map(interest => interest.normalized_interest_id);

            const userPurposes = await Purposes.findAll({
                include: [{
                    model: UserPurposes,
                    where: { user_id: userId },
                    attributes: [],
                }],
                attributes: ['normalized_purpose_id'],
                group: ['purposes.normalized_purpose_id', 'purposes.id'],
            });

            const userPurposeGroupIds = userPurposes.map(purpose => purpose.normalized_purpose_id);

            const matchingInterestGroupIds = currentUserInterestGroupIds.filter(groupId =>
                userInterestGroupIds.includes(groupId)
            );

            const matchingDislikeGroupIds = currentUserDislikeGroupIds.filter(groupId =>
                userDislikeGroupIds.includes(groupId)
            );

            const matchingPurposeGroupIds = currentUserPurposeGroupIds.filter(groupId =>
                userPurposeGroupIds.includes(groupId)
            );

            if (user.profile_tag === currentUserProfileTag || matchingDislikeGroupIds.length > 0 || matchingInterestGroupIds.length > 0 || matchingPurposeGroupIds.length > 0) {
                let score = 0;

                if (user.profile_tag === currentUserProfileTag)
                    score += 10;

                score += matchingInterestGroupIds.length * 2;

                score += matchingDislikeGroupIds.length * 2;

                score += matchingPurposeGroupIds.length * 3;

                matchedUsersWithScores.push({
                    user_id: userId,
                    score: score,
                    matchingDislikeGroupIds: matchingDislikeGroupIds,
                    matchingInterestGroupIds: matchingInterestGroupIds,
                    matchingPurposeGroupIds: matchingPurposeGroupIds,
                });
            }
        }

        matchedUsersWithScores.sort((a, b) => b.score - a.score);

        const suggestions = []

        for(var i = (Math.max(page -1, 0) * limit); i < Math.min((Math.max(page -1, 0) * limit) + limit, matchedUsersWithScores.length); i++) {
            const rawuser = matchedUsersWithScores[i]
            const userInfo = await getProfile({ user_id: rawuser.user_id })

            suggestions.push(userInfo.data)
        }
        // for (const rawuser of matchedUsersWithScores) {
        //     if (suggestions.length > 20) {
        //         break
        //     }

        //     const userInfo = await getProfile({ user_id: rawuser.user_id })

        //     suggestions.push(userInfo.data)
        // }

        return Promise.resolve({
            message: 'Best matches list',
            data: suggestions
        })
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function getExploreList({ user_id }) {
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
                            { sender_id: user_id, status: 'deleted' },
                            { receiver_id: user_id, status: 'rejected' },
                            { receiver_id: user_id, status: 'accepted' },
                            { receiver_id: user_id, status: 'deleted' },
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

        const allUserIds = await Users.findAll({
            where: {
                is_active: true,
                is_hidden_users: false,
                profile_approved: true,
                profile_tag: {
                    [Op.ne]: null
                },
                id: {
                    [Op.notIn]: [user_id, ...avoidUserIds]
                }
            },
            attributes: ['id'],
            raw: true
        })

        let matchResult = []
        let idSuggestions = []
        if (allUserIds.length > 1) {
            try {
                matchResult = await matchUsers(user_id, allUserIds);
                idSuggestions = matchResult.match(/\d+/g);
            } catch (error) {
                idSuggestions = allUserIds.map((item) => item.id)
            }
        } else {
            idSuggestions = allUserIds.map((item) => item.id)
        }

        for (const rawuser of idSuggestions) {
            if (suggestions.length > 20) {
                break
            }

            const userInfo = await getProfile({ user_id: rawuser })

            suggestions.push(userInfo.data)
        }

        return Promise.resolve({
            message: 'Explore list',
            data: suggestions
        })
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function getMatches({ user_id }) {
    try {
        const matches = await Matches.findAll({
            where: {
                [Op.or]: [
                    { sender_id: user_id, status: 'sent' },
                    { sender_id: user_id, status: 'accepted' },
                    { receiver_id: user_id, status: 'sent' },
                    { receiver_id: user_id, status: 'accepted' }
                ]
            },
            include: [
                { model: Users, as: 'sender' },
                { model: Users, as: 'receiver' },
            ],
            order: [['last_message_date', 'DESC']],
        })
        const finalMatches = []
        for (const match of matches) {
            if (match.get('sender_id') === user_id) {
                const userInfo = await getProfile({ user_id: match.get('receiver_id') })
                finalMatches.push({ ...match.toJSON(), profile: userInfo.data })
            } else {
                const userInfo = await getProfile({ user_id: match.get('sender_id') })
                finalMatches.push({ ...match.toJSON(), profile: userInfo.data })
            }
        }

        return Promise.resolve({
            message: 'Matches list',
            data: finalMatches
        })
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
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
        return Promise.reject(error)
    }
}

async function disconnect({ id, user_id, friend_id }) {
    try {
        let existMatch = await Matches.findOne({
            where: {
                [Op.or]: [
                    { sender_id: user_id, receiver_id: friend_id, id },
                    { sender_id: friend_id, receiver_id: user_id, id }
                ]
            }
        })

        if (existMatch) {
            existMatch = await Matches.update({ status: 'deleted' }, {
                where: { id: id }
            })

            return Promise.resolve({
                message: 'Connection deleted',
                data: existMatch
            })
        }

        return Promise.reject('Connection not found!')
    } catch (error) {
        return Promise.reject(error)
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

        const requestUser = await Users.findOne({
            where: { id: user_id }
        })

        if(requestUser && !requestUser.profile_approved) {
            return Promise.reject('Your account is almost ready! While we complete the approval, feel free to browse and get familiar with other profiles. You’ll be connecting soon!')
        }

        if (!existMatch) {
            const conversation_id = await createConversation(user_id, friend_id)
            if (conversation_id) {
                existMatch = await Matches.create({
                    sender_id: user_id,
                    receiver_id: friend_id,
                    status: 'sent',
                    conversation_id,
                    last_message_date: new Date()
                })

                
                if (requestUser) {
                    addNewNotification(friend_id, user_id, existMatch.id, null, 'new_request', 'You get new connect request.', `${requestUser.full_name} wants to connect with you!`)
                    addNewPushNotification(friend_id, existMatch, null, 'notification', 'New connect request!', `${requestUser.full_name} wants to connect with you!`)

                    try {
                        const senderPurposes = await UserPurposes.findAll({
                            where: { user_id: user_id },
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

                        const sender_purposes = senderPurposes.map(up => up.name)

                        const receiverPurposes = await UserPurposes.findAll({
                            where: { user_id: user_id },
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

                        const receiver_purposes = receiverPurposes.map(up => up.name)

                        const receiveUser = await Users.findOne({
                            where: { id: friend_id }
                        })

                        sendRequestEmail({
                            to_email: receiveUser.email, 
                            to_name: receiveUser.full_name,
                            to_purposes: receiver_purposes,
                            sender_name: requestUser.full_name,
                            sender_purposes: sender_purposes,
                            conversation_id
                        })
                    } catch (error) {
                        
                    }
                }
            }
        } else {
            if (existMatch.status === 'sent') {
                // const conversation_id = await createConversation(user_id, friend_id)
                // if (conversation_id) {
                //     const updatedMatches = await Matches.update({ status: 'accepted', conversation_id, response_date: new Date() }, {
                //         where: {
                //             id: existMatch.id
                //         },
                //     })

                const updatedMatches = await Matches.update({ status: 'accepted', last_message_date: new Date(), response_date: new Date() }, {
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
                    ],
                })

                if (existMatch.get('sender_id') === user_id) {
                    const userInfo = await getProfile({ user_id: existMatch.get('receiver_id') })
                    existMatch = { ...existMatch.toJSON(), profile: userInfo.data }
                } else {
                    const userInfo = await getProfile({ user_id: existMatch.get('sender_id') })
                    existMatch = { ...existMatch.toJSON(), profile: userInfo.data }
                }

                addNewNotification(user_id, friend_id, existMatch.id, null, 'new_match', 'You get new match!', 'Congratulation! You get new match!')
                addNewNotification(friend_id, user_id, existMatch.id, null, 'new_match', 'You get new match!', 'Congratulation! You get new match!')

                addNewPushNotification(user_id, existMatch, null, 'message', 'You get new match!', 'Congratulation! You get new match!')
                addNewPushNotification(friend_id, existMatch, null, 'message', 'You get new match!', 'Congratulation! You get new match!')
                // }
            }
        }

        return Promise.resolve({
            message: 'Suggestion accepted',
            data: existMatch
        })
    } catch (error) {
        return Promise.reject(error)
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
        console.log('Error creating conversation: ', error);
        throw new Error('Failed to create conversation');
    }
}

async function updateLastMessage({ user_id, conversation_id, last_message }) {
    try {
        const updatedMatch = await Matches.update({ last_message, last_message_date: new Date(), last_message_sender: user_id }, {
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
            },
            include: [
                { model: Users, as: 'sender' },
                { model: Users, as: 'receiver' },
            ]
        })

        try {
            if (existMatch.sender_id === user_id) {
                addNewPushNotification(existMatch.receiver_id, existMatch.toJSON(), null, 'message', existMatch.sender?.full_name ?? 'New message', last_message)
            } else {
                addNewPushNotification(existMatch.sender_id, existMatch.toJSON(), null, 'message', existMatch.receiver?.full_name ?? 'New message', last_message)
            }
        } catch (error) {
            console.log({ error })
        }

        return Promise.resolve({
            data: existMatch
        })
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function getConversation({ user_id, conversation_id }) {
    try {
        const match = await Matches.findOne({
            where: {
                [Op.or]: [
                    { sender_id: user_id, conversation_id },
                    { receiver_id: user_id, conversation_id }
                ]
            },
            include: [
                { model: Users, as: 'sender' },
                { model: Users, as: 'receiver' },
            ]
        })

        if (!match) {
            return Promise.reject('Connection not found!')
        }

        if (match.get('sender_id') === user_id) {
            const userInfo = await getProfile({ user_id: match.get('receiver_id') })

            return Promise.resolve({
                message: 'Conversation detail',
                data: { ...match.toJSON(), profile: userInfo.data }
            })
        } else {
            const userInfo = await getProfile({ user_id: match.get('sender_id') })

            return Promise.resolve({
                message: 'Conversation detail',
                data: { ...match.toJSON(), profile: userInfo.data }
            })
        }

        
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

module.exports = {
    getExploreList,
    getMatches,
    acceptSuggestion,
    rejectSuggestion,
    updateLastMessage,
    disconnect,
    findBestMatches,
    findLessMatches,
    getConversation
}