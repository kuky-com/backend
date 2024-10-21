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
const { Op, where, Sequelize } = require('sequelize');
const ReportUsers = require('../models/report_users');
const LeadUsers = require('../models/lead_users');
const { normalizePurposes } = require('./interests');
const UserPurposes = require('../models/user_purposes');
const Suggestions = require('../models/suggestions');
const emailService = require('./email')

async function createLeadUsers(users) {
    try {
        users.forEach(async user => {
            
            let purpose = await Purposes.findOne({
                where: {
                    name: user.purpose
                }
            })

            if(!purpose) {
                purpose = await Purposes.create({
                    name: user.purpose
                });
                await normalizePurposes(purpose.id)
            }

            let userInfo = await LeadUsers.findOne({
                where: {
                    email: user.email
                }
            })

            if(!userInfo) {
                await LeadUsers.create({
                    ...user,
                    purpose_id: purpose.id
                })
            } else {
                await LeadUsers.update({
                    ...user,
                    purpose_id: purpose.id
                }, {
                    where: {
                        email: user.email
                    }
                })
            }
        });

        const leadUsers = await LeadUsers.findAll()

        return Promise.resolve({
            data: leadUsers,
            message: 'Update successfully'
        })
    } catch (error) {
        console.error('Profile update error:', error);
        return Promise.reject(error)
    }
}

async function checkSuggestion({to_email, suggest_email}) {
    try {
        if(to_email === suggest_email) {
            return Promise.reject('To email and suggestion is same')
        }

        const suggestUser = await Users.findOne({
            where: {
                email: suggest_email
            }
        })

        if(!suggestUser) {
            return Promise.reject('Suggest user not exist')
        }

        if(!suggestUser) {
            return Promise.reject('Suggest user not exist')
        }

        const user = await Users.findOne({
            where: {
                email: to_email
            }
        })

        const suggestPurposes = await UserPurposes.findAll({
            where: { user_id: suggestUser.id },
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

        let to_email_purposes = []
        const suggest_email_purposes = suggestPurposes.map(up => up.name)

        if(user) {
            let existMatch = await Matches.findOne({
                where: {
                    [Op.or]: [
                        { sender_id: user.id, receiver_id: suggestUser.id },
                        { sender_id: suggestUser.id, receiver_id: user.id }
                    ]
                }
            })

            if(existMatch) {
                return Promise.reject('These 2 people has already connected.')
            }

            const toPurposes = await UserPurposes.findAll({
                where: { user_id: user.id },
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

            to_email_purposes = toPurposes.map(up => up.name)
        } else {
            const leadUser = await LeadUsers.findOne({
                where: {
                    email: to_email
                }
            })

            if(!leadUser) {
                return Promise.reject(`Dont have information about ${to_email}!`)
            }

            to_email_purposes = [leadUser.purpose]
        }

        return Promise.resolve({
            data: {
                to_email_purposes,
                suggest_email_purposes,
                to_email_registered: user !== null
            },
            message: 'This suggestion is valid!'
        })
    } catch (error) {
        console.error('Profile update error:', error);
        return Promise.reject(error)
    }
}

async function sendSuggestion({to_email, suggest_email}) {
    try {

        if(to_email === suggest_email) {
            return Promise.reject('To email and suggestion is same')
        }

        const suggestUser = await Users.findOne({
            where: {
                email: suggest_email
            }
        })

        if(!suggestUser) {
            return Promise.reject('Suggest user not exist')
        }

        if(!suggestUser) {
            return Promise.reject('Suggest user not exist')
        }

        const user = await Users.findOne({
            where: {
                email: to_email
            }
        })

        const suggestPurposes = await UserPurposes.findAll({
            where: { user_id: suggestUser.id },
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

        let to_email_purposes = []
        let to_full_name = ''
        const suggest_email_purposes = suggestPurposes.map(up => up.name)

        if(user) {
            let existMatch = await Matches.findOne({
                where: {
                    [Op.or]: [
                        { sender_id: user.id, receiver_id: suggestUser.id },
                        { sender_id: suggestUser.id, receiver_id: user.id }
                    ]
                }
            })

            if(existMatch) {
                return Promise.reject('These 2 people has already connected.')
            }

            const toPurposes = await UserPurposes.findAll({
                where: { user_id: user.id },
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

            to_email_purposes = toPurposes.map(up => up.name)
            to_full_name = user.full_name
        } else {
            const leadUser = await LeadUsers.findOne({
                where: {
                    email: to_email
                }
            })

            if(!leadUser) {
                return Promise.reject(`Dont have information about ${to_email}!`)
            }

            to_email_purposes = [leadUser.purpose]
            to_full_name= leadUser.full_name
        }

        const suggestion = await Suggestions.create({
            email: to_email,
            friend_id: suggestUser.id
        })

        await emailService.sendSuggestEmail({
            to_email,
            suggest_purposes: suggest_email_purposes,
            suggest_name: suggestUser.full_name,
            to_purposes: to_email_purposes,
            to_name: to_full_name,
            suggest_id: suggestUser.id
        })

        return Promise.resolve({
            data: suggestion,
            message: 'Suggestion email sent!'
        })
    } catch (error) {
        console.error('Profile update error:', error);
        return Promise.reject(error)
    }
}


module.exports = {
    createLeadUsers,
    checkSuggestion,
    sendSuggestion
}