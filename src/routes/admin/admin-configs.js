'use strict';

const express = require('express');
const router = express.Router();
const { getConfigs, updateConfig } = require('@controllers/admin/configs');
const authAdminMiddleware = require('../../milddleware/authAdminMiddleware');

router.get('/', authAdminMiddleware, (request, response) => {
	return getConfigs()
		.then(({ configs, message }) => {
			return response.json({
				success: true,
				data: configs,
				message: message
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`
			});
		});
});

router.put('/:key', authAdminMiddleware, (request, response) => {
	const { key } = request.params;
	const { value } = request.body;

	if (!value) {
		return response.json({
			success: false,
			message: 'Missing required param: value'
		});
	}

	return updateConfig(key, value)
		.then(({ message }) => {
			return response.json({
				success: true,
				message: message
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`
			});
		});
});

module.exports = router;
