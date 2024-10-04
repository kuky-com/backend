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
const Sessions = require('../models/sessions');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

async function getNotificationList({ user_id }) {
    try {
        const notifications = await Notification.findAll({
            where: { user_id: user_id },
            order: [['notification_date', 'DESC']],
          });

        return Promise.resolve({
            message: 'Notification list success',
            data: notifications
        })
    } catch (error) {
        console.log({error})
        return Promise.resolve(error)
    }
}

async function markNotificationAsSeen({ user_id, notification_id }) {
    try {
        const updateNotification = await Notification.update(
            { seen: true },
            { where: { id: notification_id, user_id: user_id } }
          )

        return Promise.resolve({
            message: 'Notification update success',
            data: updateNotification
        })
    } catch (error) {
        console.log({error})
        return Promise.resolve(error)
    }
}

async function markAllNotificationsAsSeen({ user_id }) {
    try {
        const notifications = await Notification.update(
            { seen: true },
            { where: { user_id: user_id, seen: false } }
          )
        return Promise.resolve({
            message: 'Notification list success',
            data: notifications
        })
    } catch (error) {
        console.log({error})
        return Promise.resolve(error)
    }
}

async function markAllNotificationsAsSeen({ user_id }) {
    try {
        const unseenCount = await Notification.count({
            where: { user_id: user_id, seen: false },
          })

        return Promise.resolve({
            message: 'Get unseeon count success',
            data: unseenCount
        })
    } catch (error) {
        console.log({error})
        return Promise.resolve(error)
    }
}

async function addNewNotification({ user_id, sender_id, match_id, type, title, content }) {
    try {
        const newNotification = await Notification.create({
            user_id: user_id,
            sender_id: sender_id,
            match_id: match_id,
            notification_type: type,
            content,
            title,
        })

        const sessions = Sessions.findAll({
            where: {
                user_id: user_id,
                session_token: {
                    [Op.ne]: null
                }
            },
            attributes: ['session_token'],
            raw: true
        })

        const sessionTokens = sessions.map((item) => item.session_token)

        if(sessionTokens.length > 0) {    
            admin.messaging().sendEachForMulticast({
                notification: {
                    title: title, 
                    body: content
                },
                tokens: sessionTokens
            })
        }        

        return Promise.resolve({
            message: 'New notification created',
            data: newNotification
        })
    } catch (error) {
        console.log({error})
        return Promise.resolve(error)
    }
}

module.exports = {
    getNotificationList,
    markNotificationAsSeen,
    markAllNotificationsAsSeen,
    addNewNotification
}