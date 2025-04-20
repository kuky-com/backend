const Users = require('@/models/users');
const VerificationCode = require('@/models/verification_code');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const Sessions = require('../models/sessions');
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const UserPurpose = require('../models/user_purposes');
const UserInterest = require('../models/user_interests');
const BlockedUsers = require('../models/blocked_users');
const InactiveUsers = require('../models/inactive_users');
const Tags = require('../models/tags');
const Matches = require('../models/matches');
const { Op, where } = require('sequelize');
const ReportUsers = require('../models/report_users');
const ReviewUsers = require('../models/review_users');
const ReferralUsers = require('../models/referral_users');
const AppVersions = require('../models/versions');
const Sequelize = require('../config/database');
const { isStringInteger, generateReferralCode, parseFormattedCallSeconds } = require('../utils/utils');
const ProfileViews = require('../models/profile_views');
const { updateRejectedDateTag } = require('./onesignal');
var admin = require('firebase-admin');

const { DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
const { rekognitionClient } = require('../config/rekognitionClient');
const Journeys = require('../models/journeys');
const JourneyCategories = require('../models/journey_categories');
const JPFAnswers = require('../models/jpf_answers');
const JPFUserAnswer = require('../models/jpf_user_answers');
const dayjs = require('dayjs');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function updateProfile({
	user_id,
	full_name,
	gender,
	location,
	pronouns,
	birthday,
	...restParams
}) {
	try {
		const updates = { ...restParams };
		if (full_name) updates.full_name = full_name;
		if (gender) updates.gender = gender;
		if (location) updates.location = location;
		if (pronouns) updates.pronouns = pronouns;
		if (birthday) updates.birthday = birthday;
		// if (publicGender) updates.publicGender = publicGender;
		// if (publicPronouns) updates.publicPronouns = publicPronouns;
		// if (notificationEnable) updates.notificationEnable = notificationEnable;
		// if (subscribeEmail) updates.subscribeEmail = subscribeEmail;
		// if (emailNotificationEnable) updates.emailNotificationEnable = emailNotificationEnable;

		if (restParams.journey_category_id && !restParams.journey_id) {
			updates.journey_id = null
		}

		const updatedUser = await Users.update(updates, {
			where: { id: user_id },
			returning: true,
			plain: true,
		})

		if (restParams.journey_category_id || restParams.journey_id) {
			await JPFUserAnswer.update({ is_active: false }, {
				where: { user_id: user_id }
			})
		}

		if (restParams.video_intro) {
			updateSubtitle(user_id, restParams.video_intro, 'subtitle_intro')
		} else if (restParams.audio_intro) {
			updateSubtitle(user_id, restParams.audio_intro, 'subtitle_intro')
		}

		if (restParams.video_purpose) {
			updateSubtitle(user_id, restParams.video_purpose, 'subtitle_purpose')
		} else if (restParams.audio_purpose) {
			updateSubtitle(user_id, restParams.audio_purpose, 'subtitle_purpose')
		}

		if (restParams.video_challenge) {
			updateSubtitle(user_id, restParams.video_challenge, 'subtitle_challenge')
		} else if (restParams.audio_challenge) {
			updateSubtitle(user_id, restParams.audio_challenge, 'subtitle_challenge')
		}

		if (restParams.video_why) {
			updateSubtitle(user_id, restParams.video_why, 'subtitle_why')
		} else if (restParams.audio_why) {
			updateSubtitle(user_id, restParams.audio_why, 'subtitle_why')
		}

		if (restParams.video_interests) {
			updateSubtitle(user_id, restParams.video_interests, 'subtitle_interests')
		} else if (restParams.audio_interests) {
			updateSubtitle(user_id, restParams.audio_interests, 'subtitle_interests')
		}

		if(restParams.is_video_intro_blur && restParams.video_intro) {
			updateBlurVideo(user_id, restParams.video_intro, 'video_intro_blur')
		}
		if(restParams.is_video_purpose_blur && restParams.video_purpose) {
			updateBlurVideo(user_id, restParams.video_purpose, 'video_purpose_blur')
		}

		if (updates.avatar || updates.full_name) {
			const sendbirdPayload = {};
			if (updates.avatar) {
				sendbirdPayload.profile_url = updates.avatar;
			}
			if (updates.full_name) {
				sendbirdPayload.nickname = updates.full_name;
			}
			const sendbird = require('./sendbird');
			await sendbird.updateSendbirdUser(user_id, sendbirdPayload);
		}

		const userInfo = await getUser(user_id);

		return Promise.resolve({
			data: userInfo,
			message: 'Update successfully',
		});
	} catch (error) {
		return Promise.reject(error);
	}
}

async function updateSubtitle(user_id, media_url, type) {
	try {
		const response = await axios.post('https://6sx3m5nsmex2xyify3lb3x7s440xkxud.lambda-url.ap-southeast-1.on.aws', {
			audio_uri: media_url,
			type: type
		})

		if (response && response.data && response.data.s3_url) {
			await Users.update({ [type]: response.data.s3_url }, {
				where: { id: user_id },
				returning: true,
				plain: true,
			});
		}

		return Promise.resolve({
			message: 'Update successfully',
		});
	} catch (error) {

	}
}

async function updateBlurVideo(user_id, media_url, type) {
	try {
		await Users.update({ [type]: null }, {
			where: { id: user_id },
			returning: true,
			plain: true,
		});

		const response = await axios.post('https://h73gkjldkyjxyc4ygsguvon35u0zncvs.lambda-url.ap-southeast-1.on.aws/', {
			video_uri: media_url,
			type: type
		})

		if (response && response.data && response.data.blurred_video_url) {
			await Users.update({ [type]: response.data.blurred_video_url }, {
				where: { id: user_id },
				returning: true,
				plain: true,
			});
		}

		return Promise.resolve({
			message: 'Update successfully',
		});
	} catch (error) {

	}
}

async function getReviewStats(user_id) {
	const reviewsObj = await Users.findOne({
		where: { id: user_id },
		attributes: {
			include: [
				[
					Sequelize.fn('COUNT', Sequelize.col('reviews.id')),
					'reviewsCount',
				],
				[Sequelize.fn('AVG', Sequelize.col('reviews.rating')), 'avgRating'],
			],
		},
		group: ['users.id'],
		include: [
			{
				model: ReviewUsers,
				attributes: [],
				as: 'reviews',
				where: {
					status: 'approved',
				},
			},
		],
	});
	const data = reviewsObj?.toJSON();
	return {
		reviewsCount: data?.reviewsCount || 0,
		avgRating: data?.avgRating || 0,
	};
}

async function getSimpleProfile({ user_id }) {
	try {
		try {
			const user = await Users.scope(['simpleProfile', 'blurVideo']).findOne({
				where: { id: user_id },
				include: [{ model: Journeys }, { model: JourneyCategories }],
			});

			if (!user) {
				return Promise.reject('User not found');
			}

			console.log({user})

			const reviewsData = await getReviewStats(user_id);

			return Promise.resolve({
				message: 'User info retrieved successfully',
				data: {
					...user.toJSON(),
					reviewsCount: reviewsData.reviewsCount,
					avgRating: reviewsData.avgRating,
				},
			});
		} catch (error) {
			console.log('Error fetching user info:', error);
			return Promise.reject(error);
		}
	} catch (error) {
		console.log('Error fetching user info:', error);
		return Promise.reject(error);
	}
}


async function getProfile({ user_id }) {
	try {
		const user = await Users.scope(['askJPFGeneral', 'askJPFSpecific', 'withInterestCount', 'includeBlurVideo']).findOne({
			where: { id: user_id },
			include: [
				{ model: Purposes },
				{ model: Interests },
				{ model: Tags },
				{ model: Journeys },
				{ model: JourneyCategories }
			],
		});

		if (!user) {
			return Promise.reject('User not found');
		}

		const reviewsData = await getReviewStats(user_id);

		return Promise.resolve({
			message: 'User info retrieved successfully',
			data: {
				...user.toJSON(),
				reviewsCount: reviewsData.reviewsCount,
				avgRating: reviewsData.avgRating,
			},
		});
	} catch (error) {
		console.log('Error fetching user info:', error);
		return Promise.reject(error);
	}
}

async function getReviews({ userId }) {
	const reviews = await ReviewUsers.findAll({
		where: {
			user_id: userId,
			status: 'approved',
		},
		order: [['createdAt', 'DESC']],
		include: [
			{
				model: Users,
				as: 'reviewer', // Alias defined in the association
				attributes: ['id', 'full_name', 'avatar'], // Specify the fields you want from the reviewer
			},
		],
	});
	const reviewsData = await getReviewStats(userId);
	return { reviews, ...reviewsData };
}

async function getFriendProfile({ user_id, friend_id }) {
	try {
		const findCondition = isStringInteger(friend_id)
			? { id: friend_id }
			: Sequelize.where(
				Sequelize.fn('LOWER', Sequelize.col('referral_id')),
				friend_id.toString().trim().toLowerCase()
			);

		const user = await Users.scope(['includeBlurVideo']).findOne({
			where: findCondition,
			include: [{ model: Purposes }, { model: Journeys }, { model: JourneyCategories }, { model: Interests }, { model: Tags }],
		});

		if (!user) {
			return Promise.reject('User not found');
		}

		if (user_id) {
			const blocked = await BlockedUsers.findOne({
				where: {
					[Op.or]: [
						{
							user_id: user_id,
							blocked_id: user.id,
						},
						{
							user_id: user.id,
							blocked_id: user_id,
						},
					],
				},
			});

			if (blocked) {
				return Promise.resolve({
					message: 'User info retrieved successfully',
					data: {
						blocked: true,
						user: {},
						match: null,
					},
				});
			}
		}


		if (user_id) {
			await ProfileViews.create({
				userId: user.id,
				viewerId: user_id,
			});
		}

		let match = null

		if (user_id) {
			match = await Matches.scope({ method: ['withIsFree', user_id] }).findOne({
				where: {
					[Op.or]: [
						{ sender_id: user_id, receiver_id: user.id },
						{ sender_id: user.id, receiver_id: user_id },
					],
				},
				order: [['id', 'desc']],
			});
		}

		const reviewsData = await getReviewStats(user.id);

		return Promise.resolve({
			message: 'User info retrieved successfully',
			data: {
				user: {
					...user.toJSON(),
					reviewsCount: reviewsData.reviewsCount,
					avgRating: reviewsData.avgRating,
				},

				match,
			},
		});
	} catch (error) {
		console.log('Error fetching user info:', error);
		return Promise.reject(error);
	}
}

async function getUser(user_id) {
	try {
		const user = await Users.scope(['askJPFGeneral', 'askJPFSpecific', 'withInterestCount', 'includeBlurVideo']).findOne({
			where: { id: user_id },
			attributes: { exclude: ['password'] },
			include: [{ model: Purposes }, { model: Interests }, { model: Tags }, { model: Journeys }, { model: JourneyCategories }],
		});

		console.log({user})

		if (!user) {
			return Promise.reject('User not found');
		}

		return Promise.resolve(user);
	} catch (error) {
		console.log('Error fetching user info:', error);
		return Promise.reject(error);
	}
}

async function blockUser({ user_id, friend_id }) {
	try {
		await BlockedUsers.create({
			user_id: user_id,
			blocked_id: friend_id,
		});

		await Matches.update(
			{ status: 'deleted' },
			{
				where: {
					[Op.or]: [
						{
							sender_id: user_id,
							receiver_id: friend_id,
						},
						{
							sender_id: friend_id,
							receiver_id: user_id,
						},
					],
				},
			}
		);

		return Promise.resolve({
			message: 'User has been blocked!',
		});
	} catch (error) {
		console.log('Error block user:', error);
		return Promise.reject(error);
	}
}

async function unblockUser({ user_id, friend_id }) {
	try {
		await BlockedUsers.destroy({
			where: {
				user_id: user_id,
				blocked_id: friend_id,
			},
		});

		return Promise.resolve({
			message: 'User has been unblocked!',
		});
	} catch (error) {
		console.log('Error block user:', error);
		return Promise.reject(error);
	}
}

async function getBlockedUsers({ user_id }) {
	try {
		const users = await BlockedUsers.findAll({
			where: {
				user_id: user_id,
			},
			include: [{ model: Users, as: 'blockedUser' }],
		});

		return Promise.resolve({
			message: 'User has been unblocked!',
			data: users,
		});
	} catch (error) {
		console.log('Error block user:', error);
		return Promise.reject(error);
	}
}

async function deactiveAccount({ user_id }) {
	try {
		const updatedUser = await Users.update(
			{ is_active: false },
			{
				where: { id: user_id },
				returning: true,
				plain: true,
			}
		);

		return Promise.resolve({
			message: 'User has been deactived!',
			data: updatedUser,
		});
	} catch (error) {
		console.log('Error deactive user:', error);
		return Promise.reject(error);
	}
}

async function deleteAccount({ user_id, reason }) {
	try {
		const user = await Users.findOne({
			where: {
				id: user_id,
			},
			raw: true,
		});
		delete user.id;

		await InactiveUsers.create({
			...user,
			inactive_type: 'self-deleted',
			user_id: user_id,
			reason,
		});

		const updatedUser = await Users.update(
			{
				is_active: false,
				email: `deletedAccount${user_id}@kuky.com`,
			},
			{
				where: {
					id: user_id,
				},
			}
		);

		return Promise.resolve({
			message: 'User has been deleted!',
			data: updatedUser,
		});
	} catch (error) {
		console.log('Error delete user:', error);
		return Promise.reject(error);
	}
}

async function reportUser({ user_id, reporter_id, reason }) {
	try {
		const reportUser = await ReportUsers.create({
			user_id,
			reason,
			reporter_id,
		});

		return Promise.resolve({
			message: 'User has been reported!',
			data: reportUser,
		});
	} catch (error) {
		console.log('Error report user:', error);
		return Promise.reject(error);
	}
}

async function updateSessionToken({ user_id, session_id, session_token }) {
	try {
		const updatedSession = await Sessions.update(
			{
				session_token: session_token,
				last_active: new Date(),
			},
			{
				where: { user_id: user_id, id: session_id },
				plain: true,
			}
		);

		return Promise.resolve({
			data: updatedSession,
			message: 'Update successfully',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function reviewUser({ user_id, reviewer_id, rating, reason, note }) {
	try {
		await ReviewUsers.create({
			user_id,
			reviewer_id,
			rating,
			reason,
			note,
		});

		return Promise.resolve({
			message: 'Review has been added',
		});
	} catch (error) {
		console.log('Error review user:', error);
		return Promise.reject(error);
	}
}

async function useReferral({ user_id, referral_code }) {
	try {
		console.log(user_id, referral_code);
		const user = await Users.findOne({
			where: { referral_id: referral_code },
			attributes: { exclude: ['password'] },
		});

		if (!user) {
			return Promise.reject('Referral code not found');
		}

		await ReferralUsers.create({
			user_id,
			referral_code,
			referral_id: user.id
		});

		return Promise.resolve({
			message: 'Referral has been added',
		});
	} catch (error) {
		console.log('Error use referral code:', error);
		return Promise.reject(error);
	}
}


async function getIapProducts({ user_id, platform }) {
	try {

		const existReferral = await ReferralUsers.findOne({
			where: {
				[Op.or]: [
					{ user_id: user_id },
					{ referral_id: user_id, }
				]
			},
		})

		if (existReferral) {
			const products = platform === 'ios' ? ["com.kuky.ios.1month_pro", "com.kuky.ios.6month_pro", "com.kuky.ios.12month_pro"] : ["com.kuky.android.1month_pro", "com.kuky.android.6month_pro", "com.kuky.android.12month_pro"];
			return Promise.resolve({
				message: 'IAP products',
				data: {
					products,
					title: 'Includes 3 Months free trial',
				},
			});
		} else {
			const products = platform === 'ios' ? ["com.kuky.ios.1month", "com.kuky.ios.6month", "com.kuky.ios.12month"] : ["com.kuky.android.1month", "com.kuky.android.6month", "com.kuky.android.12month"];
			return Promise.resolve({
				message: 'IAP products',
				data: {
					products,
					title: 'Includes 1 Month free trial',
				}
			});
		}
	} catch (error) {
		console.log('Error use referral code:', error);
		return Promise.reject(error);
	}
}

async function updateLastActive({ user_id }) {
	try {
		const user = await Users.findOne({
			where: { id: user_id }
		});

		if (!user) {
			return Promise.reject('User not found');
		}

		user.last_active_time = new Date();
		user.save()

		return Promise.resolve({
			message: 'Last active time updated',
		});
	} catch (error) {
		console.log('Error updateLastActive:', error);
		return Promise.reject(error);
	}
}

async function getLatestVersion() {
	try {
		const version = await AppVersions.findOne({
			order: [['version_title', 'desc']],
		});

		return Promise.resolve({
			message: 'Latest version',
			data: version,
		});
	} catch (error) {
		console.log('Error latest version:', error);
		return Promise.reject(error);
	}
}

async function getVersionInfo({ version_ios, version_android }) {
	try {
		let version = null;

		if (version_ios) {
			version = await AppVersions.findOne({
				where: {
					version_ios: version_ios,
				},
			});
		} else {
			version = await AppVersions.findOne({
				where: {
					version_android: version_android,
				},
			});
		}

		return Promise.resolve({
			message: 'Version info',
			data: version,
		});
	} catch (error) {
		console.log('Error version info:', error);
		return Promise.reject(error);
	}
}

async function getDisclaime() {
	try {
		const disclaime =
			`Kuky is a peer support network designed to connect individuals facing similar mental and health-related challenges.\n\n` +
			`Please note that Kuky is not a substitute for professional medical or mental health care.\n\n` +
			`We strongly encourage all members to seek professional advice and continue their existing treatment or therapy when necessary.\n\n` +
			`Always consult with a qualified healthcare provider regarding any questions or concerns about your health.`;

		return Promise.resolve({
			message: 'Disclaime information',
			data: disclaime,
		});
	} catch (error) {
		console.log('Error Disclaime info:', error);
		return Promise.reject(error);
	}
}

async function getShareLink({ userId }) {
	try {
		const user = await Users.findOne({
			where: {
				id: userId,
			},
			attributes: ['referral_id'],
		});

		if (!user) {
			return Promise.resolve({
				message: 'Profile share link',
				data: '',
			});
		}

		const shareLink = `https://kuky.com/profile/${user.referral_id}`;
		return Promise.resolve({
			message: 'Profile share link',
			data: shareLink,
		});
	} catch (error) {
		console.log('Error profile link:', error);
		return Promise.reject(error);
	}
}

async function reapplyProfileReview({ userId }) {
	try {
		await Users.update(
			{
				profile_approved: 'resubmitted',
			},
			{
				where: { id: userId },
				returning: true,
				plain: true,
			}
		);

		const userInfo = await getUser(userId);

		try {
			updateRejectedDateTag(userId, 'resubmitted')
		} catch (error) {
			console.log({ error })
		}

		return Promise.resolve({
			data: userInfo,
			message: 'Update successfully',
		});
	} catch (error) {
		return Promise.reject(error);
	}
}

async function updateUserNote({ userId, note }) {
	return Users.update(
		{
			note,
		},
		{ where: { id: userId } }
	);
}
/**
 * user1: { 
	purposes: [
{ name: 'p1', id: 1 },
{name: 'p2', id: 2 }
	]
likes: [ { 
name: 'puppies',
id: 1,
} , ...],
 dislikes: [{name: 'cats', id: 2 }, ...]

 user2: same ...
}
 *  */
async function checkMatchingUsers(user1, user2) {
	const message = `
		Hey! I'm building an app that matches users based on common purposes, likes and dislikes. 
		The most important thing in the match is the purpose, then likes and then dislikes. 

		When two users are matched, we want to show them a reason for their match, a reason to start a conversation. 
		For example, if one user purpose is 'learning guitar' and another user purpose is 'learning to play drums' we 
		want to show them a prompt saying "You are both learning a musical instrument".  Basically, their common interest,
		a reason that they should talk. 
		
		The same for interests. 

		Based on both users intersts likes, and dislikes please return this message. Also, from the list of user2 interests, show the purpose/like/dislike 
		that made you choose that specific message.
		If the users don't have nothing in common, please leve the message purpose.
		Return the response in the following format

		{
		"message": "Discuss your shared love for cooking." 
		"reasons": [
			{
				purpose: {
					id: user2purposeID,
					name: Purpose name
				}
			},
			{ 
				like: {
					id: user2LikeId,
					name: Like name
				}
			},
			{
				dislike: { 
					id: user2DislikeId,
					name: dislike name
				}
			}
		]
		}

		Again, the reasons should be chosen from the user2 data. You can have as many reasons as you want, even 0. 

		User1 Data: ${JSON.stringify(user1)}
		user2 Data: ${JSON.stringify(user2)}
	`;
}

async function updateExistingUsersReferral() {
	try {
		const users = await Users.findAll();
		// Step 1: Set a temporary unique placeholder for all referral_id values
		for (const user of users) {
			const tempReferralId = `temp_${user.id}_${Date.now()}`;
			console.log(`Updated temp: ${user.full_name} -> ${tempReferralId}`);
			user.referral_id = tempReferralId;
			await user.save();
		}

		// Step 2: Generate new referral codes
		for (const user of users) {
			const referralCode = await generateReferralCode(user.full_name);
			user.referral_id = referralCode;
			await user.save();
			console.log(`Updated: ${user.full_name} -> ${referralCode}`);
		}
	} catch (error) {
		console.error('Error updating users:', error);
	}
}

async function scanImage({ image }) {
	try {
		const fetch = (await import('node-fetch')).default
		const response = await fetch(image);
		const arrayBuffer = await response.arrayBuffer();
		const imageBytes = Buffer.from(arrayBuffer);

		const params = {
			Image: { Bytes: imageBytes },
			MinConfidence: 50
		};

		const data = await rekognitionClient.send(new DetectModerationLabelsCommand(params));
		console.log({ data })

		return Promise.resolve({
			data: data.ModerationLabels.map((item) => item.Name),
			message: 'Scan successfully',
		});
	} catch (error) {
		console.error('Error while scan image:', error);
	}
}

async function getStats({ user_id, start_date, end_date }) {
	try {
		const startOfDay = start_date 
			? dayjs(start_date, 'DD/MM/YYYY').startOf('day').toISOString() 
			: dayjs().startOf('month').toISOString();
		const endOfDay = end_date 
			? dayjs(end_date, 'DD/MM/YYYY').endOf('day').toISOString() 
			: dayjs().endOf('month').toISOString();

		const user = await Users.scope(['includeBlurVideo']).findOne({
			where: {
				id: user_id
			},
			attributes: {
				include: [
					[
						Sequelize.literal(`(
							SELECT COUNT(*)
							FROM matches AS m
							WHERE (m.sender_id = users.id OR m.receiver_id = users.id)
							AND m.sent_date BETWEEN '${startOfDay}' AND '${endOfDay}'
						)`),
						'matches_count',
					],
					[
						Sequelize.literal(`(
							SELECT COUNT(*)
							FROM messages AS msg
							WHERE msg."matchId" IN (
								SELECT id
								FROM matches AS m
								WHERE (m.sender_id = users.id OR m.receiver_id = users.id)
								AND m."createdAt" BETWEEN '${startOfDay}' AND '${endOfDay}'
							)
						)`),
						'messages_count',
					],
					[
						Sequelize.literal(`(
							SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time))), 0)
							FROM session_logs AS sl
							WHERE sl.user_id = users.id
							AND sl.start_time BETWEEN '${startOfDay}' AND '${endOfDay}'
						)`),
						'total_session_time',
					],
				],
			},
		});

		const matches = await Matches.findAll({
			where: {
				[Op.or]: [{ sender_id: user_id }, { receiver_id: user_id }],
				conversation_id: {
					[Op.ne]: null
				},
				createdAt: {
					[Op.between]: [startOfDay, endOfDay]
				}
			},
			attributes: ['conversation_id'],
			raw: true,
		});

		const conversationIds = matches.map((match) => match.conversation_id);

		let totalVideoCallDuration = 0;
		let totalVoiceCallDuration = 0;
		let totalCall = 0

		if (conversationIds.length > 0) {
			const conversations = await db
				.collection('conversations')
				.where('id', 'in', conversationIds)
				.get();

			for (const conversation of conversations.docs) {
				const messagesCollection = conversation.ref.collection('messages');
				const messagesSnapshot = await messagesCollection
					.where('createdAt', '>=', new Date(startOfDay))
					.where('createdAt', '<=', new Date(endOfDay))
					.get();

				for (const messageDoc of messagesSnapshot.docs) {
					const message = messageDoc.data();

					if (message.type === 'video_call' || message.type === 'voice_call') {
						const duration = parseFormattedCallSeconds(message.text);

						if(duration > 0) {
							totalCall += 1
						}

						if (message.type === 'video_call') {
							totalVideoCallDuration += duration;
						} else if (message.type === 'voice_call') {
							totalVoiceCallDuration += duration;
						}
					}
				}
			}
		}

		const reviewsData = await getReviewStats(user_id);

		const userInfo = {
			total_call: totalCall,
			matches_count: parseInt(user.toJSON().matches_count ?? '0'),
			messages_count: parseInt(user.toJSON().messages_count ?? '0'),
			total_session_time: parseInt(user.toJSON().total_session_time ?? '0'),
			total_video_call_duration: totalVideoCallDuration,
			total_voice_call_duration: totalVoiceCallDuration,
			reviews_count: reviewsData.reviewsCount,
			avg_rating: reviewsData.avgRating,
			earning: {
				bonuses: 0,
				next_payment_date: dayjs().endOf('month').format('MMM, DD'),
				total: 0
			}
		};

		return Promise.resolve({
			data: userInfo,
			message: 'Get stats successfully',
		});
	} catch (error) {
		return Promise.reject(error);
	}
}

module.exports = {
	updateProfile,
	getUser,
	getProfile,
	blockUser,
	unblockUser,
	getBlockedUsers,
	deactiveAccount,
	deleteAccount,
	reportUser,
	updateSessionToken,
	getFriendProfile,
	reviewUser,
	getLatestVersion,
	getVersionInfo,
	getReviews,
	getDisclaime,
	getShareLink,
	reapplyProfileReview,
	updateUserNote,
	updateLastActive,
	useReferral,
	getIapProducts,
	updateExistingUsersReferral,
	getSimpleProfile,
	scanImage,
	getStats,
	db
};
