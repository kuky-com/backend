'use strict';

const express = require('express');
const admin = require('@controllers/admin');
const {
	deletePurpose,
	createUserInterest,
	deleteInterest,
	createUserPurpose,
} = require('../../controllers/interests');
const router = express.Router();
const { Sequelize } = require('sequelize');

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

// Add new interest
router.post('/:userId/interests', async (request, response) => {
	try {
		const interest = await createUserInterest({
			userId: request.params.userId,
			interestName: request.body.name,
			interestType: request.body.interestType,
		});

		return response.json({ interest });
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
			mesasge: validationErr ? 'User already has this interest' : error.message,
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

		return response.json({ message: 'ok' });
	} catch (err) {
		return response.status(500).json({ message: err.message });
	}
});

// Add purpose
router.post('/:userId/purposes', async (request, response) => {
	try {
		const purpose = await createUserPurpose({
			userId: request.params.userId,
			purposeName: request.body.name,
		});

		return response.json({ purpose });
	} catch (err) {
		return response.status(500).json({
			message: `Got error while creating the purpose`,
			err: err.message,
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

		return response.json({ message: 'ok' });
	} catch (err) {
		return response.status(500).json({
			message: err.message,
		});
	}
});

module.exports = router;
