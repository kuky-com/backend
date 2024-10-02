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
const UserPurpose = require('../models/user_purpose');
const UserInterest = require('../models/user_interest');
const BlockedUsers = require('../models/blocked_users');
const InactiveUsers = require('../models/inactive_users');

async function updateProfile({ user_id, full_name, gender, location, pronouns, birthday, avatar}) {
    try {
        const updates = {};
        if (full_name) updates.full_name = full_name;
        if (gender) updates.gender = gender;
        if (location) updates.location = location;
        if (pronouns) updates.pronouns = pronouns;
        if (birthday) updates.birthday = birthday;
        if (avatar) updates.avatar = avatar;

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
        console.error('Profile update error:', error);
        return Promise.reject(error)
    }
}

async function getProfile({user_id}) {
    try {
        const user = await Users.findOne({
            where: { id: user_id },
            attributes: {exclude: ['password']},
            include: [
                {model: Purposes},
                {model: Interests}
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
        console.error('Error fetching user info:', error);
        return Promise.reject(error)
    }
}


async function getUser(user_id) {
    try {
        const user = await Users.findOne({
            where: { id: user_id },
            attributes: {exclude: ['password']}
        });

        if (!user) {
            return Promise.reject('User not found')
        }

        return Promise.resolve(user)
    } catch (error) {
        console.error('Error fetching user info:', error);
        return Promise.reject(error)
    }
}

async function blockUser({user_id, friend_id}) {
    try {
        await BlockedUsers.create({
            user_id: user_id, 
            blocked_id: friend_id
        })

        return Promise.resolve({
            message: "User has been blocked!"
        })
    } catch (error) {
        console.error('Error block user:', error);
        return Promise.reject(error)
    }
}

async function unblockUser({user_id, friend_id}) {
    try {
        await BlockedUsers.delete({
            where: {
                user_id: user_id, 
                blocked_id: friend_id
            }
        })

        return Promise.resolve({
            message: "User has been unblocked!"
        })
    } catch (error) {
        console.error('Error block user:', error);
        return Promise.reject(error)
    }
}

async function getBlockedUsers({user_id}) {
    try {
        const users = await BlockedUsers.findAll({
            where: {
                user_id: user_id
            }
        })

        return Promise.resolve({
            message: "User has been unblocked!",
            data: users
        })
    } catch (error) {
        console.error('Error block user:', error);
        return Promise.reject(error)
    }
}

async function deactiveAccount({user_id}) {
    try {
        const updatedUser = await Users.update({is_active: false}, {
            where: { id: user_id },
            returning: true,
            plain: true,
        });
        // TODO: invalidate all session

        return Promise.resolve({
            message: "User has been deactived!",
            data: updatedUser
        })
    } catch (error) {
        console.error('Error deactive user:', error);
        return Promise.reject(error)
    }
}

async function deleteAccount({user_id}) {
    try {
        const user = await getUser(user_id)
        delete user.id

        await InactiveUsers.create({
            ...user,
            inactive_type: 'self-deleted',
            user_id: user_id
        })

        // TODO: invalidate all session

        await Users.delete({
            where: {
                id: user_id
            }
        })

        return Promise.resolve({
            message: "User has been deleted!",
            data: updatedUser
        })
    } catch (error) {
        console.error('Error delete user:', error);
        return Promise.reject(error)
    }
}

async function reportUser({user_id, reporter_id, reason}) {
    try {
        const reportUser = await BlockedUsers.create({
            user_id, 
            reason,
            reporter_id
        })

        return Promise.resolve({
            message: "User has been blocked!",
            data: reportUser
        })
    } catch (error) {
        console.error('Error report user:', error);
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
    
}