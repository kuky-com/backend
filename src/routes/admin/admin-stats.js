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
		console.log('here');
		const result = await stats.getCallsCount();

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

module.exports = router;
