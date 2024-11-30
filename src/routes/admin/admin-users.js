'use strict';

const express = require('express');
const admin = require('@controllers/admin');
const authAdminMiddleware = require('../../milddleware/authAdminMiddleware');
const router = express.Router();

router.get('/', authAdminMiddleware, (request, response, next) => {
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

module.exports = router;
