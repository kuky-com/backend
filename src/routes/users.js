const express = require('express');
const users = require('@controllers/users');
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware');
const { blockedUserMiddleware } = require('../milddleware/blockedUserMiddleware');
const interests = require('@controllers/interests');

router.post('/update', authMiddleware, (request, response, next) => {
	const { user_id } = request;

	if (!user_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id',
		});
	}

	return users
		.updateProfile({ user_id, ...request.body })
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

router.post('/update-token', authMiddleware, (request, response, next) => {
	const { user_id, session_id } = request;
	const { session_token } = request.body;

	if (!user_id || !session_token || !session_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, session_token, session_id',
		});
	}

	return users
		.updateSessionToken({ user_id, session_id, ...request.body })
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

router.get('/user-info', authMiddleware, (request, response, next) => {
	const { user_id } = request;

	if (!user_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id',
		});
	}

	return users
		.getProfile({ user_id })
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

router.post('/friend-info', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { friend_id } = request.body;

	if (!user_id || !friend_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, friend_id',
		});
	}

	return users
		.getFriendProfile({ user_id, friend_id })
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
/**
 * Computes and return the most common journey between two users.
 */
router.get('/:userId/journey', authMiddleware, async (request, response, next) => {
	const { user_id: currentUserId } = request;
	const userId = request.params.userId;

	if (!currentUserId || !userId) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, user_id',
		});
	}

	const currentUserPurposes = (
		await interests.getPurposes({ user_id: currentUserId })
	).data.map((p) => ({ name: p.dataValues.name }));
	const friendPurposes = (await interests.getPurposes({ user_id: userId })).data.map((p) => ({
		name: p.dataValues.name,
	}));

	try {
		const commonPurpose = await interests.checkPurposeMatch(
			{ purposes: currentUserPurposes },
			{ purposes: friendPurposes }
		);

		response.status(200).json({
			success: true,
			data: commonPurpose[0],
		});
	} catch (err) {
		return response.status(400).json({ message: err.message });
	}
});

/**
 * Computes and return the common likes and dislikes between two users
 */
router.get('/:userId/common-interests', authMiddleware, async (request, response, next) => {
	const { user_id: currentUserId } = request;
	const userId = request.params.userId;

	if (!currentUserId || !userId) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, user_id',
		});
	}

	const currentUserLikes = (await interests.getLikes({ user_id: currentUserId })).data.map(
		(d) => d.dataValues
	);
	const friendLikes = (await interests.getLikes({ user_id: userId })).data.map(
		(d) => d.dataValues
	);

	const currentUserDislikes = (
		await interests.getDislikes({ user_id: currentUserId })
	).data.map((d) => d.dataValues);
	const friendDislikes = (await interests.getDislikes({ user_id: userId })).data.map(
		(d) => d.dataValues
	);

	try {
		// console.log(currentUserLikes, friendLikes, currentUserDislikes, friendDislikes);
		const interestList = await interests.checkInterestMatch(
			{ likes: currentUserLikes, dislikes: currentUserDislikes },
			{ likes: friendLikes, dislikes: friendDislikes }
		);

		response.status(200).json({
			success: true,
			data: interestList,
		});
	} catch (err) {
		return response.status(400).json({ message: err.message });
	}
});

// TODO: use the middleware here
router.get('/:userId/profile', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const friend_id = request.params.userId;

	if (!user_id || !friend_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, friend_id',
		});
	}

	return users
		.getFriendProfile({ user_id, friend_id })
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

router.post('/delete-account', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { reason } = request.body;

	if (!user_id || !reason) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, reason',
		});
	}

	return users
		.deleteAccount({ user_id, reason })
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

router.post('/deactive-account', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { reason } = request.body;

	if (!user_id || !reason) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, reason',
		});
	}

	return users
		.deactiveAccount({ user_id, reason })
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

router.post('/block-user', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { friend_id } = request.body;

	if (!user_id || !friend_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, friend_id',
		});
	}

	return users
		.blockUser({ user_id, friend_id })
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

router.post('/unblock-user', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { friend_id } = request.body;

	if (!user_id || !friend_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, friend_id',
		});
	}

	return users
		.unblockUser({ user_id, friend_id })
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

router.get('/blocked-users', authMiddleware, (request, response, next) => {
	const { user_id } = request;

	if (!user_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id',
		});
	}

	return users
		.getBlockedUsers({ user_id })
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

router.post('/report-user', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { reason, reported_id } = request.body;

	if (!user_id || !reported_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, reason',
		});
	}

	return users
		.reportUser({
			reporter_id: user_id,
			user_id: reported_id,
			reason,
		})
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

router.get('/latest-version', (request, response, next) => {
	return users
		.getLatestVersion()
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

router.post('/version-info', (request, response, next) => {
	const { version_ios, version_android } = request.body;

	if (!version_ios && !version_android) {
		return response.json({
			success: false,
			message: 'Missing required params: version_ios or version_android',
		});
	}

	return users
		.getVersionInfo({ ...request.body })
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

router.get('/disclaime', (request, response, next) => {
	return users
		.getDisclaime()
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

router.get('/:userId/share-link', authMiddleware, async (request, response, next) => {
	return users
		.getShareLink({ userId: request.params.userId })
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

router.get('/reapply-profile-review', authMiddleware, async (request, response, next) => {
	const { user_id } = request;

	return users
		.reapplyProfileReview({ userId: user_id })
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

router.get('/:userId/reapply-profile-review', authMiddleware, async (request, response, next) => {
	return users
		.reapplyProfileReview({ userId: request.params.userId })
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

/**    REVIEWS SECTION  */
router.get(
	'/:userId/reviews',
	[authMiddleware, blockedUserMiddleware(true)],
	async (request, response, next) => {
		try {
			const result = await users.getReviews({
				userId: request.params.userId,
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

router.post(
	'/:userId/reviews',
	[authMiddleware, blockedUserMiddleware(true)],
	(request, response, next) => {
		const { user_id } = request;
		const { rating } = request.body;
		const friend_id = request.params.userId;
		if (!user_id || !friend_id || !rating) {
			return response.json({
				success: false,
				message: 'Missing required params: user_id, friend_id, rating',
			});
		}

		return users
			.reviewUser({
				user_id: friend_id,
				reviewer_id: user_id,
				...request.body,
			})
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
	}
);

module.exports = router;
