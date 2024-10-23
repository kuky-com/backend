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
const LeadUsers = require('../models/lead_users');
const { updatePurposes } = require('./interests');
const { sendWelcomeEmail } = require('./email');

const sesClient = new SESClient({ region: process.env.AWS_REGION })
function generateToken(session_id, user_id) {
    return jwt.sign(
        { session_id, user_id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    )
}

async function updateUserFromLead(email) {
    const leadUser = await LeadUsers.findOne({
        where: {
            email: email
        }
    })

    if(leadUser) {
        const user = await Users.findOne({
            where: {
                email: email
            }
        })

        if(user) {
            await updatePurposes({user_id: user.id, purposes: [leadUser.purpose]})

            await Users.update({
                full_name: leadUser.full_name,
                gender: leadUser.gender,
                location: leadUser.location,
            }, {
                where: {
                    email: email
                }
            })
        }
    }
}

async function signUp({ full_name, email, password }) {

    try {
        const existingUser = await Users.findOne({ where: { email, email_verified: true } });
        if (existingUser) {
            return Promise.reject('Email already registered')
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const existingUnverifyUser = await Users.findOne({ where: { email } });
        if(existingUnverifyUser) {
            const user = await Users.update({
                full_name,
                password: hashedPassword,
                email_verified: false,
                login_type: 'email',
            }, {
                where: {
                    email: email
                }
            })
        } else {
            const user = await Users.create({
                full_name,
                email,
                password: hashedPassword,
                email_verified: false,
                login_type: 'email',
            })

            await updateUserFromLead(email)
        }
        

        const code = crypto.randomInt(1000, 9999).toString();
        const expires_at = new Date(Date.now() + 15 * 60 * 1000);

        await VerificationCode.create({ code, email, expires_at });

        const params = {
            Source: 'noreply@kuky.com',
            Destination: {
                ToAddresses: [email],
            },
            Message: {
                Subject: {
                    Data: 'Your Verification Code',
                },
                Body: {
                    Text: {
                        Data: `Your verification code is: ${code}`,
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

async function resendVerification({ email }) {

    try {
        const existingUnverifyUser = await Users.findOne({ where: { email, email_verified: false } });
        if (!existingUnverifyUser) {
            return Promise.reject('This user cannot receive verification email!')
        }

        const code = crypto.randomInt(1000, 9999).toString();
        const expires_at = new Date(Date.now() + 15 * 60 * 1000);

        await VerificationCode.update({ expires_at : new Date()}, {
            where: {
                email: email
            }
        })

        await VerificationCode.create({ code, email, expires_at });

        const params = {
            Source: 'noreply@kuky.com',
            Destination: {
                ToAddresses: [email],
            },
            Message: {
                Subject: {
                    Data: 'Your Verification Code',
                },
                Body: {
                    Text: {
                        Data: `Your verification code is: ${code}`,
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

async function verifyEmail({ email, code, session_token, device_id, platform }) {
    try {
        const record = await VerificationCode.findOne({ 
            where: { email, code },
            order: [['createdAt', 'DESC']]
         });

        if (!record || new Date() > record.expires_at) {
            return Promise.reject('Invalid or expired verification code');
        }

        await Users.update({ email_verified: true }, { where: { email } });

        await sendWelcomeEmail({to_email: email})

        await VerificationCode.destroy({ where: { email, code } });

        const user = await Users.findOne({ where: { email } });

        if(platform && device_id) {
            await Sessions.update(
                { logout_date: new Date(), session_token: null },
                { where: { platform: platform, device_id: device_id } }
            );
        }

        const newSession = await Sessions.create({
            user_id: user.id,
            platform: platform || 'web',
            device_id: device_id || null,
            login_date: new Date(),
            session_token
        });

        const token = generateToken(newSession.id, user.id);

        const userInfo = await usersController.getUser(user.id)

        return Promise.resolve({
            data: {
                user: userInfo,
                token,
            },
            message: 'Email verified successfully',
        });
    } catch (error) {
        console.log(error);
        return Promise.reject('Verification failed');
    }
}

async function login({ email, password, session_token, device_id, platform }) {
    
    try {
        const user = await Users.findOne({ where: { email } });

        if (!user) {
            return Promise.reject('User not found');
        }

        if (!user.email_verified) {
            return Promise.reject('Email not verified')
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return Promise.reject('Invalid email or password')
        }

        if(platform && device_id) {
            await Sessions.update(
                { logout_date: new Date(), session_token: null },
                { where: { platform: platform, device_id: device_id } }
            );
        }

        const newSession = await Sessions.create({
            user_id: user.id,
            platform: platform || 'web',
            device_id: device_id || null,
            login_date: new Date(),
            session_token
        });

        const token = generateToken(newSession.id, user.id);

        if(!user.is_active) {
            await Users.update({is_active: true}, { where: { email } });
        }

        const userInfo = await usersController.getUser(user.id)

        return Promise.resolve({
            data: {
                user: userInfo,
                token
            },
            message: 'Login successful'
        })
    } catch (error) {
        console.error(error);
        return Promise.reject('Login failed! Please try again!')
    }
}

async function googleLogin({ token, session_token, device_id, platform }) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const full_name = payload.name

        let user = await Users.findOne({ where: { email } });

        if (!user) {
            user = await Users.create({
                email,
                login_type: 'google',
                email_verified: true,
                full_name
            });

            await updateUserFromLead(email)

            await sendWelcomeEmail({to_email: email})
        }

        if(platform && device_id) {
            await Sessions.update(
                { logout_date: new Date(), session_token: null },
                { where: { platform: platform, device_id: device_id } }
            );
        }

        const newSession = await Sessions.create({
            user_id: user.id,
            platform: platform || 'web',
            device_id: device_id || null,
            login_date: new Date(),
            session_token
        });

        const access_token = generateToken(newSession.id, user.id);

        if(!user.is_active) {
            await Users.update({is_active: true}, { where: { email } });
        }

        const userInfo = await usersController.getUser(user.id)

        return Promise.resolve({
            data: {
                user: userInfo,
                token: access_token
            },
            message: 'Login successful'
        })
    } catch (error) {
        console.error(error);
        return Promise.reject(error);
    }
}

async function appleLogin({ full_name, token, session_token, device_id, platform }) {

    try {
        appleIdInfo = await appleSigninAuth.verifyIdToken(token);
        
        if(appleIdInfo && appleIdInfo.email && appleIdInfo.email_verified) {
            const email = appleIdInfo.email
            let user = await Users.findOne({ where: { email } });

            if (!user) {
                if(full_name) {
                    user = await Users.create({
                        email,
                        login_type: 'apple',
                        email_verified: true,
                        full_name
                    });
                } else {
                    return Promise.resolve({
                        data: null,
                        message: 'You need to reset your permission to use Apple Login. Please go to Settings > Apple ID, iCloud, iTunes & App Store > Password & Security > Apps Using Your Apple ID > Loopio > Stop Using Apple ID'
                    })
                }

                await updateUserFromLead(email)

                await sendWelcomeEmail({to_email: email})
            }

            if(platform && device_id) {
                await Sessions.update(
                    { logout_date: new Date(), session_token: null },
                    { where: { platform: platform, device_id: device_id } }
                );
            }
    
            const newSession = await Sessions.create({
                user_id: user.id,
                platform: platform || 'web',
                device_id: device_id || null,
                login_date: new Date(),
                session_token
            });
    
            const access_token = generateToken(newSession.id, user.id);

            if(!user.is_active) {
                await Users.update({is_active: true}, { where: { email } });
            }
    
            const userInfo = await usersController.getUser(user.id)
    
            return Promise.resolve({
                data: {
                    user: userInfo,
                    token: access_token
                },
                message: 'Login successful'
            })
        } else {
            return Promise.reject('Invalid Apple token')
        }
    } catch (error) {
        console.error(error);
        return Promise.reject('Invalid Apple token')
    }
}

async function logout({ session_id }) {
    try {
        const session = await Sessions.update(
            { logout_date: new Date(), session_token: null },
            { where: { id: session_id } }
        );

        if (session[0] === 0) {
            return Promise.reject('Session not found')
        }

        return Promise.resolve({
            message: 'Logged out successfully'
        })
    } catch (error) {
        console.error('Logout error:', error);
        return Promise.reject(error)
    }
}

async function updatePassword({user_id, current_password, new_password}) {
  try {
    const user = await Users.findByPk(user_id);

    if (!user) {
      return Promise.reject('User not found.')
    }

    const isPasswordValid = await bcrypt.compare(current_password, user.password);

    if (!isPasswordValid) {
      return Promise.reject('Current password is incorrect.');
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    user.password = hashedPassword;
    await user.save();

    return Promise.resolve('Password updated successfully.')
  } catch (error) {
    console.error('Error updating password:', error);
    return Promise.reject('Internal server error.');
  }
}

module.exports = {
    appleLogin,
    googleLogin,
    login,
    signUp,
    verifyEmail,
    logout,
    updatePassword,
    resendVerification
}