'use strict';

const express = require('express');
const faqs = require('@controllers/admin/faqs');
const router = express.Router();

router.get('/', (request, response) => {
	return faqs
		.getAllFAQs({ ...request.query })
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

router.post('/', (request, response) => {
	const { question, answer, is_active } = request.body;

	if (!question || typeof question !== 'string' || question.trim().length === 0) {
		return response.json({
			success: false,
			message: 'Question is required and must be a non-empty string'
		});
	}

	if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
		return response.json({
			success: false,
			message: 'Answer is required and must be a non-empty string'
		});
	}

	if (question.trim().length > 500) {
		return response.json({
			success: false,
			message: 'Question must not exceed 500 characters'
		});
	}

	if (answer.trim().length > 2000) {
		return response.json({
			success: false,
			message: 'Answer must not exceed 2000 characters'
		});
	}

	return faqs
		.createFAQ({
			question: question.trim(),
			answer: answer.trim(),
			is_active: is_active || true
		})
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

router.put('/:id', (request, response) => {
	const { id } = request.params;
	const { question, answer, is_active, ranking } = request.body;

	if (!id || isNaN(id) || parseInt(id) <= 0) {
		return response.json({
			success: false,
			message: 'Valid FAQ ID is required'
		});
	}

	if (!question && !answer && is_active === undefined && !ranking) {
		return response.json({
			success: false,
			message: 'At least one field (question, answer, or is_active, ranking) must be provided'
		});
	}

	const updateData = {};
	if (question !== undefined) {
		if (typeof question !== 'string' || question.trim().length === 0) {
			return response.json({
				success: false,
				message: 'Question must be a non-empty string'
			});
		}
		if (question.trim().length > 500) {
			return response.json({
				success: false,
				message: 'Question must not exceed 500 characters'
			});
		}
		updateData.question = question.trim();
	}

	if (answer !== undefined) {
		if (typeof answer !== 'string' || answer.trim().length === 0) {
			return response.json({
				success: false,
				message: 'Answer must be a non-empty string'
			});
		}
		if (answer.trim().length > 2000) {
			return response.json({
				success: false,
				message: 'Answer must not exceed 2000 characters'
			});
		}
		updateData.answer = answer.trim();
	}

	if (is_active !== undefined) {
		updateData.is_active = is_active;
	}

	if (ranking !== undefined) {
		if (isNaN(ranking) || parseInt(ranking) < 0) {
			return response.json({
				success: false,
				message: 'Ranking must be a non-negative integer'
			});
		}
		updateData.ranking = parseInt(ranking);
	}

	return faqs
		.updateFAQ(parseInt(id), updateData)
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

router.delete('/:id', (request, response) => {
	const { id } = request.params;

	if (!id || isNaN(id) || parseInt(id) <= 0) {
		return response.json({
			success: false,
			message: 'Valid FAQ ID is required'
		});
	}

	return faqs
		.deleteFAQ(parseInt(id))
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

module.exports = router;