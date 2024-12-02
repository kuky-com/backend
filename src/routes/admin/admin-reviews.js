'use strict';

const express = require('express');
const reviews = require('@controllers/admin/reviews');
const router = express.Router();

router.get('/', (request, response) => {
	return reviews
		.getReviews({ ...request.query })
		.then((data) => {
			return response.json({
				success: true,
				...data,
			});
		})
		.catch((error) => {
			console.log(error);
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.patch('/:reviewId/status', async (req, res) => {
	try {
		await reviews.updateReviewStatus(req.params.reviewId, req.body.status);
		return res.json({
			success: true,
		});
	} catch (err) {
		return res.status(500).json({
			message: err.message,
			success: false,
		});
	}
});

module.exports = router;
//
