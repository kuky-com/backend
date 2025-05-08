'use strict';

const express = require('express');
const auth = require('@controllers/auth');
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware');
const sendbird = require('@controllers/sendbird');
const multer = require('multer');

router.post('/register', (request, response, next) => {
	const { full_name, email, password } = request.body;

	if (!email || !password || !full_name) {
		return response.json({
			success: false,
			message: 'Missing required params: email, password, full_name',
		});
	}

	return auth
		.signUp({ ...request.body })
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

router.get('/sendbird-token', authMiddleware, async (req, response, next) => {
	const { user_id } = req;

	try {
		const sendbirdToken = await sendbird.generateSendbirdToken(
			user_id
		);
		return response.json({
			success: true,
			data: {
				sendbirdToken,
			},
		});
	} catch (err) {
		return response.json({
			success: false,
			message: 'Error while regenerating token',
		});
	}
});

router.post('/verify', (request, response, next) => {
	const { email, code } = request.body;

	if (!email || !code) {
		return response.json({
			success: false,
			message: 'Missing required params: email, code',
		});
	}

	return auth
		.verifyEmail({ ...request.body })
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

router.post('/resend-verification', (request, response, next) => {
	const { email } = request.body;

	if (!email) {
		return response.json({
			success: false,
			message: 'Missing required params: email',
		});
	}

	return auth
		.resendVerification({ ...request.body })
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
	const { email, password } = request.body;

	if (!email || !password) {
		return response.json({
			success: false,
			message: 'Missing required params: email, password',
		});
	}

	return auth
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

router.post('/google', (request, response, next) => {
	const { token } = request.body;

	if (!token) {
		return response.json({
			success: false,
			message: 'Missing required params: token',
		});
	}

	return auth
		.googleLogin({ ...request.body })
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

router.post('/apple', (request, response, next) => {
	const { token } = request.body;

	if (!token) {
		return response.json({
			success: false,
			message: 'Missing required params: token',
		});
	}

	return auth
		.appleLogin({ ...request.body })
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

router.get('/logout', authMiddleware, (request, response, next) => {
	const { session_id } = request;

	return auth
		.logout({ session_id })
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

router.get('/get-onetime-auth', authMiddleware, (request, response, next) => {
	const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

	return auth
		.getOnetimeAuth({ user_id })
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

router.post('/use-onetime-auth', (request, response, next) => {
	const { session_code } = request.body;

	if (!session_code) {
		return response.json({
			success: false,
			message: 'Missing required params: session_code',
		});
	}


	return auth
		.useOnetimeAuth({...request.body})
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

router.post('/update-password', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { current_password, new_password } = request.body;

	if (!current_password || !new_password || !user_id) {
		return response.json({
			success: false,
			message: 'Missing required params: current_password, new_password, user_id',
		});
	}

	return auth
		.updatePassword({ current_password, new_password, user_id })
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
