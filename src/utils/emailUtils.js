/**
 * Generate an unsubscribe token for a user email
 * @param {string} email - User's email address
 * @returns {string} - Base64 encoded token
 */
function generateUnsubscribeToken(email) {
	const tokenData = {
		email: email,
		timestamp: Date.now()
	};
	
	const tokenString = JSON.stringify(tokenData);
	return Buffer.from(tokenString).toString('base64');
}

/**
 * Generate unsubscribe URL for emails
 * @param {string} email - User's email address
 * @param {string} webAppBaseUrl - Base URL of the web application (e.g., 'https://app.kuky.com')
 * @returns {string} - Complete unsubscribe URL
 */
function generateUnsubscribeUrl(email, webAppBaseUrl = process.env.WEB_APP_BASE_URL || 'https://app.kuky.com') {
	const token = generateUnsubscribeToken(email);
	return `${webAppBaseUrl}/unsubscribe/${token}`;
}

/**
 * Generate unsubscribe URL with query parameter format
 * @param {string} email - User's email address
 * @param {string} webAppBaseUrl - Base URL of the web application (e.g., 'https://app.kuky.com')
 * @returns {string} - Complete unsubscribe URL with query parameter
 */
function generateUnsubscribeUrlWithQuery(email, webAppBaseUrl = process.env.WEB_APP_BASE_URL || 'https://app.kuky.com') {
	const token = generateUnsubscribeToken(email);
	return `${webAppBaseUrl}/unsubscribe?token=${token}`;
}

/**
 * Check if user should receive emails based on their preferences
 * @param {Object} user - User object from database
 * @returns {boolean} - Whether user should receive emails
 */
function shouldSendEmail(user) {
	return user && user.emailNotificationEnable === true;
}

/**
 * Add unsubscribe footer to email content
 * @param {string} htmlContent - Original HTML email content
 * @param {string} unsubscribeUrl - Unsubscribe URL
 * @returns {string} - HTML content with unsubscribe footer
 */
function addUnsubscribeFooter(htmlContent, unsubscribeUrl) {
	const unsubscribeFooter = `
		<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888;">
			<p>You're receiving this email because you have an account with Kuky.</p>
			<p>
				If you no longer wish to receive emails from us, you can 
				<a href="${unsubscribeUrl}" style="color: #3498db; text-decoration: none;">unsubscribe here</a>.
			</p>
			<p style="margin-top: 10px; font-size: 10px;">
				Kuky - Connect with purpose
			</p>
		</div>
	`;

	if (htmlContent.includes('</body>')) {
		return htmlContent.replace('</body>', unsubscribeFooter + '</body>');
	} else {
		return htmlContent + unsubscribeFooter;
	}
}

/**
 * Validate unsubscribe token
 * @param {string} token - Base64 encoded token
 * @returns {Object|null} - Decoded token data or null if invalid
 */
function validateUnsubscribeToken(token) {
	try {
		const decoded = Buffer.from(token, 'base64').toString('utf-8');
		const tokenData = JSON.parse(decoded);
		
		if (!tokenData.email || !tokenData.timestamp) {
			return null;
		}

		const tokenAge = Date.now() - tokenData.timestamp;
		const maxAge = 30 * 24 * 60 * 60 * 1000; 
		
		if (tokenAge > maxAge) {
			return null;
		}
		
		return tokenData;
	} catch {
		return null;
	}
}

module.exports = {
	generateUnsubscribeToken,
	generateUnsubscribeUrl,
	generateUnsubscribeUrlWithQuery,
	shouldSendEmail,
	addUnsubscribeFooter,
	validateUnsubscribeToken
};
