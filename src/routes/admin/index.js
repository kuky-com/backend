'use strict';

const express = require('express');
const admin = require('@controllers/admin');
const router = express.Router();
const authAdminMiddleware = require('../../milddleware/authAdminMiddleware');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const matches = require('@controllers/matches');

const uploadDir = path.join(process.cwd(), 'uploads');
const upload = multer({ dest: uploadDir });

const adminUsers = require('./admin-users');
const adminReviews = require('./admin-reviews');

router.use('/users', authAdminMiddleware, adminUsers);
router.use('/reviews', authAdminMiddleware, adminReviews);

router.post('/check-suggestion', authAdminMiddleware, (request, response, next) => {
	const { to_email, suggest_email } = request.body;

	if (!to_email || !suggest_email) {
		return response.json({
			success: false,
			message: 'Missing required params: to_email, suggest_email',
		});
	}

	return admin
		.checkSuggestion({ ...request.body })
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

router.post('/send-suggestion', authAdminMiddleware, (request, response, next) => {
	const { to_email, suggest_email } = request.body;

	if (!to_email || !suggest_email) {
		return response.json({
			success: false,
			message: 'Missing required params: to_email, suggest_email',
		});
	}

	return admin
		.sendSuggestion({ ...request.body })
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

router.post('/add-users', upload.single('file'), authAdminMiddleware, (request, response, next) => {
	if (!request.file) {
		return request.status(400).send('No file uploaded.');
	}

	try {
		const filePath = request.file.path;
		const workbook = XLSX.readFile(filePath);

		const sheetNames = workbook.SheetNames;

		const usersData = [];

		sheetNames.forEach((sheetName) => {
			const worksheet = workbook.Sheets[sheetName];
			const rawUsers = XLSX.utils.sheet_to_json(worksheet, {
				header: 1,
			});
			for (let index = 1; index < rawUsers.length; index++) {
				const item = rawUsers[index];
				usersData.push({
					platform: item[11],
					email: item[13],
					gender: item[16],
					location: item[15],
					purpose: item[12],
					full_name: item[14],
				});
			}
		});

		fs.unlinkSync(filePath);

		return admin
			.createLeadUsers(usersData)
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
	} catch (error) {
		return response.json({
			success: false,
			message: `${error}`,
		});
	}
});

router.post('/register', (request, response, next) => {
	const { username, full_name, password } = request.body;

	if (!password || !username) {
		return response.json({
			success: false,
			message: 'Missing required params: password, username',
		});
	}

	return admin
		.createAdmin({ ...request.body })
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

router.post('/login', (request, response, next) => {
	const { username, password } = request.body;

	if (!password || !username) {
		return response.json({
			success: false,
			message: 'Missing required params: password, username',
		});
	}

	return admin
		.login({ ...request.body })
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

router.get('/users-list', authAdminMiddleware, (request, response, next) => {
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

router.post('/profile-action', authAdminMiddleware, (request, response, next) => {
	const { status, user_id } = request.body;

	if (!status || !user_id) {
		return response.json({
			success: false,
			message: 'Missing required params: status, user_id',
		});
	}

	return admin
		.profileAction({ ...request.body })
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

router.post('/add-version', authAdminMiddleware, (request, response, next) => {
	const { version_ios, version_android, is_required, description, version_title } =
		request.body;

	if (!version_ios || !version_android || !is_required || !description || !version_title) {
		return response.json({
			success: false,
			message: 'Missing required params: version_ios, version_android, is_required, description, version_title',
		});
	}

	return admin
		.addVersion({ ...request.body })
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

router.get('/matches', authAdminMiddleware, async (request, response, next) => {
	try {
		const matches = await admin.getMatches(request.query);
		return response.json({ ...matches, success: true });
	} catch (err) {
		console.log(err);
		return response.status(500).send(`Error while fetching matches: ${err}`);
	}
});

router.get('/matches/:matchId/messages', authAdminMiddleware, async (request, response, next) => {
	try {
		const match = await matches.getMatchById(request.params.matchId);

		if (!match) {
			return response.status(400).send('Match not found');
		}
		const res = await matches.getMessages(
			match.conversation_id,
			request.query.pageSize,
			request.query.nextToken
		);
		return response.json({ ...res, success: true });
	} catch (err) {
		console.log(err);
		return response.status(500).send(`Error while fetching matches: ${err}`);
	}
});

module.exports = router;
