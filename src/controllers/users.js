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
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const UserPurpose = require('../models/user_purposes');
const UserInterest = require('../models/user_interests');
const BlockedUsers = require('../models/blocked_users');
const InactiveUsers = require('../models/inactive_users');
const Tags = require('../models/tags');
const Matches = require('../models/matches');
const { Op } = require('sequelize');
const ReportUsers = require('../models/report_users');
const ReviewUsers = require('../models/review_users');
const AppVersions = require('../models/versions');

async function updateProfile({ user_id, full_name, gender, location, pronouns, birthday, avatar, ...restParams
 }) {
    try {
        const updates = {...restParams};
        if (full_name) updates.full_name = full_name;
        if (gender) updates.gender = gender;
        if (location) updates.location = location;
        if (pronouns) updates.pronouns = pronouns;
        if (birthday) updates.birthday = birthday;
        // if (publicGender) updates.publicGender = publicGender;
        // if (publicPronouns) updates.publicPronouns = publicPronouns;
        // if (notificationEnable) updates.notificationEnable = notificationEnable;
        // if (subscribeEmail) updates.subscribeEmail = subscribeEmail;
        // if (emailNotificationEnable) updates.emailNotificationEnable = emailNotificationEnable;

        const updatedUser = await Users.update(updates, {
            where: { id: user_id },
            returning: true,
            plain: true,
        });

        const userInfo = await getUser(user_id)

        return Promise.resolve({
            data: userInfo,
            message: 'Update successfully'
        })
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error)
    }
}

async function getProfile({ user_id }) {
    try {
        const user = await Users.findOne({
            where: { id: user_id },
            attributes: { exclude: ['password'] },
            include: [
                { model: Purposes },
                { model: Interests },
                { model: Tags }
            ]
        });

        if (!user) {
            return Promise.reject('User not found')
        }

        return Promise.resolve({
            message: 'User info retrieved successfully',
            data: user,
        })
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error)
    }
}

async function getFriendProfile({ user_id, friend_id }) {
    try {
        const user = await Users.findOne({
            where: { id: friend_id },
            attributes: { exclude: ['password'] },
            include: [
                { model: Purposes },
                { model: Interests },
                { model: Tags }
            ]
        });

        const match = await Matches.findOne({
            where: {
                sender_id: user_id,
                receiver_id: friend_id
            },
            order: [['id', 'desc']]
        });

        if (!user) {
            return Promise.reject('User not found')
        }

        const blocked = await BlockedUsers.findOne({
            where: {
                [Op.or]: [
                    {
                        user_id: user_id,
                        blocked_id: friend_id
                    },
                    {
                        user_id: friend_id,
                        blocked_id: user_id
                    }
                ]
            },
        });

        if (blocked) {
            return Promise.resolve({
                message: 'User info retrieved successfully',
                data: {
                    blocked: true, user: {}, match: null
                },
            })
        }

        return Promise.resolve({
            message: 'User info retrieved successfully',
            data: {
                user, match
            },
        })
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error)
    }
}

async function getUser(user_id) {
    try {
        const user = await Users.findOne({
            where: { id: user_id },
            attributes: { exclude: ['password'] },
            include: [
                { model: Purposes },
                { model: Interests },
                { model: Tags }
            ]
        });

        if (!user) {
            return Promise.reject('User not found')
        }

        return Promise.resolve(user)
    } catch (error) {
        console.log('Error fetching user info:', error);
        return Promise.reject(error)
    }
}

async function blockUser({ user_id, friend_id }) {
    try {
        await BlockedUsers.create({
            user_id: user_id,
            blocked_id: friend_id
        })

        await Matches.update({ status: 'deleted' }, {
            where: {
                [Op.or]: [
                    { sender_id: user_id, receiver_id: friend_id },
                    { sender_id: friend_id, receiver_id: user_id }
                ]
            }
        })

        return Promise.resolve({
            message: "User has been blocked!"
        })
    } catch (error) {
        console.log('Error block user:', error);
        return Promise.reject(error)
    }
}

async function unblockUser({ user_id, friend_id }) {
    try {
        await BlockedUsers.destroy({
            where: {
                user_id: user_id,
                blocked_id: friend_id
            }
        })

        return Promise.resolve({
            message: "User has been unblocked!"
        })
    } catch (error) {
        console.log('Error block user:', error);
        return Promise.reject(error)
    }
}

async function getBlockedUsers({ user_id }) {
    try {
        const users = await BlockedUsers.findAll({
            where: {
                user_id: user_id
            },
            include: [
                { model: Users, as: 'blockedUser' }
            ]
        })

        return Promise.resolve({
            message: "User has been unblocked!",
            data: users
        })
    } catch (error) {
        console.log('Error block user:', error);
        return Promise.reject(error)
    }
}

async function deactiveAccount({ user_id }) {
    try {
        const updatedUser = await Users.update({ is_active: false }, {
            where: { id: user_id },
            returning: true,
            plain: true,
        });

        return Promise.resolve({
            message: "User has been deactived!",
            data: updatedUser
        })
    } catch (error) {
        console.log('Error deactive user:', error);
        return Promise.reject(error)
    }
}

async function deleteAccount({ user_id, reason }) {
    try {
        const user = await Users.findOne({
            where: {
                id: user_id
            },
            raw: true
        })
        delete user.id

        console.log({ user })

        await InactiveUsers.create({
            ...user,
            inactive_type: 'self-deleted',
            user_id: user_id,
            reason
        })

        const updatedUser = await Users.update({ is_active: false, email: `deletedAccount${user_id}@kuky.com` }, {
            where: {
                id: user_id
            },
        })

        return Promise.resolve({
            message: "User has been deleted!",
            data: updatedUser
        })
    } catch (error) {
        console.log('Error delete user:', error);
        return Promise.reject(error)
    }
}

async function reportUser({ user_id, reporter_id, reason }) {
    try {
        const reportUser = await ReportUsers.create({
            user_id,
            reason,
            reporter_id
        })

        return Promise.resolve({
            message: "User has been reported!",
            data: reportUser
        })
    } catch (error) {
        console.log('Error report user:', error);
        return Promise.reject(error)
    }
}

async function updateSessionToken({ user_id, session_id, session_token }) {
    try {
        const updatedSession = await Sessions.update({ session_token: session_token, last_active: new Date() }, {
            where: { user_id: user_id, id: session_id },
            plain: true,
        });

        return Promise.resolve({
            data: updatedSession,
            message: 'Update successfully'
        })
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error)
    }
}

async function reviewUser({ user_id, reviewer_id, rating, reason, note }) {
    try {
        await ReviewUsers.create({
            user_id, reviewer_id, rating, reason, note 
        })

        return Promise.resolve({
            message: "Review has been added"
        })
    } catch (error) {
        console.log('Error review user:', error);
        return Promise.reject(error)
    }
}

async function getLatestVersion() {
    try {
        const version = await AppVersions.findOne({
            order: [['id', 'desc']]
        })

        return Promise.resolve({
            message: "Latest version",
            data: version
        })
    } catch (error) {
        console.log('Error review user:', error);
        return Promise.reject(error)
    }
}

module.exports = {
    updateProfile,
    getUser,
    getProfile,
    blockUser,
    unblockUser,
    getBlockedUsers,
    deactiveAccount,
    deleteAccount,
    reportUser,
    updateSessionToken,
    getFriendProfile,
    reviewUser,
    getLatestVersion
}