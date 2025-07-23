const express = require('express');
const router = express.Router();
const stats = require('@controllers/admin/stats');

router.get('/users', async (req, res) => {
	try {
		const result = await stats.getUserGrowth(req.query.granularity, req.query.timeline);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/matches', async (req, res) => {
	try {
		const result = await stats.getMatches(req.query.timeline);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/calls', async (req, res) => {
	try {
		const result = await stats.getCallsCount(req.query.timeline);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/messages', async (req, res) => {
	try {
		const result = await stats.getMessagesCount(
			req.query.granularity,
			req.query.timeline
		);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/views', async (req, res) => {
	try {
		const result = await stats.getProfileViewsCount(
			req.query.granularity,
			req.query.timeline
		);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/journeys', async (req, res) => {
	try {
		const result = await stats.getCountJourneys(
			req.query.granularity,
			req.query.timeline
		);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/journey-categories', async (req, res) => {
	try {
		const result = await stats.getCountJourneyCategories(
			req.query.granularity,
			req.query.timeline
		);

		res.status(200).json({ ...result, success: true });
	} catch (err) {
		res.status(500).json({ message: err.message, success: false });
	}
});

router.get('/profile-approval-stats', async (request, response) => {
	try {
		const result = await stats.getProfileApprovalStats();
		return response.json({
			success: true,
			data: result,
			message: 'Profile approval statistics retrieved successfully'
		});
	} catch (error) {
		console.error('Error:', error);
		return response.json({
			success: false,
			message: 'Failed to retrieve profile approval statistics'
		});
	}
});

router.get('/email-verification', async (req, res) => {
	try {
		const admin = require('@controllers/admin');
		const result = await admin.getEmailVerificationStats();

		res.status(200).json({ 
			...result, 
			success: true 
		});
	} catch (err) {
		res.status(500).json({ 
			message: err.message, 
			success: false 
		});
	}
});

router.get('/users-by-platform', async (req, res) => {
	try {
		const result = await stats.getUsersByPlatformStats();
		res.status(200).json({ 
			data: result, 
			success: true 
		});
	} catch (err) {
		res.status(500).json({ 
			message: err.message, 
			success: false 
		});
	}
});

router.get('/users-by-lead', async (req, res) => {
	try {
		const result = await stats.getUsersByLeadStats();
		res.status(200).json({ 
			data: result, 
			success: true 
		});
	} catch (err) {
		res.status(500).json({ 
			message: err.message, 
			success: false 
		});
	}
});

router.get('/users-by-campaign', async (req, res) => {
	try {
		const result = await stats.getUsersByCampaignStats();
		res.status(200).json({ 
			data: result, 
			success: true 
		});
	} catch (err) {
		res.status(500).json({ 
			message: err.message, 
			success: false 
		});
	}
});

router.get('/subscription-stats', async (req, res) => {
	try {
		const result = await stats.getSubscriptionStats();
		res.status(200).json({ 
			data: result, 
			success: true 
		});
	} catch (err) {
		res.status(500).json({ 
			message: err.message, 
			success: false 
		});
	}
});

module.exports = router;
