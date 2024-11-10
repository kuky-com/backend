const Users = require('@/models/users');
const VerificationCode = require('@/models/verification_code');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto');
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
const { Op, where, Sequelize } = require('sequelize');
const ReportUsers = require('../models/report_users');
const LeadUsers = require('../models/lead_users');
const { normalizePurposes } = require('./interests');
const UserPurposes = require('../models/user_purposes');
const Suggestions = require('../models/suggestions');
const emailService = require('./email');
const {
    addNewNotification,
    addNewPushNotification,
} = require('./notifications');
const AdminUsers = require('../models/admin_users');
const AdminSessions = require('../models/admin_sessions');
const AppVersions = require('../models/versions');

function generateToken(session_id, admin_id) {
    return jwt.sign({ session_id, admin_id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
}

async function createLeadUsers(users) {
    try {
        users.forEach(async (user) => {
            let purpose = await Purposes.findOne({
                where: {
                    name: user.purpose,
                },
            });

            if (!purpose) {
                purpose = await Purposes.create({
                    name: user.purpose,
                });
                await normalizePurposes(purpose.id);
            }

            let userInfo = await LeadUsers.findOne({
                where: {
                    email: user.email,
                },
            });

            if (!userInfo) {
                await LeadUsers.create({
                    ...user,
                    purpose_id: purpose.id,
                });
            } else {
                await LeadUsers.update(
                    {
                        ...user,
                        purpose_id: purpose.id,
                    },
                    {
                        where: {
                            email: user.email,
                        },
                    }
                );
            }
        });

        const leadUsers = await LeadUsers.findAll();

        return Promise.resolve({
            data: leadUsers,
            message: 'Update successfully',
        });
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error);
    }
}

async function checkSuggestion({ to_email, suggest_email }) {
    try {
        if (to_email === suggest_email) {
            return Promise.reject('To email and suggestion is same');
        }

        const suggestUser = await Users.findOne({
            where: {
                email: suggest_email,
            },
        });

        if (!suggestUser) {
            return Promise.reject('Suggest user not exist');
        }

        if (!suggestUser) {
            return Promise.reject('Suggest user not exist');
        }

        const user = await Users.findOne({
            where: {
                email: to_email,
            },
        });

        const suggestPurposes = await UserPurposes.findAll({
            where: { user_id: suggestUser.id },
            attributes: {
                include: [[Sequelize.col('purpose.name'), 'name']],
            },
            include: [{
                model: Purposes, attributes: [['name', 'name']],
                where: {
                    normalized_purpose_id: {
                        [Op.ne]: null
                    }
                }
            }],
            raw: true,
        });

        let to_email_purposes = [];
        const suggest_email_purposes = suggestPurposes.map((up) => up.name);
        console.log('SUGGEST', suggest_email_purposes);
        if (user) {
            let existMatch = await Matches.findOne({
                where: {
                    [Op.or]: [
                        { sender_id: user.id, receiver_id: suggestUser.id },
                        { sender_id: suggestUser.id, receiver_id: user.id },
                    ],
                },
            });

            if (existMatch) {
                return Promise.reject('These 2 people has already connected.');
            }

            const toPurposes = await UserPurposes.findAll({
                where: { user_id: user.id },
                attributes: {
                    include: [[Sequelize.col('purpose.name'), 'name']],
                },
                include: [{
                    model: Purposes, attributes: [['name', 'name']],
                    where: {
                        normalized_purpose_id: {
                            [Op.ne]: null
                        }
                    }
                }],
                raw: true,
            });

            to_email_purposes = toPurposes.map((up) => up.name);
        } else {
            const leadUser = await LeadUsers.findOne({
                where: {
                    email: to_email,
                },
            });

            if (!leadUser) {
                return Promise.reject(
                    `Dont have information about ${to_email}!`
                );
            }

            to_email_purposes = [leadUser.purpose];
        }

        return Promise.resolve({
            data: {
                to_email_purposes,
                suggest_email_purposes,
                to_email_registered: user !== null,
            },
            message: 'This suggestion is valid!',
        });
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error);
    }
}

