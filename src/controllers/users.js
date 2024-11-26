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
const { Op } = require('sequelize');
const ReportUsers = require('../models/report_users');
const ReviewUsers = require('../models/review_users');
const AppVersions = require('../models/versions');
const Sequelize = require('../config/database');
const { isStringInteger } = require('../utils/utils');

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

		const updatedUser = await Users.update(updates, {
			where: { id: user_id },
			returning: true,
			plain: true,
		});

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

async function getProfile({ user_id }) {
	try {
		const user = await Users.findOne({
			where: { id: user_id },
			include: [{ model: Purposes }, { model: Interests }, { model: Tags }],
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
			: { referral_id: friend_id };

		const user = await Users.findOne({
			where: findCondition,
			include: [{ model: Purposes }, { model: Interests }, { model: Tags }],
		});

		if (!user) {
			return Promise.reject('User not found');
		}

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

		const match = await Matches.findOne({
			where: {
				[Op.or]: [
					{ sender_id: user_id, receiver_id: user.id },
					{ sender_id: user.id, receiver_id: user_id },
				],
			},
			order: [['id', 'desc']],
		});

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
		const user = await Users.findOne({
			where: { id: user_id },
			attributes: { exclude: ['password'] },
			include: [{ model: Purposes }, { model: Interests }, { model: Tags }],
		});

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

		return Promise.resolve({
			data: userInfo,
			message: 'Update successfully',
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
};
