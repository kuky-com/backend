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
const {acceptSuggestion} = require('./matches')

const { DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
const { rekognitionClient } = require('../config/rekognitionClient');
const Journeys = require('../models/journeys');
const JourneyCategories = require('../models/journey_categories');
const JPFAnswers = require('../models/jpf_answers');
const JPFUserAnswer = require('../models/jpf_user_answers');
const dayjs = require('dayjs');
const { default: OpenAI } = require('openai');
const { updateLikes, updateDislikes } = require('./interests');
const { getReviewStats, createSummary, getUser, firebaseAdmin } = require('./common');
const { sendUserInvitationEmail } = require('./email');
const ModeratorFaqs = require('../models/moderator_faqs');
const { analyzeUserTags } = require('../controllers/common');
const { getClientIP, updateUserLocationFromIP } = require('../utils/geolocation');


const db = firebaseAdmin.firestore();

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

async function updateAvatar({ user_id, avatarFile }) {
	try {
		// Upload image to Firebase Storage
		const bucket = firebaseAdmin.storage().bucket();
		const fileName = `avatars/${user_id}_${Date.now()}`;
		const file = bucket.file(fileName);

		await file.save(avatarFile.buffer, {
			metadata: {
				contentType: avatarFile.mimetype,
			},
		});

		await file.makePublic();

		const url = file.publicUrl();

		await Users.update(
			{ avatar: url },
			{
				where: { id: user_id },
				returning: true,
				plain: true,
			}
		);

		return Promise.resolve({
			message: 'Avatar updated successfully',
			data: { avatar: url },
		});
	} catch (error) {
		console.log('Error updating avatar:', error);
		return Promise.reject(error);
	}
}

async function updateProfile({
	user_id,
	full_name,
	gender,
	location,
	pronouns,
	birthday,
	last_latitude,
	last_longitude,
	...restParams
}) {
	try {
		const updates = { ...restParams };
		if (full_name) updates.full_name = full_name;
		if (gender) updates.gender = gender;
		if (location) updates.location = location;
		if (pronouns) updates.pronouns = pronouns;
		if (birthday) updates.birthday = birthday;
		if (restParams.user_note) updates.user_note = restParams.user_note.trim();
		
		// Handle location coordinates
		if (last_latitude !== undefined) updates.last_latitude = last_latitude;
		if (last_longitude !== undefined) updates.last_longitude = last_longitude;

		// if (publicGender) updates.publicGender = publicGender;
		// if (publicPronouns) updates.publicPronouns = publicPronouns;
		// if (notificationEnable) updates.notificationEnable = notificationEnable;
		// if (subscribeEmail) updates.subscribeEmail = subscribeEmail;
		// if (emailNotificationEnable) updates.emailNotificationEnable = emailNotificationEnable;

		if (restParams.journey_category_id && !restParams.journey_id) {
			updates.journey_id = null
		}

		if (updates.avatar === null) {
			updates.avatar_blur = null
			updates.is_avatar_blur = false
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

		if (restParams.video_intro && (!restParams.subtitle_intro || !restParams.video_intro_transcript)) {
			updateSubtitle(user_id, restParams.video_intro, 'intro')
		} else if (restParams.audio_intro && (!restParams.subtitle_intro || !restParams.video_intro_transcript)) {
			updateSubtitle(user_id, restParams.audio_intro, 'intro')
		}

		if (restParams.video_purpose && (!restParams.subtitle_purpose || !restParams.video_purpose_transcript)) {
			updateSubtitle(user_id, restParams.video_purpose, 'purpose')
		} else if (restParams.audio_purpose && (!restParams.subtitle_purpose || !restParams.video_purpose_transcript)) {
			updateSubtitle(user_id, restParams.audio_purpose, 'purpose')
		}

		if (restParams.video_interests && (!restParams.subtitle_interests || !restParams.video_interests_transcript)) {
			updateSubtitle(user_id, restParams.video_interests, 'interests')
		} else if (restParams.audio_interests && (!restParams.subtitle_interests || !restParams.video_interests_transcript)) {
			updateSubtitle(user_id, restParams.audio_interests, 'interests')
		}

		if (restParams.is_video_intro_blur && restParams.video_intro) {
			updateBlurVideo(user_id, restParams.video_intro, 'video_intro_blur')
		}
		if (restParams.is_video_purpose_blur && restParams.video_purpose) {
			updateBlurVideo(user_id, restParams.video_purpose, 'video_purpose_blur')
		}
		if (restParams.is_video_interests_blur && restParams.video_interests) {
			updateBlurVideo(user_id, restParams.video_interests, 'video_interests_blur')
		}

		if (updates.avatar && updates.is_avatar_blur) {
			updateBlurAvatar(user_id, updates.avatar)
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

		createSummary(user_id);

		const userInfo = await getUser(user_id);

		return Promise.resolve({
			data: userInfo,
			message: 'Update successfully',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function forceUpdateSummary() {
	try {
		const approvedUsers = await Users.findAll({
			where: { profile_approved: 'approved' },
		});

		for (const user of approvedUsers) {
			await createSummary(user.id);
			console.log(`Summary updated for user ID: ${user.id}`);
		}

		return Promise.resolve({
			message: 'Summaries updated for all approved users',
		});
	} catch (error) {
		console.error('Error updating summaries:', error);
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
			await Users.update({
				[`subtitle_${type}`]: response.data.s3_url,
				[`video_${type}_transcript`]: response.data.transcript_text ?? ''
			}, {
				where: { id: user_id },
				returning: true,
				plain: true,
			});

			// Analyze transcription and create tags
			if (response.data.transcript_text) {
				await analyzeTranscriptionAndCreateTags(user_id, response.data.transcript_text, type);
			}
		}

		createSummary(user_id);

		return Promise.resolve({
			message: 'Update successfully',
		});
	} catch (error) {

	}
}

async function updateLikeDislike(user_id, media_url) {
	try {
		const response = await axios.post('https://ugfgxk4hudtff26aeled4u3h3u0buuhr.lambda-url.ap-southeast-1.on.aws', {
			s3_uri: media_url
		})

		if (response && response.data) {
			if (response.data.like) {
				updateLikes({ user_id, likes: response.data.like })
			}

			if (response.data.dislike) {
				updateDislikes({ user_id, dislikes: response.data.dislike })
			}
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

async function updateBlurAvatar(user_id, media_url) {
	try {
		console.log({ fjdslafkjdalksfjdfjakdslfjl: user_id, media_url })
		await Users.update({ avatar_blur: null }, {
			where: { id: user_id },
			returning: true,
			plain: true,
		});

		const response = await axios.post('https://h73gkjldkyjxyc4ygsguvon35u0zncvs.lambda-url.ap-southeast-1.on.aws/', {
			image_uri: media_url
		})

		console.log({ responsebluravatar: response.data })

		if (response && response.data && response.data.blurred_image_url) {
			await Users.update({ avatar_blur: response.data.blurred_image_url }, {
				where: { id: user_id },
				returning: true,
				plain: true,
			});
		}

		return Promise.resolve({
			message: 'Update successfully',
		});
	} catch (error) {
		console.log({ error })
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
		const user = await Users.findOne({
			where: { referral_id: {
				[Op.iLike]: (referral_code??'').toLowerCase(), // Use iLike for case-insensitive matching
			} },
			attributes: { exclude: ['password'] },
		});

		if (!user) {
			return Promise.reject('Referral code not found');
		}

		try {
			await acceptSuggestion({user_id, friend_id: user.id})
		} catch (error) {
			console.log('Error accept suggestion:', error)
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

		let products = []
		let title = 'Includes 1 Month free trial'

		if (existReferral) {
			switch (platform) {
				case 'ios':
					products = ["com.kuky.ios.1month_pro", "com.kuky.ios.6month_pro", "com.kuky.ios.12month_pro"]
					break;
				case 'android':
					products = ["com.kuky.android.1month_pro", "com.kuky.android.6month_pro", "com.kuky.android.12month_pro"]
					break;
				case 'web':
					products = ["com.kuky.web.1month_pro", "com.kuky.web.6month_pro", "com.kuky.web.12month_pro"]
					break;
				default:
					products = ["com.kuky.ios.1month_pro", "com.kuky.ios.6month_pro", "com.kuky.ios.12month_pro"]
					break;
			}
			title = 'Includes 3 Months free trial'
		} else {
			switch (platform) {
				case 'ios':
					products = ["com.kuky.ios.1month", "com.kuky.ios.6month", "com.kuky.ios.12month"]
					break;
				case 'android':
					products = ["com.kuky.android.1month", "com.kuky.android.6month", "com.kuky.android.12month"]
					break;
				case 'web':
					products = ["com.kuky.web.1month", "com.kuky.web.6month", "com.kuky.web.12month"]
					break;
				default:
					products = ["com.kuky.ios.1month", "com.kuky.ios.6month", "com.kuky.ios.12month"]
					break;
			}
			title = 'Includes 1 Month free trial'
		}

		return Promise.resolve({
			message: 'IAP products',
			data: {
				products,
				title: title,
			}
		});
	} catch (error) {
		console.log('Error use referral code:', error);
		return Promise.reject(error);
	}
}

async function updateLastActive({ user_id, req }) {
	try {
		const user = await Users.findOne({
			where: { id: user_id }
		});

		if (!user) {
			return Promise.reject('User not found');
		}

		user.last_active_time = new Date();
		await user.save();

		// If request object is provided, update location from IP
		if (req) {
			const ipAddress = getClientIP(req);
			if (ipAddress) {
				// Update location asynchronously without blocking the response
				updateUserLocationFromIP(user_id, ipAddress).catch(error => {
					console.error('Failed to update user location on last active:', error);
				});
			}
		}

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

		console.log({ startOfDay, endOfDay })

		await Sequelize.query(
			`UPDATE session_logs
					 SET end_time = start_time + interval '15 minutes'
					 WHERE user_id = :user_id
					 AND EXTRACT(EPOCH FROM (end_time - start_time)) > 900`,
			{
				replacements: { user_id },
				type: Sequelize.QueryTypes.UPDATE,
			}
		);

		await Sequelize.query(
			`UPDATE session_logs AS sl1
			 SET end_time = (
				 SELECT MIN(sl2.start_time) - interval '1 second'
				 FROM session_logs AS sl2
				 WHERE sl2.user_id = sl1.user_id
				 AND sl2.start_time > sl1.start_time
			 )
			 WHERE EXISTS (
				 SELECT 1
				 FROM session_logs AS sl2
				 WHERE sl2.user_id = sl1.user_id
				 AND sl2.start_time > sl1.start_time
				 AND sl1.end_time > sl2.start_time
			 )
			 AND sl1.user_id = :user_id`,
			{
				replacements: { user_id },
				type: Sequelize.QueryTypes.UPDATE,
			}
		);

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
							AND sl.user_id IS NOT NULL
							AND sl.start_time BETWEEN '${startOfDay}' AND '${endOfDay}'
							AND (
								(sl.screen_name = 'index' AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) > 120 AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) < 900)
									OR 
								(sl.screen_name IN ('message', 'profile') AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) > 30 AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) < 900)
							)
						)`),
						'total_session_time',
					],
				],
			},
		});

		const moderatorPayments = await Sequelize.query(
			`SELECT * FROM moderator_payments WHERE user_id = :user_id ORDER BY paid_date ASC`,
			{
				replacements: { user_id },
				type: Sequelize.QueryTypes.SELECT,
			}
		);

		const startMonth = dayjs('2025-04-01');
		const currentMonth = dayjs().startOf('month');
		const monthlyReport = [];

		let current = startMonth;

		while (current.isBefore(currentMonth) || current.isSame(currentMonth)) {
			const payment = moderatorPayments.find((payment) =>
				dayjs(payment.payment_date).isSame(current, 'month')
			);

			// Calculate total session time for the current month
			const totalSessionTime = await Sequelize.query(
				`SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time))), 0) AS total_time
				 FROM session_logs AS sl
				 WHERE sl.user_id = :user_id
				 AND sl.start_time BETWEEN :start_date AND :end_date`,
				{
					replacements: {
						user_id,
						start_date: current.startOf('month').toISOString(),
						end_date: current.endOf('month').toISOString(),
					},
					type: Sequelize.QueryTypes.SELECT,
				}
			);

			const amountToPay = (parseInt(totalSessionTime[0].total_time ?? '0') / 3600) * 15;

			monthlyReport.push({
				month: current.format('MMM YYYY'),
				payment: payment || null,
				amountToPay: amountToPay.toFixed(2),
			});

			current = current.add(1, 'month');
		}

		const payment_reports = monthlyReport ?? [];

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

		const moderators = await Users.findAll({
			where: {
				is_moderators: true
			},
			attributes: ['id', 'full_name'],
			raw: true
		});
		const moderatorIds = moderators.map((moderator) => `${process.env.NODE_ENV}_${moderator.id}`);

		const sendbird = require('./sendbird');
		const callHistory = await sendbird.getCallHistory(user_id, dayjs(startOfDay).valueOf(), dayjs(endOfDay).valueOf());

		let totalCallDuration = 0;
		let totalCallDurationGetPaid = 0
		let totalCall = 0;
		let responseCall = 0;

		for (const call of callHistory) {
			let otherNotModerator = false;
			call.participants.forEach((participant) => {
				if (!moderatorIds.includes(participant.user_id)) {
					otherNotModerator = true;
				}
			});
			totalCallDuration += Math.round(call.duration / 1000);
			if (call.duration > 0 && otherNotModerator) {
				totalCallDurationGetPaid += Math.round(call.duration / 1000);
			}
			totalCall += 1;
			responseCall += 1;
		}

		const responseRate = totalCall > 0 ? (responseCall / totalCall) * 100 : 0;

		const reviewsData = await getReviewStats(user_id);

		const totalEarning = Math.round((((parseInt(user.toJSON().total_session_time ?? '0') + totalCallDurationGetPaid) / 3600) * 15) * 100) / 100;

		const nextPaymentDate = dayjs().date() <= 15
			? dayjs().date(16).format('MMM, DD')
			: dayjs().add(1, 'month').startOf('month').format('MMM, DD');

		const userInfo = {
			total_call: totalCall,
			total_call_duration: totalCallDuration,
			total_call_duration_get_paid: totalCallDurationGetPaid,
			avg_call_duration: totalCall > 0 ? (totalCallDuration / totalCall) : 0,
			matches_count: parseInt(user.toJSON().matches_count ?? '0'),
			messages_count: parseInt(user.toJSON().messages_count ?? '0'),
			total_session_time: null, //parseInt(user.toJSON().total_session_time ?? '0'),
			response_rate: Math.round(responseRate),
			reviews_count: reviewsData.reviewsCount,
			avg_rating: reviewsData.avgRating,
			is_active: user.is_active,
			created_at: user.createdAt,
			earning: {
				bonuses: 0,
				next_payment_date: nextPaymentDate,
				total: totalEarning
			},
			payment_reports
		};

		return Promise.resolve({
			data: userInfo,
			message: 'Get stats successfully',
		});
	} catch (error) {
		return Promise.reject(error);
	}
}

async function getAllModeratorsPayments({ start_date, end_date }) {
	try {
		const startOfDay = start_date
			? dayjs(start_date, 'DD/MM/YYYY').startOf('day').toISOString()
			: dayjs().startOf('month').toISOString();
		const endOfDay = end_date
			? dayjs(end_date, 'DD/MM/YYYY').endOf('day').toISOString()
			: dayjs().endOf('month').toISOString();

		// Get all moderators
		const moderators = await Users.findAll({
			where: {
				is_moderators: true
			},
			attributes: ['id', 'full_name', 'email', 'is_active', 'payment_type', 'payment_id'],
			raw: true
		});

		const moderatorIds = moderators.map((moderator) => `${process.env.NODE_ENV}_${moderator.id}`);
		const allModeratorsPayments = [];

		for (const moderator of moderators) {
			const user_id = moderator.id;

			// Update session logs for the user
			await Sequelize.query(
				`UPDATE session_logs
				 SET end_time = start_time + interval '15 minutes'
				 WHERE user_id = :user_id
				 AND EXTRACT(EPOCH FROM (end_time - start_time)) > 900`,
				{
					replacements: { user_id },
					type: Sequelize.QueryTypes.UPDATE,
				}
			);

			await Sequelize.query(
				`UPDATE session_logs AS sl1
				 SET end_time = (
					 SELECT MIN(sl2.start_time) - interval '1 second'
					 FROM session_logs AS sl2
					 WHERE sl2.user_id = sl1.user_id
					 AND sl2.start_time > sl1.start_time
				 )
				 WHERE EXISTS (
					 SELECT 1
					 FROM session_logs AS sl2
					 WHERE sl2.user_id = sl1.user_id
					 AND sl2.start_time > sl1.start_time
					 AND sl1.end_time > sl2.start_time
				 )
				 AND sl1.user_id = :user_id`,
				{
					replacements: { user_id },
					type: Sequelize.QueryTypes.UPDATE,
				}
			);

			// Get user session time data
			const user = await Users.findOne({
				where: {
					id: user_id
				},
				attributes: {
					include: [
						[
							Sequelize.literal(`(
								SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time))), 0)
								FROM session_logs AS sl
								WHERE sl.user_id = users.id 
								AND sl.user_id IS NOT NULL
								AND sl.start_time BETWEEN '${startOfDay}' AND '${endOfDay}'
								AND (
									(sl.screen_name = 'index' AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) > 120 AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) < 900)
									OR 
									(sl.screen_name IN ('message', 'profile') AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) > 30 AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) < 900)
								)
							)`),
							'total_session_time',
						],
					],
				},
			});

			// Get call history
			const sendbird = require('./sendbird');
			const callHistory = await sendbird.getCallHistory(user_id, dayjs(startOfDay).valueOf(), dayjs(endOfDay).valueOf());

			let totalCallDurationGetPaid = 0;

			for (const call of callHistory) {
				let otherNotModerator = false;
				call.participants.forEach((participant) => {
					if (!moderatorIds.includes(participant.user_id)) {
						otherNotModerator = true;
					}
				});
				if (call.duration > 0 && otherNotModerator) {
					totalCallDurationGetPaid += Math.round(call.duration / 1000);
				}
			}

			// Get payment information for the period
			const payments = await Sequelize.query(
				`SELECT * FROM moderator_payments 
				 WHERE user_id = :user_id 
				 AND paid_date BETWEEN :start_date AND :end_date
				 ORDER BY paid_date ASC`,
				{
					replacements: { user_id, start_date: startOfDay, end_date: endOfDay },
					type: Sequelize.QueryTypes.SELECT,
				}
			);

			const totalSessionTime = parseInt(user.toJSON().total_session_time ?? '0');
			const totalEarning = Math.round((((totalSessionTime + totalCallDurationGetPaid) / 3600) * 15) * 100) / 100;

			const moderatorPaymentInfo = {
				user_id: moderator.id,
				full_name: moderator.full_name,
				email: moderator.email,
				is_active: moderator.is_active,
				payment_type: moderator.payment_type,
				payment_id: moderator.payment_id,
				total_session_time: totalSessionTime,
				total_call_duration_get_paid: totalCallDurationGetPaid,
				total_earning: totalEarning.toFixed(2),
				payment: payments && payments.length > 0 ? payments[payments.length - 1] : null,
				earning: {
					total: totalEarning.toFixed(2)
				}
			};

			allModeratorsPayments.push(moderatorPaymentInfo);
		}

		return Promise.resolve({
			data: allModeratorsPayments,
			message: 'Get all moderators payments successfully',
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getStatsByMonth({ user_id }) {
	try {
		const startMonth = dayjs('2025-04-01');
		const currentMonth = dayjs().startOf('month');
		const halfMonthlyStats = [];

		let current = startMonth;

		// Fetch moderator payments for the user
		const moderatorPayments = await Sequelize.query(
			`SELECT * FROM moderator_payments WHERE user_id = :user_id ORDER BY paid_date ASC`,
			{
				replacements: { user_id },
				type: Sequelize.QueryTypes.SELECT,
			}
		);

		while (current.isBefore(currentMonth) || current.isSame(currentMonth)) {
			const halfPeriods = [
				{ start: current.startOf('month'), end: current.startOf('month').add(14, 'days') },
				{ start: current.startOf('month').add(15, 'days'), end: current.endOf('month') },
			];

			for (const period of halfPeriods) {
				const startOfDay = period.start.toISOString();
				const endOfDay = period.end.toISOString();

				await Sequelize.query(
					`UPDATE session_logs
						 SET end_time = start_time + interval '15 minutes'
						 WHERE user_id = :user_id
						 AND EXTRACT(EPOCH FROM (end_time - start_time)) > 900`,
					{
						replacements: { user_id },
						type: Sequelize.QueryTypes.UPDATE,
					}
				);

				await Sequelize.query(
					`UPDATE session_logs AS sl1
					 SET end_time = (
						 SELECT MIN(sl2.start_time) - interval '1 second'
						 FROM session_logs AS sl2
						 WHERE sl2.user_id = sl1.user_id
						 AND sl2.start_time > sl1.start_time
					 )
					 WHERE EXISTS (
						 SELECT 1
						 FROM session_logs AS sl2
						 WHERE sl2.user_id = sl1.user_id
						 AND sl2.start_time > sl1.start_time
						 AND sl1.end_time > sl2.start_time
					 )
					 AND sl1.user_id = :user_id`,
					{
						replacements: { user_id },
						type: Sequelize.QueryTypes.UPDATE,
					}
				);

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
									AND sl.user_id IS NOT NULL
									AND sl.start_time BETWEEN '${startOfDay}' AND '${endOfDay}'
									AND (
										(sl.screen_name = 'index' AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) > 120 AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) < 900)
										OR 
										(sl.screen_name IN ('message', 'profile') AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) > 30 AND EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) < 900)
									)
								)`),
								'total_session_time',
							],
						],
					},
				});

				const moderators = await Users.findAll({
					where: {
						is_moderators: true
					},
					attributes: ['id', 'full_name'],
					raw: true
				});
				const moderatorIds = moderators.map((moderator) => `${process.env.NODE_ENV}_${moderator.id}`);
				const sendbird = require('./sendbird');
				const callHistory = await sendbird.getCallHistory(user_id, period.start.valueOf(), period.end.valueOf());

				let totalCallDuration = 0;
				let totalCallDurationGetPaid = 0;
				let totalCall = 0;
				let responseCall = 0;

				for (const call of callHistory) {
					let otherNotModerator = false;
					call.participants.forEach((participant) => {
						if (!moderatorIds.includes(participant.user_id)) {
							otherNotModerator = true;
						}
					});
					totalCallDuration += Math.round(call.duration / 1000);
					if (call.duration > 0 && otherNotModerator) {
						totalCallDurationGetPaid += Math.round(call.duration / 1000);
					}
					totalCall += 1;
					responseCall += 1;
				}

				const responseRate = totalCall > 0 ? (responseCall / totalCall) * 100 : 0;

				const reviewsData = await getReviewStats(user_id);

				const totalEarning = Math.round((((parseInt(user.toJSON().total_session_time ?? '0') + totalCallDurationGetPaid) / 3600) * 15) * 100) / 100;

				// Find payment for the current period
				const payment = moderatorPayments.find((payment) =>
					dayjs(payment.paid_date).isBetween(period.start, period.end, 'day', '[]')
				);

				console.log({ period, payment })

				const userInfo = {
					period: `${period.start.format('DD/MM/YY')} - ${period.end.format('DD/MM/YY')}`,
					total_call: totalCall,
					total_call_duration: totalCallDuration,
					total_call_duration_get_paid: totalCallDurationGetPaid,
					avg_call_duration: totalCall > 0 ? (totalCallDuration / totalCall) : 0,
					matches_count: parseInt(user.toJSON().matches_count ?? '0'),
					messages_count: parseInt(user.toJSON().messages_count ?? '0'),
					total_session_time: parseInt(user.toJSON().total_session_time ?? '0') + totalCallDurationGetPaid,
					response_rate: Math.round(responseRate),
					reviews_count: reviewsData.reviewsCount,
					avg_rating: reviewsData.avgRating,
					is_active: user.is_active,
					created_at: user.createdAt,
					earning: {
						bonuses: 0,
						total: totalEarning.toFixed(2),
					},
					payment: payment || null, // Attach payment information if available
				};

				halfMonthlyStats.push(userInfo);
			}

			current = current.add(1, 'month');
		}

		// Reorder stats from latest to oldest
		halfMonthlyStats.reverse();

		return Promise.resolve({
			data: halfMonthlyStats,
			message: 'Get stats by half-month successfully',
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function sendUserInvitation({ user_id, recipients }) {
	try {
		const user = await Users.findOne({
			where: { id: user_id },
			include: [{ model: Journeys }],
		});

		console.log({ user: user.toJSON() })
		if (!user || !user.toJSON().journey) {
			return Promise.reject('User not found');
		}

		const sender_full_name = user.toJSON().full_name;
		const sender_referral_id= user.toJSON().referral_id;
		const sender_journey = user.toJSON().journey.name;

		await sendUserInvitationEmail({ sender_full_name, sender_referral_id, sender_journey, recipients });

		return Promise.resolve({
			message: 'User invitation sent successfully',
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getModeratorFAQs () {
	try {
		const faqs = await ModeratorFaqs.findAll({
			order: [['ranking', 'DESC']],
		});

		return Promise.resolve({
			message: 'Moderator FAQs retrieved successfully',
			data: faqs,
		});
	} catch (error) {
		console.log('Error fetching moderator FAQs:', error);
		return Promise.reject(error);
	}
}

async function analyzeTranscriptionAndCreateTags(user_id, transcript_text, video_type) {
	try {
		const result = await analyzeUserTags(user_id);
		
		await Users.update(
			{ matching_tags: result.data },
			{ where: { id: user_id } }
		);

	} catch (error) {
		console.log('Error analyzing transcription:', error);
		return Promise.reject(error);
	}
}

async function createUserTags(user_id, tagNames) {
	try {
		for (const tagName of tagNames) {
			// Find or create tag
			const [tag] = await Tags.findOrCreate({
				where: { name: tagName.toLowerCase() },
				defaults: { name: tagName.toLowerCase() }
			});

			// You may need to create a UserTags model/table for many-to-many relationship
			// For now, we'll use the existing Tags model
			console.log(`Created/found tag: ${tag.name} for user ${user_id}`);
		}
	} catch (error) {
		console.log('Error creating user tags:', error);
	}
}

async function createUserPurposes(user_id, purposeNames) {
	try {
		for (const purposeName of purposeNames) {
			// Find or create purpose
			const [purpose] = await Purposes.findOrCreate({
				where: { name: purposeName.toLowerCase() },
				defaults: { name: purposeName.toLowerCase() }
			});

			// Create user-purpose association
			await UserPurpose.findOrCreate({
				where: {
					user_id: user_id,
					purpose_id: purpose.id
				}
			});
		}
	} catch (error) {
		console.log('Error creating user purposes:', error);
	}
}

module.exports = {
	updateProfile,
	getUser,
	blockUser,
	unblockUser,
	getBlockedUsers,
	deactiveAccount,
	deleteAccount,
	reportUser,
	updateSessionToken,
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
	scanImage,
	getStats,
	forceUpdateSummary,
	getStatsByMonth,
	updateAvatar,
	sendUserInvitation,
	getAllModeratorsPayments,
	getModeratorFAQs,
	analyzeTranscriptionAndCreateTags
};
