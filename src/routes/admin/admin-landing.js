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
const { updateUserNote, updateProfile } = require('@controllers/users');
const router = express.Router();
const { Sequelize } = require('sequelize');

router.get('/ambassadors', (request, response) => {
	return admin
		.getLandingPageAmbassadorsInfo()
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

router.get('/contacts', (request, response) => {
	return admin
		.getLandingPageContactUs()
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


module.exports = router;
