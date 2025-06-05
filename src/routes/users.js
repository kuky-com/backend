const express = require('express');
const users = require('@controllers/users');
const common = require('@controllers/common');
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware');
const optionAuthMiddleware = require('../milddleware/optionAuthMiddleware');
const { blockedUserMiddleware } = require('../milddleware/blockedUserMiddleware');
const interests = require('@controllers/interests');
const { requestCompleteProfileAction } = require('@controllers/admin');
const SessionLog = require('../models/session_logs');
const { v4: uuidv4 } = require('uuid');

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

	return common
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

router.post('/friend-info', optionAuthMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { friend_id } = request.body;

	if (!friend_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, friend_id',
		});
	}

	return common
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

	return common
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

router.get(
	'/:userId/readyForCall',
	authMiddleware,
	async (request, response, next) => {
		try {
			const APP_ID = process.env.SENDBIRD_APP_ID
			const API_TOKEN = process.env.SENDBIRD_TOKEN
			const userId = request.params.userId

			try {
				const res = await fetch(`https://api-${APP_ID}.sendbird.com/v3/users/${userId}`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'Api-Token': API_TOKEN,
					},
				});

				if (res.ok) {
					const user = await res.json();

					if (user && user.is_active) {
						return response.json({
							success: true,
						});
					} else {
						return response.json({
							success: false,
						});
					}

				} else {
					return response.json({
						success: false,
					});
				}
			} catch (error) {
				console.log({ error })
				return response.json({
					success: false,
				});
			}
		} catch (err) {
			console.log({ err })
			return response.json({
				success: false,
				message: `${err}`,
			});
		}
	}
);

router.get('/update-last-active', authMiddleware, (request, response, next) => {
	const { user_id } = request;

	return users
		.updateLastActive({ user_id })
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

router.post(
	'/use-referral',
	[authMiddleware],
	(request, response, next) => {
		const { user_id } = request;
		const { referral_code } = request.body;

		if (!user_id || !referral_code) {
			return response.json({
				success: false,
				message: 'Missing required params: user_id, referral_code',
			});
		}

		return users
			.useReferral({
				user_id,
				referral_code: referral_code.toLowerCase()
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

router.post(
	'/iapProducts',
	[authMiddleware],
	(request, response, next) => {
		const { user_id } = request;
		const { platform } = request.body;

		if (!user_id || !platform) {
			return response.json({
				success: false,
				message: 'Missing required params: user_id, platform',
			});
		}

		return users
			.getIapProducts({
				user_id,
				platform
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

router.post(
	'/scan-image',
	(request, response, next) => {
		const { image } = request.body;

		if (!image) {
			return response.json({
				success: false,
				message: 'Missing required params: image',
			});
		}

		return users
			.scanImage({
				image
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


router.post('/sessions', authMiddleware, async (req, res) => {
	const { user_id } = req;
	const session_id = uuidv4()
	const { device_id, platform, start_time, screen_name } = req.body;

	try {
		const latestSession = await SessionLog.findOne({
			where: {
				user_id,
				device_id,
			},
			order: [['start_time', 'DESC']],
		});

		if (latestSession && new Date() - new Date(latestSession.start_time) < 3 * 1000) {
			return res.status(200).json({
				message: 'Session already exists',
				data: {
					session_id: latestSession.session_id,
					user_id: latestSession.user_id,
					device_id: latestSession.device_id,
					platform: latestSession.platform,
					start_time: latestSession.start_time,
				},
			});
		}

		await SessionLog.update(
			{ end_time: new Date(new Date(start_time).getTime() + 1000) },
			{
				where: {
					user_id,
					device_id,
					end_time: null,
				},
			}
		);

		await SessionLog.create({
			session_id,
			user_id,
			device_id,
			platform,
			start_time,
			screen_name: screen_name || 'index'
		});

		res.status(200).json({
			message: 'Session created',
			data: {
				session_id,
				user_id,
				device_id,
				platform,
				start_time,
			},
		});
	} catch (error) {
		console.log({ error })
		res.status(500).json({ error: 'Failed to create session' });
	}
});

router.put('/sessions/:session_id', authMiddleware, async (req, res) => {
	const { user_id } = req;
	const { session_id } = req.params;
	const { end_time } = req.body;

	try {
		const session = await SessionLog.findOne({
			where: {
				session_id,
				user_id,
			},
		});
		if (!session) {
			return res.status(404).json({ error: 'Session not found or does not belong to the user' });
		}

		const startTime = new Date(session.start_time);
		const endTime = new Date(end_time);

		if (endTime - startTime > 20 * 60 * 1000) {
			session.end_time = new Date(startTime.getTime() + 20 * 60 * 1000);
		} else {
			session.end_time = endTime;
		}

		await session.save();

		res.json({ message: 'Session updated' });
	} catch (error) {
		res.status(500).json({ error: 'Failed to update session' });
	}
});

router.get(
	'/stats',
	authMiddleware,
	async (request, response, next) => {
		const { user_id } = request;

		try {
			const result = await users.getStats({
				user_id: user_id,
				...request.query
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

router.get('/avatar', authMiddleware, (request, response, next) => {
	const { user_id } = request;

	return common
		.getUserAvatar(user_id)
		.then((data) => {
			return response.json({
				success: true,
				data: data,
				message: 'Get avatar success',
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.get('/:userId/analyze-user', authMiddleware, (request, response, next) => {
	const user_id = request.params.userId

	if (!user_id) {
		return response.json({
			success: false,
			message: "Missing required params: user_id"
		})
	}

	return common.analyzeUser(user_id).then(({ data, message }) => {
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

router.post('/send-user-invitation', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { recipients } = request.body;

	if (!user_id || !recipients) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, recipients',
		});
	}

	return users.sendUserInvitation({user_id, recipients}).then(({ data, message }) => {
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

// router.get('/test-email', (request, response, next) => {

//     return requestCompleteProfileAction({ user_id: 4 }).then(({ data, message }) => {
//         return response.json({
//             success: true,
//             data: data,
//             message: message
//         })
//     })
//         .catch((error) => {
//             return response.json({
//                 success: false,
//                 message: `${error}`
//             })
//         })
// })

module.exports = router;
