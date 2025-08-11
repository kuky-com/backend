// Example of how to integrate the email unsubscribe functionality 
// into your existing email sending code

const { generateUnsubscribeUrl, shouldSendEmail, addUnsubscribeFooter } = require('../utils/emailUtils');
const Users = require('../models/users');

/**
 * Example function showing how to send emails with unsubscribe functionality
 * Replace this with your actual email sending logic
 */
async function sendEmailWithUnsubscribe(userEmail, subject, htmlContent) {
	try {
		// Get user from database
		const user = await Users.findOne({ where: { email: userEmail } });
		
		if (!user) {
			throw new Error('User not found');
		}
		
		// Check if user wants to receive emails
		if (!shouldSendEmail(user)) {
			console.log(`Skipping email to ${userEmail} - user has unsubscribed or disabled email notifications`);
			return { success: false, reason: 'User has unsubscribed or disabled email notifications' };
		}
		
		// Generate unsubscribe URL
		const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
		const unsubscribeUrl = generateUnsubscribeUrl(userEmail, baseUrl);
		
		// Add unsubscribe footer to email content
		const emailContentWithFooter = addUnsubscribeFooter(htmlContent, unsubscribeUrl);
		
		// Here you would integrate with your email service provider
		// Examples: SendGrid, Mailgun, Amazon SES, Nodemailer, etc.
		// For now, we'll just log that the email would be sent
		console.log(`Would send email to ${userEmail}:`, {
			subject,
			content: emailContentWithFooter,
			unsubscribeUrl
		});
		
		/*
		// Example with SendGrid:
		const sgMail = require('@sendgrid/mail');
		sgMail.setApiKey(process.env.SENDGRID_API_KEY);
		
		const msg = {
			to: userEmail,
			from: process.env.FROM_EMAIL || 'noreply@kuky.com',
			subject: subject,
			html: emailContentWithFooter,
			// Add unsubscribe header for email clients
			headers: {
				'List-Unsubscribe': `<${unsubscribeUrl}>`,
				'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
			}
		};
		
		await sgMail.send(msg);
		*/
		
		/*
		// Example with Nodemailer:
		const nodemailer = require('nodemailer');
		
		const transporter = nodemailer.createTransporter({
			// Your email service configuration
		});
		
		await transporter.sendMail({
			from: process.env.FROM_EMAIL || 'noreply@kuky.com',
			to: userEmail,
			subject: subject,
			html: emailContentWithFooter,
			headers: {
				'List-Unsubscribe': `<${unsubscribeUrl}>`,
				'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
			}
		});
		*/
		
		console.log(`Email sent successfully to ${userEmail} with unsubscribe link`);
		return { success: true, unsubscribeUrl };
		
	} catch (error) {
		console.error('Error sending email:', error);
		throw error;
	}
}

/**
 * Send welcome email example
 */
async function sendWelcomeEmail(userEmail, userName) {
	const subject = 'Welcome to Kuky!';
	const htmlContent = `
		<html>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
			<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
				<h1 style="color: #3498db;">Welcome to Kuky, ${userName}!</h1>
				<p>Thank you for joining our community. We're excited to have you on board!</p>
				<p>You can now start connecting with people who share your interests and purposes.</p>
				<p>Get started by completing your profile and sharing your story.</p>
			</div>
		</body>
		</html>
	`;
	
	return await sendEmailWithUnsubscribe(userEmail, subject, htmlContent);
}

/**
 * Send notification email example
 */
async function sendNotificationEmail(userEmail, notificationType) {
	const subject = getNotificationSubject(notificationType);
	const htmlContent = generateNotificationHTML(notificationType);
	
	return await sendEmailWithUnsubscribe(userEmail, subject, htmlContent);
}

function getNotificationSubject(type) {
	switch (type) {
		case 'new_match':
			return 'You have a new match on Kuky!';
		case 'new_message':
			return 'You have a new message on Kuky!';
		case 'profile_approved':
			return 'Your profile has been approved!';
		default:
			return 'Notification from Kuky';
	}
}

function generateNotificationHTML(type) {
	// Generate appropriate HTML based on notification type
	// This is a simple example - customize based on your needs
	return `
		<html>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
			<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
				<h1 style="color: #3498db;">Kuky Notification</h1>
				<p>You have a new ${type.replace('_', ' ')} on Kuky!</p>
				<p>Log in to your account to see more details.</p>
			</div>
		</body>
		</html>
	`;
}

module.exports = {
	sendEmailWithUnsubscribe,
	sendWelcomeEmail,
	sendNotificationEmail
};
