const Users = require('@/models/users');
const crypto = require('crypto');

/**
 * Verify RevenueCat webhook signature
 */
function verifyWebhookSignature(payload, signature) {
	if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
		console.warn('RevenueCat webhook secret not configured');
		return false;
	}

	try {
		const expectedSignature = crypto
			.createHmac('sha256', process.env.REVENUECAT_WEBHOOK_SECRET)
			.update(payload, 'utf8')
			.digest('hex');

		// RevenueCat might send signature with or without 'sha256=' prefix
		const cleanSignature = signature.replace(/^sha256=/, '');
		
		console.log('Signature verification:', {
			received: cleanSignature,
			expected: expectedSignature,
			payloadLength: payload.length
		});

		return crypto.timingSafeEqual(
			Buffer.from(cleanSignature, 'hex'),
			Buffer.from(expectedSignature, 'hex')
		);
	} catch (error) {
		console.error('Error verifying webhook signature:', error);
		return false;
	}
}

/**
 * Map RevenueCat event type to subscription status
 */
function mapEventTypeToStatus(event) {
	const eventStatusMap = {
		'RENEWAL': 'active',
		'NON_RENEWING_PURCHASE': 'active',
		'CANCELLATION': 'canceled',
		'UNCANCELLATION': 'active',
		'EXPIRATION': 'expired',
		'BILLING_ISSUE': 'active',
		'PRODUCT_CHANGE': 'active',
		'TRANSFER': 'active',
		'SUBSCRIBER_ALIAS': 'active',
		'SUBSCRIPTION_PAUSED': 'active',
		'SUBSCRIPTION_RESUMED': 'active'
	};
    if (event.period_type === 'TRIAL' && event.type === 'INITIAL_PURCHASE') {
        return 'trial';
    }

	return eventStatusMap[event.type] || 'none';
}

/**
 * Update user subscription status based on RevenueCat webhook
 */
async function updateUserSubscriptionStatus(webhookData) {
	try {
		const { event } = webhookData;
		const { app_user_id, product_id, original_transaction_id, expiration_time_ms, event_timestamp_ms } = event;

		// Find user by RevenueCat app_user_id or create mapping
		let user = await Users.findOne({
			where: { revenuecat_app_user_id: app_user_id }
		});

		// If user not found by RevenueCat ID, try to find by email or ID (depending on your app_user_id format)
		if (!user) {
			// If app_user_id is email format
			if (app_user_id.includes('@')) {
				user = await Users.findOne({ where: { email: app_user_id } });
			} else {
				// If app_user_id is numeric user ID
				const userId = parseInt(app_user_id);
				if (!isNaN(userId)) {
					user = await Users.findByPk(userId);
				}
			}

			// If user found, update their RevenueCat app_user_id
			if (user) {
				await user.update({ revenuecat_app_user_id: app_user_id });
			}
		}

		if (!user) {
			console.error(`User not found for app_user_id: ${app_user_id}`);
			return { success: false, message: 'User not found' };
		}

		const subscriptionStatus = mapEventTypeToStatus(event);
		const expirationDate = expiration_time_ms ? new Date(expiration_time_ms) : null;
		const eventDate = new Date(event_timestamp_ms);

		// Update user subscription information
		await user.update({
			subscription_status: subscriptionStatus,
			subscription_expires_at: expirationDate,
			subscription_product_id: product_id,
			subscription_original_transaction_id: original_transaction_id,
			subscription_updated_at: eventDate,
		});

		console.log(`Updated subscription for user ${user.id}:`, {
			status: subscriptionStatus,
			product_id,
			expires_at: expirationDate,
			event_type: event.type
		});

		return {
			success: true,
			message: 'Subscription status updated successfully',
			data: {
				user_id: user.id,
				subscription_status: subscriptionStatus,
				expires_at: expirationDate
			}
		};

	} catch (error) {
		console.error('Error updating subscription status:', error);
		return { success: false, message: error.message };
	}
}

/**
 * Get user subscription info
 */
async function getUserSubscriptionInfo({ user_id }) {
	try {
		const user = await Users.findByPk(user_id, {
			attributes: [
				'id',
				'subscription_status',
				'subscription_expires_at',
				'subscription_product_id',
				'subscription_original_transaction_id',
				'revenuecat_app_user_id',
				'subscription_updated_at',
				'is_premium_user'
			]
		});

		if (!user) {
			return Promise.reject('User not found');
		}

		return Promise.resolve({
			data: user.toJSON(),
			message: 'User subscription info retrieved successfully'
		});

	} catch (error) {
		console.error('Error getting user subscription info:', error);
		return Promise.reject(error);
	}
}

/**
 * Update user RevenueCat app_user_id
 */
async function updateRevenueCatUserId({ user_id, revenuecat_app_user_id }) {
	try {
		const user = await Users.findByPk(user_id);

		if (!user) {
			return Promise.reject('User not found');
		}

		await user.update({ revenuecat_app_user_id });

		return Promise.resolve({
			data: { user_id, revenuecat_app_user_id },
			message: 'RevenueCat app user ID updated successfully'
		});

	} catch (error) {
		console.error('Error updating RevenueCat user ID:', error);
		return Promise.reject(error);
	}
}

module.exports = {
	verifyWebhookSignature,
	updateUserSubscriptionStatus,
	getUserSubscriptionInfo,
	updateRevenueCatUserId,
	mapEventTypeToStatus
};
