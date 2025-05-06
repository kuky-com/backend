'use strict';

const express = require('express');
const admin = require('@controllers/admin');
const {
	deletePurpose,
	createUserInterest,
	deleteInterest,
	createUserPurpose,
	updateProfileTag,
} = require('../../controllers/interests');
const { updateUserNote, updateProfile, getStats } = require('@controllers/users');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { getStatsByMonth } = require('../../controllers/users');

router.get('/', (request, response) => {
	return admin
		.getUsers({ ...request.query })
		.then(({ data, message }) => {
			return response.json({
				success: true,
				data: data,
				message: message,
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.put('/:userId/note', async (request, response) => {
	try {
		await updateUserNote({
			userId: request.params.userId,
			note: request.body.note,
		});
		return response.json({ ok: 'true', success: true });
	} catch (err) {
		return response.status(400).json({ message: err.message, success: false });
	}
});

router.get(
	'/:userId/stats',
	async (request, response, next) => {
		try {
			const result = await getStatsByMonth({
				user_id: request.params.userId
			});
			return response.json({
				success: true,
				data: result,
			});
		} catch (err) {
			return response.json({
				success: false,
				message: `${err}`,
			});
		}
	}
);

router.put('/:userId/profile', async (request, response) => {
	try {
		await updateProfile({
			user_id: request.params.userId,
			...request.body,
		});
		return response.json({ ok: 'true', success: true });
	} catch (err) {
		return response.status(400).json({ message: err.message, success: false });
	}
});

router.get('/:userId/tags', async (request, response) => {
	try {
		const res = await updateProfileTag({
			user_id: request.params.userId
		});
		return response.json({ ok: 'true', data: res.data, success: true });
	} catch (err) {
		return response.status(400).json({ message: err.message, success: false });
	}
});

// Add new interest
router.post('/:userId/interests', async (request, response) => {
	try {
		const interest = await createUserInterest({
			userId: request.params.userId,
			interestName: request.body.name,
			interestType: request.body.type,
		});

		return response.json({ data: interest, success: true });
	} catch (error) {
		let validationErr;
		if (error instanceof Sequelize.ValidationError) {
			error.errors.forEach((err) => {
				if (err.type === 'unique violation') {
					validationErr = err;
				}
			});
		}

		return response.status(500).json({
			message: validationErr ? 'User already has this interest' : error.message,
			success: false,
		});
	}
});

// delete interest
router.delete('/:userId/interests/:interestId', async (request, response) => {
	try {
		await deleteInterest({
			userId: request.params.userId,
			userInterestId: request.params.interestId,
		});

		return response.json({ message: 'ok', success: true });
	} catch (err) {
		return response.status(500).json({ message: err.message, success: false });
	}
});

// Add purpose
router.post('/:userId/purposes', async (request, response) => {
	try {
		const purpose = await createUserPurpose({
			userId: request.params.userId,
			purposeName: request.body.name,
		});

		return response.json({ data: purpose, success: true });
	} catch (err) {
		return response.status(500).json({
			message: `Got error while creating the purpose`,
			err: err.message,
			success: false,
		});
	}
});

// delete interest
router.delete('/:userId/purposes/:purposeId', async (request, response) => {
	try {
		await deletePurpose({
			userId: request.params.userId,
			userPurposeId: request.params.purposeId,
		});

		return response.json({ message: 'ok', success: true });
	} catch (err) {
		return response.status(500).json({
			message: err.message,
			success: false,
		});
	}
});

module.exports = router;
