const Users = require('@/models/users');
const VerificationCode = require('@/models/verification_code');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto')
const bcrypt = require('bcrypt');
const Sessions = require('../models/sessions');
const usersController = require('./users')
const appleSigninAuth = require('apple-signin-auth');
const path = require('path');
const fs = require('fs')
const handlebars = require('handlebars')
const { sendOnesignalEmail } = require('./onesignal');

function loadTemplate(templateName, data) {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    return template(data);
}

async function sendEmail(toAddress, subject, templateName, templateData, fromName = 'Kuky', fromAddress = 'noreply@kuky.com') {
    const htmlContent = loadTemplate(templateName, templateData);

    if (/@privaterelay\.appleid\.com$/i.test(toAddress) || /@kuky\.com$/i.test(toAddress)) {
        console.log('Not sending email to restricted address:', toAddress);
        return Promise.resolve({ message: 'Skipped sending email to restricted address' });
    }

    try {
        const result = await sendOnesignalEmail(toAddress, subject, htmlContent, fromAddress, fromName);
        console.log(`Email sent! Message ID: ${result}`);
        return Promise.resolve(result);
    } catch (error) {
        return Promise.resolve({ message: 'Error ' + error?.message });
    }
}

async function sendSuggestEmail({ to_email, to_name, suggest_id, suggest_name, suggest_journey }) {
    try {
        const result = await sendEmail(to_email, `You and ${suggest_name} are on the same journey`, 'suggestion_email', { to_email, to_name, suggest_id, suggest_name, suggest_journey })

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

async function sendRequestEmail({ to_email, to_name, conversation_id, sender_name, sender_journey }) {

    try {
        const result = await sendEmail(to_email, 'You Have a New Connection on Kuky!', 'send_request', { to_email, to_name, conversation_id, sender_name, sender_journey })

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

async function sendApproveProfileEmail({ to_email, to_name }) {

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

async function sendEmailCompleteProfile({ to_email, to_name }) {

    try {
        const result = await sendEmail(to_email, "We'd love your thoughts on Kuky 💙", 'complete_profile', { to_email, to_name }, 'Kristijan Bugaric', 'kristijan@kuky.com')
        console.log({ result, to_email, to_name })
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

async function sendUserInvitationEmail({ sender_full_name, sender_referral_id, sender_journey, recipients = [] }) {
    try {
        for (let i = 0; i < recipients.length; i++) {
            try {
                const recipient = recipients[i];
                const result = await sendEmail(
                    recipient.email,
                    `${sender_full_name} has invited you to join them on Kuky`,
                    'user_invitation',
                    { 
                        recipient_full_name: encodeURIComponent(recipient.name), 
                        sender_full_name: encodeURIComponent(sender_full_name), 
                        sender_journey,
                        recipient_email: encodeURIComponent(recipient.email),
                        sender_referral_id: encodeURIComponent(sender_referral_id)
                     })
            } catch (error) {

            }
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
    sendRejectProfileEmail,
    sendEmailCompleteProfile,
    sendUserInvitationEmail
}