const express = require('express');
const users = require('@controllers/users');
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware');
const {
	blockedUserMiddleware,
} = require('../milddleware/blockedUserMiddleware');

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
    const { user_id } = request
    const { friend_id } = request.body

    if (!user_id || !friend_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id"
        })
    }

    return users.getFriendProfile({ user_id, friend_id }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

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

router.get('/:userId/share-link',
	authMiddleware,
	async (request, response, next) => {
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

router.get('/:userId/reapply-profile-review',
	authMiddleware,
	async (request, response, next) => {
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
