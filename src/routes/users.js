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
const { checkUnreadMessages, checkUnreadMessagesForUser } = require('../controllers/cron/unreadMessage');
const { analyzeUserTags, analyzeAllUserTags } = require('../controllers/common');
const { validateUnsubscribeToken } = require('../utils/emailUtils');
const Users = require('../models/users');

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

router.post('/delete-video', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { type } = request.body;

	if (!user_id || !type) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id, type',
		});
	}

	return users
		.deleteVideo(user_id, type)
		.then(({ message }) => {
			return response.json({
				success: true,
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
		.updateLastActive({ user_id, req: request })
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
	const { device_id, platform, start_time, screen_name, receiver_id } = req.body;

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
			screen_name: screen_name || 'index',
			receiver_id
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

router.get('/moderator-faqs', authMiddleware, (request, response, next) => {

	return users
		.getModeratorFAQs()
		.then((data) => {
			return response.json({
				success: true,
				data: data,
				message: 'Get moderator faqs success',
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.get('/re-tagging', (request, response, next) => {
	const { user_id } = request.query;
	if (user_id) {
		return users
		.analyzeTranscriptionAndCreateTags(user_id, '', '')
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

    return analyzeAllUserTags().then(({ data, message }) => {
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


// router.get('/test-unread', (request, response, next) => {

//     return checkUnreadMessagesForUser(4).then(({ data, message }) => {
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

router.post('/analyze-transcription', authMiddleware, (request, response, next) => {
	const { user_id } = request;
	const { transcript_text, video_type } = request.body;

	if (!user_id || !transcript_text || !video_type) {
		return response.json({
			success: false,
			message: 'Missing required params: transcript_text, video_type',
		});
	}

	return users
		.analyzeTranscriptionAndCreateTags(user_id, transcript_text, video_type)
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

router.get('/subscription-status', authMiddleware, async (request, response, next) => {
	const { user_id } = request;

	if (!user_id) {
		return response.json({
			success: false,
			message: 'Missing required params: user_id',
		});
	}

	try {
		const Users = require('../models/users');
		const user = await Users.findByPk(user_id, {
			attributes: [
				'id',
				'is_premium_user',
				'subscription_status',
				'subscription_expires_at',
				'subscription_product_id',
				'subscription_updated_at'
			]
		});

		if (!user) {
			return response.json({
				success: false,
				message: 'User not found',
			});
		}

		const subscriptionData = user.toJSON();
		
		// Add computed fields
		subscriptionData.is_active = ['active', 'trial'].includes(subscriptionData.subscription_status);
		subscriptionData.expires_soon = false;
		
		if (subscriptionData.subscription_expires_at) {
			const expirationDate = new Date(subscriptionData.subscription_expires_at);
			const now = new Date();
			const daysUntilExpiration = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
			subscriptionData.days_until_expiration = daysUntilExpiration;
			subscriptionData.expires_soon = daysUntilExpiration <= 7 && daysUntilExpiration > 0;
		}

		return response.json({
			success: true,
			data: subscriptionData,
			message: 'Subscription status retrieved successfully',
		});
	} catch (error) {
		return response.json({
			success: false,
			message: `${error}`,
		});
	}
});

// Unsubscribe from email route
router.get('/unsubscribe/:token', async (req, res) => {
	try {
		const { token } = req.params;
		
		// Validate and decode the token
		const tokenData = validateUnsubscribeToken(token);
		
		if (!tokenData) {
			return res.status(400).send(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Invalid Unsubscribe Link - Kuky</title>
					<style>
						body { font-family: Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 40px; }
						.container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
						.error { color: #e74c3c; }
					</style>
				</head>
				<body>
					<div class="container">
						<h1 class="error">Invalid Unsubscribe Link</h1>
						<p>This unsubscribe link is invalid or has expired. Please contact support if you continue to receive unwanted emails.</p>
					</div>
				</body>
				</html>
			`);
		}

		// Find user by email
		const user = await Users.findOne({
			where: { email: tokenData.email }
		});

		if (!user) {
			return res.status(404).send(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>User Not Found - Kuky</title>
					<style>
						body { font-family: Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 40px; }
						.container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
						.error { color: #e74c3c; }
					</style>
				</head>
				<body>
					<div class="container">
						<h1 class="error">User Not Found</h1>
						<p>We couldn't find an account associated with this unsubscribe link.</p>
					</div>
				</body>
				</html>
			`);
		}

		// Update user's email subscription preferences
		await Users.update(
			{ 
				subscribeEmail: false,
				emailNotificationEnable: false 
			},
			{ 
				where: { id: user.id } 
			}
		);

		// Return success page
		return res.send(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Successfully Unsubscribed - Kuky</title>
				<style>
					body { font-family: Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 40px; }
					.container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
					.success { color: #27ae60; }
					.logo { margin-bottom: 30px; }
					h1 { margin-bottom: 20px; }
					p { line-height: 1.6; color: #555; margin-bottom: 15px; }
					.highlight { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
					.footer { margin-top: 30px; font-size: 12px; color: #888; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="logo">
						<h2 style="color: #3498db; margin: 0;">Kuky</h2>
					</div>
					<h1 class="success">✓ Successfully Unsubscribed</h1>
					<p>You have been successfully unsubscribed from all email notifications from Kuky.</p>
					<div class="highlight">
						<p><strong>Email:</strong> ${user.email}</p>
						<p>You will no longer receive promotional emails or email notifications from our platform.</p>
					</div>
					<p>If you change your mind, you can always re-enable email notifications from your account settings in the Kuky app.</p>
					<div class="footer">
						<p>If you believe this was done in error, please contact our support team.</p>
					</div>
				</div>
			</body>
			</html>
		`);

	} catch (error) {
		console.error('Unsubscribe error:', error);
		return res.status(500).send(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Error - Kuky</title>
				<style>
					body { font-family: Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 40px; }
					.container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
					.error { color: #e74c3c; }
				</style>
			</head>
			<body>
				<div class="container">
					<h1 class="error">Something went wrong</h1>
					<p>We encountered an error while processing your unsubscribe request. Please try again later or contact support.</p>
				</div>
			</body>
			</html>
		`);
	}
});

module.exports = router;
