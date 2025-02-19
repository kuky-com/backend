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
const usersController = require('./users')
const appleSigninAuth = require('apple-signin-auth');
const path = require('path');
const fs = require('fs')
const handlebars = require('handlebars')

const sesClient = new SESClient({ region: process.env.AWS_REGION })

function loadTemplate(templateName, data) {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    return template(data);
}

async function sendEmail(toAddress, subject, templateName, templateData) {
    const htmlContent = loadTemplate(templateName, templateData);

    const params = {
        Destination: {
            ToAddresses: [toAddress],
        },
        Message: {
            Body: {
                Html: {
                    Charset: 'UTF-8',
                    Data: htmlContent,
                },
            },
            Subject: {
                Charset: 'UTF-8',
                Data: subject,
            },
        },
        Source: 'Kuky <noreply@kuky.com>',
    };

    try {
        const command = new SendEmailCommand(params);
        const result = await sesClient.send(command);

        console.log(`Email sent! Message ID: ${result.MessageId}`);
        return Promise.resolve(result)
    } catch (error) {

        console.log(`Error sending email: ${error.message}`);
        return Promise.reject(error)
    }
}

async function sendSuggestEmail({ to_email, to_name, to_purposes, suggest_id, suggest_name, suggest_purposes }) {
    try {
        const result = await sendEmail(to_email, `You and ${suggest_name} are on the same journey`, 'suggestion_email', { to_email, to_name, to_purposes: to_purposes.join(', '), suggest_id, suggest_name, suggest_purposes: suggest_purposes.join(', ') })

        if (!result) {
            return Promise.reject('Error sending verification email')
        } else {
            return Promise.resolve({ message: 'Verification code sent to your email' })
        }
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function sendRequestEmail({ to_email, to_name, to_purposes, conversation_id, sender_name, sender_purposes }) {

    try {
        const result = await sendEmail(to_email, 'You Have a New Connection on Kuky!', 'send_request', { to_email, to_name, to_purposes: to_purposes.join(', '), conversation_id, sender_name, sender_purposes: sender_purposes.join(', ') })

        if (!result) {
            return Promise.reject('Error sending connection request email')
        } else {
            return Promise.resolve({ message: 'Connection request email sent' })
        }
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function sendWelcomeEmail({ to_email }) {

    try {
        const result = await sendEmail(to_email, 'Welcome to Kuky!', 'welcome_email', { to_email })

        if (!result) {
            return Promise.reject('Error sending connection request email')
        } else {
            return Promise.resolve({ message: 'Connection request email sent' })
        }
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function sendVerificationEmail({ to_email, full_name, code }) {

    try {
        const result = await sendEmail(to_email, 'Welcome to Kuky!', 'verification_email', { to_email, full_name: full_name ?? to_email, code })

        if (!result) {
            return Promise.reject('Error sending connection request email')
        } else {
            return Promise.resolve({ message: 'Connection request email sent' })
        }
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function sendRejectProfileEmail({ to_email, reasons, to_name }) {

    try {
        const result = await sendEmail(to_email, '⚠️ Your Kuky App Account Review Update', 'profile_rejected', { to_email, to_name, reasons })

        if (!result) {
            return Promise.reject('Error sending connection request email')
        } else {
            return Promise.resolve({ message: 'Connection request email sent' })
        }
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

async function sendApproveProfileEmail({ to_email, to_name}) {

    try {
        const result = await sendEmail(to_email, 'Your profile has been approved!', 'profile_approved', { to_email, to_name })

        if (!result) {
            return Promise.reject('Error sending connection request email')
        } else {
            return Promise.resolve({ message: 'Connection request email sent' })
        }
    } catch (error) {
        console.log({ error })
        return Promise.reject(error)
    }
}

module.exports = {
    sendSuggestEmail,
    sendRequestEmail,
    sendWelcomeEmail,
    sendVerificationEmail,
    sendApproveProfileEmail,
    sendRejectProfileEmail
}