async function sendSuggestion({ to_email, suggest_email }) {
    try {
        if (to_email === suggest_email) {
            return Promise.reject('To email and suggestion is same');
        }

        const suggestUser = await Users.findOne({
            where: {
                email: suggest_email,
            },
        });

        if (!suggestUser) {
            return Promise.reject('Suggest user not exist');
        }

        if (!suggestUser) {
            return Promise.reject('Suggest user not exist');
        }

        const user = await Users.findOne({
            where: {
                email: to_email,
            },
        });

        const suggestPurposes = await UserPurposes.findAll({
            where: { user_id: suggestUser.id },
            attributes: {
                include: [[Sequelize.col('purpose.name'), 'name']],
            },
            include: [{
                model: Purposes, attributes: [['name', 'name']],
                where: {
                    normalized_purpose_id: {
                        [Op.ne]: null
                    }
                }
            }],
            raw: true,
        });

        let to_email_purposes = [];
        let to_full_name = '';
        const suggest_email_purposes = suggestPurposes.map((up) => up.name);

        if (user) {
            let existMatch = await Matches.findOne({
                where: {
                    [Op.or]: [
                        { sender_id: user.id, receiver_id: suggestUser.id },
                        { sender_id: suggestUser.id, receiver_id: user.id },
                    ],
                },
            });

            if (existMatch) {
                return Promise.reject('These 2 people has already connected.');
            }

            const toPurposes = await UserPurposes.findAll({
                where: { user_id: user.id },
                attributes: {
                    include: [[Sequelize.col('purpose.name'), 'name']],
                },
                include: [{
                    model: Purposes, attributes: [['name', 'name']],
                    where: {
                        normalized_purpose_id: {
                            [Op.ne]: null
                        }
                    }
                }],
                raw: true,
            });

            to_email_purposes = toPurposes.map((up) => up.name);
            to_full_name = user.full_name;

            addNewNotification(
                user.id,
                suggestUser.id,
                null,
                suggestUser.id,
                'new_suggestions',
                'New suggestion',
                `You and ${suggestUser.full_name} are on the same journey.`
            );
            addNewPushNotification(
                user.id,
                null,
                suggestUser,
                'new_suggestions',
                'New suggestion',
                `You and ${suggestUser.full_name} are on the same journey.`
            );
        } else {
            const leadUser = await LeadUsers.findOne({
                where: {
                    email: to_email,
                },
            });

            if (!leadUser) {
                return Promise.reject(
                    `Dont have information about ${to_email}!`
                );
            }

            to_email_purposes = [leadUser.purpose];
            to_full_name = leadUser.full_name;
        }

        const suggestion = await Suggestions.create({
            email: to_email,
            friend_id: suggestUser.id,
        });

        await emailService.sendSuggestEmail({
            to_email,
            suggest_purposes: suggest_email_purposes,
            suggest_name: suggestUser.full_name,
            to_purposes: to_email_purposes,
            to_name: to_full_name,
            suggest_id: suggestUser.id,
        });

        return Promise.resolve({
            data: suggestion,
            message: 'Suggestion email sent!',
        });
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error);
    }
}

async function createAdmin({ full_name, username, password }) {
    try {
        const existingUser = await AdminUsers.findOne({ where: { username } });
        if (existingUser) {
            return Promise.reject('Username already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await AdminUsers.create({
            full_name,
            username,
            password: hashedPassword,
            is_active: false,
        });

        return Promise.resolve({ message: 'Admin account created!' });
    } catch (error) {
        console.log({ error });
        return Promise.reject(error);
    }
}

async function login({ username, password }) {
    try {
        const admin = await AdminUsers.findOne({ where: { username } });

        if (!admin) {
            return Promise.reject('Admin not found');
        }

        if (!admin.is_active) {
            return Promise.reject('Admin not verified');
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return Promise.reject('Invalid username or password');
        }

        const newSession = await AdminSessions.create({
            admin_id: admin.id,
            platform: 'web',
            login_date: new Date(),
        });

        const token = generateToken(newSession.id, admin.id);

        return Promise.resolve({
            data: {
                admin,
                token,
            },
            message: 'Login successful',
        });
    } catch (error) {
        console.log(error);
        return Promise.reject('Login failed! Please try again!');
    }
}

async function getUsers({ page = 1, limit = 20 }) {
    try {
        const offset = (page - 1) * limit;

        const { count, rows } = await Users.findAndCountAll();

        const users = await Users.findAll({
            limit: limit,
            offset: offset,
            order: [['id', 'DESC']],
            include: [
                {
                    model: Purposes,
                    attributes: ['name'],
                },
                {
                    model: Interests,
                },
            ],
        });
        console.log(users);

        return Promise.resolve({
            data: {
                total: count,
                users,
            },
            message: 'Users list',
        });
    } catch (error) {
        console.log(error);
        return Promise.reject('Login failed! Please try again!');
    }
}

async function profileAction({ status, reason, user_id }) {
    try {
        if (status === 'rejected' && !reason) {
            return Promise.reject('Reject profile require reason');
        }

        const user = await Users.findOne({
            where: {
                id: user_id,
            },
        });

        if (!user) {
            return Promise.reject('User not exist');
        }

        await Users.update(
            status === 'rejected' ?
                {
                    profile_approved: 'rejected',
                    profile_rejected_reason: reason,
                    profile_action_date: new Date()
                } :
                {
                    profile_approved: status,
                    profile_action_date: new Date()
                },
            {
                where: {
                    id: user_id,
                },
            }
        );

        if (status === 'approved') {
            addNewNotification(
                user.id,
                null,
                null,
                null,
                'profile_approved',
                'Your profile has been approved',
                'Your account has been approved, and you’re all set to start connecting on Kuky.'
            );
            addNewPushNotification(
                user.id,
                null,
                null,
                'profile_approved',
                'Your profile has been approved',
                `Your account has been approved, and you’re all set to start connecting on Kuky.`
            );
        } else {
            addNewNotification(
                user.id,
                null,
                null,
                null,
                'profile_rejected',
                'Your profile has been rejected',
                `Unfortunately, your account couldn’t be approved at this time due to the following reason: ${reason}.`
            );
            addNewPushNotification(
                user.id,
                null,
                null,
                'profile_rejected',
                'Your profile has been rejected',
                `Unfortunately, your account couldn’t be approved at this time due to the following reason: ${reason}.`
            );
        }

        return Promise.resolve({
            message: 'Profile updated!',
        });
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error);
    }
}

async function addVersion({ version_ios, version_android, is_required, description, version_title }) {
    try {
        const version = await AppVersions.create({
            version_ios,
            version_android,
            is_required,
            description,
            version_title
        })

        return Promise.resolve({
            message: 'Version added!',
            data: version
        });
    } catch (error) {
        console.log('Profile update error:', error);
        return Promise.reject(error);
    }
}

module.exports = {
    createLeadUsers,
    checkSuggestion,
    sendSuggestion,
    createAdmin,
    login,
    getUsers,
    profileAction,
    addVersion
};
