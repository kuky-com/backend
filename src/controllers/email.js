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

const sesClient = new SESClient({ region: process.env.AWS_REGION })

async function sendSuggestEmail({ to_email, to_name, to_purposes, suggest_id, suggest_name, suggest_purposes }) {

    try {
        const params = {
            Source: 'noreply@kuky.com',
            Destination: {
                ToAddresses: [to_email],
            },
            Message: {
                Subject: {
                    Charset: 'UTF-8',
                    Data: `You and ${suggest_name}] are on the same journey`,
                },
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: `
                            <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You and ${suggest_name} are on the same journey</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f0f0f0;
            font-family: 'Arial', sans-serif;
        }
        .profile-card-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .email-container {
            background-color: #6b45de;
            color: #ffffff;
            padding: 30px;
            max-width: 600px;
            margin: 20px auto;
            border-radius: 10px;
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
        }
        .header img {
            width: 50px;
        }
        .title {
            color: #fff54e;
            font-size: 24px;
            font-weight: bold;
        }
        .content {
            text-align: center;
            font-size: 16px;
            color: #ffffff;
            margin: 20px 0;
        }
        .profile-card {
            background-color: #fff;
            color: #333;
            border-radius: 10px;
            padding: 15px;
            display: inline-block;
            margin-bottom: 20px;
        }
        .profile-card h3 {
            margin: 0;
            font-size: 18px;
        }
        .profile-card p {
            font-size: 14px;
            color: #666;
        }
        .button-container {
            text-align: center;
        }
        .button {
            background-color: #333333;
            color: #ffffff;
            padding: 12px 20px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #ffffff;
        }
        .footer img {
            width: 100px;
            margin: 10px;
        }
        .footer a {
            color: #ffffff;
            text-decoration: none;
            font-size: 12px;
            margin: 0 5px;
        }
        .footer-links {
            margin-top: 20px;
        }
        .footer-icons img {
            width: 24px;
            margin: 5px;
        }
    </style>
</head>
<body>

<div class="email-container">
    <div class="header">
        <img src="https://www.kuky.com/kuky-icon.svg" alt="Logo">
        <h1 class="title">You and ${suggest_name} are on the same journey.</h1>
    </div>

    <div class="content">
        <p>Great news ${to_name}!</p>
        <p>It looks like you & ${suggest_name} are both interested in ${to_purposes.join(', ')}. We think you two should connect.</p>
    </div>

    <div class="profile-card-container">
        <div class="profile-card">
            <h3>${suggest_name}</h3>
            <p>Interested in "${suggest_purposes.join(', ')}"</p>
        </div>
    </div>

    <div class="button-container">
        <a href="kuky://profile/${suggest_id}" class="button">See ${suggest_name}’s profile</a>
    </div>

    <div class="content">
        <p>We love seeing you connect with others who share your journey. Keep the momentum going!</p>
        <p>Best,<br>The Kuky Team</p>
    </div>

    <div class="footer">
        <p>Download the KUKY app now!</p>
        <img src="https://www.kuky.com/appstore.svg" alt="App Store">
        <img src="https://www.kuky.com/playstore.svg" alt="Google Play">
        <div class="footer-links">
            <a href="#">Terms & Conditions</a> | 
            <a href="#">Privacy Policy</a> | 
            <a href="#">Unsubscribe</a>
        </div>
        <div class="footer-icons">
            <a href="#"><img src="https://www.kuky.com/instagram.svg" alt="Instagram"></a>
            <a href="#"><img src="https://www.kuky.com/facebook.svg" alt="Facebook"></a>
            <a href="#"><img src="https://www.kuky.com/twitter.svg" alt="Twitter"></a>
        </div>
    </div>
</div>

</body>
</html>

                        `,
                    },
                },
            },
        };

        const command = new SendEmailCommand(params);
        const result = await sesClient.send(command);

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
        const params = {
            Source: 'noreply@kuky.com',
            Destination: {
                ToAddresses: [to_email],
            },
            Message: {
                Subject: {
                    Charset: 'UTF-8',
                    Data: `You and ${sender_name}] are on the same journey`,
                },
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: `
                            <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You and ${sender_name} are on the same journey</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f0f0f0;
            font-family: 'Arial', sans-serif;
        }
        .profile-card-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .email-container {
            background-color: #6b45de;
            color: #ffffff;
            padding: 30px;
            max-width: 600px;
            margin: 20px auto;
            border-radius: 10px;
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
        }
        .header img {
            width: 50px;
        }
        .title {
            color: #fff54e;
            font-size: 24px;
            font-weight: bold;
        }
        .content {
            text-align: center;
            font-size: 16px;
            color: #ffffff;
            margin: 20px 0;
        }
        .profile-card {
            background-color: #fff;
            color: #333;
            border-radius: 10px;
            padding: 15px;
            display: inline-block;
            margin-bottom: 20px;
        }
        .profile-card h3 {
            margin: 0;
            font-size: 18px;
        }
        .profile-card p {
            font-size: 14px;
            color: #666;
        }
        .button-container {
            text-align: center;
        }
        .button {
            background-color: #333333;
            color: #ffffff;
            padding: 12px 20px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #ffffff;
        }
        .footer img {
            width: 100px;
            margin: 10px;
        }
        .footer a {
            color: #ffffff;
            text-decoration: none;
            font-size: 12px;
            margin: 0 5px;
        }
        .footer-links {
            margin-top: 20px;
        }
        .footer-icons img {
            width: 24px;
            margin: 5px;
        }
    </style>
</head>
<body>

<div class="email-container">
    <div class="header">
        <img src="https://www.kuky.com/kuky-icon.svg" alt="Logo">
        <h1 class="title">You Have a New Connection on Kuky!</h1>
    </div>

    <div class="content">
        <p>Hi ${to_name}!</p>
        <p>Here are some users who are also interested in ${to_purposes.join(', ')} to the Gym on Kuky.</p>
    </div>

    <div class="profile-card-container">
        <div class="profile-card">
            <h3>${sender_name}</h3>
            <p>Interested in "${sender_purposes.join(', ')}"</p>
        </div>
    </div>

    <div class="button-container">
        <a href="kuky://conversation/${conversation_id}" class="button">Message</a>
    </div>

    <div class="content">
        <p>We love seeing you connect with others who share your journey. Keep the momentum going!</p>
        <p>Best,<br>The Kuky Team</p>
    </div>

    <div class="footer">
        <p>Download the KUKY app now!</p>
        <img src="https://www.kuky.com/appstore.svg" alt="App Store">
        <img src="https://www.kuky.com/playstore.svg" alt="Google Play">
        <div class="footer-links">
            <a href="#">Terms & Conditions</a> | 
            <a href="#">Privacy Policy</a> | 
            <a href="#">Unsubscribe</a>
        </div>
        <div class="footer-icons">
            <a href="#"><img src="https://www.kuky.com/instagram.svg" alt="Instagram"></a>
            <a href="#"><img src="https://www.kuky.com/facebook.svg" alt="Facebook"></a>
            <a href="#"><img src="https://www.kuky.com/twitter.svg" alt="Twitter"></a>
        </div>
    </div>
</div>

</body>
</html>

                        `,
                    },
                },
            },
        };

        const command = new SendEmailCommand(params);
        const result = await sesClient.send(command);

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
    sendRequestEmail
}