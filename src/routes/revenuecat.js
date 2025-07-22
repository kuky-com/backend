const express = require('express');
const router = express.Router();
const { 
	verifyWebhookSignature, 
	updateUserSubscriptionStatus,
	getUserSubscriptionInfo,
	updateRevenueCatUserId
} = require('@controllers/revenuecat');
const authMiddleware = require('../milddleware/authMiddleware');

/**
 * RevenueCat webhook endpoint
 * This endpoint receives webhook notifications from RevenueCat
 * about subscription events (purchases, renewals, cancellations, etc.)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
	try {
		const signature = req.headers['x-revenuecat-signature'];
		const payload = req.body;

		// Verify webhook signature if secret is configured
		if (process.env.REVENUECAT_WEBHOOK_SECRET) {
			if (!signature) {
				console.error('Missing RevenueCat webhook signature');
				return res.status(400).json({ error: 'Missing signature' });
			}

			const isValid = verifyWebhookSignature(payload, signature);
			if (!isValid) {
				console.error('Invalid RevenueCat webhook signature');
				return res.status(401).json({ error: 'Invalid signature' });
			}
		}

		// Parse webhook data
		const webhookData = JSON.parse(payload);
		console.log('RevenueCat webhook received:', {
			event_type: webhookData.event?.type,
			app_user_id: webhookData.event?.app_user_id,
			product_id: webhookData.event?.product_id
		});

		// Update user subscription status
		const result = await updateUserSubscriptionStatus(webhookData);

		if (result.success) {
			res.status(200).json({ 
				message: 'Webhook processed successfully',
				data: result.data
			});
		} else {
			console.error('Failed to process webhook:', result.message);
			res.status(400).json({ 
				error: 'Failed to process webhook',
				message: result.message
			});
		}

	} catch (error) {
		console.error('Error processing RevenueCat webhook:', error);
		res.status(500).json({ 
			error: 'Internal server error',
			message: error.message
		});
	}
});

/**
 * Get user subscription information
 */
router.get('/subscription-info', authMiddleware, (req, res) => {
	const { user_id } = req;

	if (!user_id) {
		return res.json({
			success: false,
			message: 'Missing required param: user_id'
		});
	}

	return getUserSubscriptionInfo({ user_id })
		.then(({ data, message }) => {
			return res.json({
				success: true,
				data: data,
				message: message
			});
		})
		.catch((error) => {
			return res.json({
				success: false,
				message: `${error}`
			});
		});
});

/**
 * Update user's RevenueCat app_user_id
 * This is useful when you need to link a user to their RevenueCat identity
 */
router.post('/update-app-user-id', authMiddleware, (req, res) => {
	const { user_id } = req;
	const { revenuecat_app_user_id } = req.body;

	if (!user_id || !revenuecat_app_user_id) {
		return res.json({
			success: false,
			message: 'Missing required params: user_id, revenuecat_app_user_id'
		});
	}

	return updateRevenueCatUserId({ user_id, revenuecat_app_user_id })
		.then(({ data, message }) => {
			return res.json({
				success: true,
				data: data,
				message: message
			});
		})
		.catch((error) => {
			return res.json({
				success: false,
				message: `${error}`
			});
		});
});

/**
 * Webhook test endpoint for development
 * This endpoint can be used to test webhook processing with sample data
 */
if (process.env.NODE_ENV === 'development') {
	router.post('/webhook-test', async (req, res) => {
		try {
			const sampleWebhookData = {
				event: {
					type: 'INITIAL_PURCHASE',
					app_user_id: req.body.app_user_id || 'test_user_123',
					product_id: 'premium_monthly',
					original_transaction_id: 'test_transaction_123',
					expiration_time_ms: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
					event_timestamp_ms: Date.now()
				}
			};

			const result = await updateUserSubscriptionStatus(sampleWebhookData);

			res.json({
				message: 'Test webhook processed',
				data: result
			});

		} catch (error) {
			console.error('Error processing test webhook:', error);
			res.status(500).json({ 
				error: 'Internal server error',
				message: error.message
			});
		}
	});
}

module.exports = router;
