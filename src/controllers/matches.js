const Users = require('@/models/users');
const VerificationCode = require('@/models/verification_code');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const Matches = require('../models/matches');
const UserPurposes = require('../models/user_purposes');
const UserInterests = require('../models/user_interests');
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const interestsController = require('./interests');
const Tags = require('../models/tags');
const { OpenAI } = require('openai');
const { Op, Sequelize } = require('sequelize');
var admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

// var serviceAccount = require("../config/serviceAccountKey.json");
const { getProfile, getSimpleProfile } = require('./users');
const BlockedUsers = require('../models/blocked_users');
const { findUnique, getRandomElements, formatNamesWithType } = require('../utils/utils');
const { addNewNotification, addNewPushNotification } = require('./notifications');
const { sendRequestEmail } = require('./email');
const Messages = require('../models/messages');
const { addMatchTagOnesignal, updateMatchDateTag } = require('./onesignal');
const dayjs = require('dayjs');
const { raw } = require('body-parser');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

async function getUserDetails(user_id) {
	const interests = await UserInterests.findAll({
		where: { user_id },
		attributes: {
			include: [[Sequelize.col('interest.name'), 'name']],
		},
		include: [
			{
				model: Interests,
				attributes: [['name', 'name']],
				where: {
					normalized_interest_id: {
						[Op.ne]: null,
					},
				},
			},
		],
		raw: true,
	});

	const purposes = await UserPurposes.findAll({
		where: { user_id },
		attributes: {
			include: [[Sequelize.col('purpose.name'), 'name']],
		},
		include: [
			{
				model: Purposes,
				attributes: [['name', 'name']],
				where: {
					normalized_purpose_id: {
						[Op.ne]: null,
					},
				},
			},
		],
		raw: true,
	});

	return {
		id: user_id,
		interests: interests.map((ui) => ({
			name: ui.name,
			type: ui.interest_type,
		})),
		purposes: purposes.map((up) => up.name),
	};
}

function generateMatchingPrompt(targetUser, compareUsers) {
	let prompt = `I have target person with information about likes, dislikes, and purposes.
  
    Target person Likes: ${targetUser.interests
			.filter((i) => i.type === 'like')
			.map((i) => i.name)
			.join(', ')}
    Target person Dislikes: ${targetUser.interests
			.filter((i) => i.type === 'dislike')
			.map((i) => i.name)
			.join(', ')}
    Target person Purposes: ${targetUser.purposes.join(', ')}

    Then I have list of several people with their likes, dislikes, and purposes. I want to get order of people that best match with
    my target person, sort from best match to lower. 
	Let's have the following scoring system: 
	 - If the targeted user has the same purpose with compared user then it's very important. That should be 5 points.
	 - If the users have somehow similar purposes, then it should be 3 points.
	 - If the targeted user has similar likes or dislikes with the compared user, it's kind of important. Each common like should be 1 point, each common dislike should be -1p
	 - If the targeted has a like that the compared user dislikes, or the compared user has a like that the targeted user dislikes it should be -2 point (negative two)
	Please calculate internally the score and sort this users:
	: `;

	for (const user of compareUsers) {
		prompt += `
            Person with ID=${user.id} Likes: ${user.interests
				.filter((i) => i.type === 'like')
				.map((i) => i.name)
				.join(', ')}
            Person with ID=${user.id} Dislikes: ${user.interests
				.filter((i) => i.type === 'dislike')
				.map((i) => i.name)
				.join(', ')}
            Person with ID=${user.id} Purposes: ${user.purposes.join(', ')}

        `;
	}

	prompt += `
                Return the list of sorted people ID separate by "," only, no other words`;
	console.log(prompt);

	return prompt;
}

async function matchUsers(targetId, compareIds) {
	try {
		const targetUser = await getUserDetails(targetId);
		const compareUsers = [];

		for (const userId of compareIds) {
			const user = await getUserDetails(userId.id);
			compareUsers.push(user);
		}

		const prompt = generateMatchingPrompt(targetUser, compareUsers);

		const response = await openai.completions.create({
			model: 'gpt-3.5-turbo-instruct',
			prompt: prompt,
			max_tokens: 150,
			temperature: 0.1,
		});

		return response.choices[0].text.trim();
	} catch (error) {
		console.log('Error matching users:', error);
		throw error;
	}
}

async function findMatchesByPurpose({ user_id, purpose_id }) {

	console.log({ user_id, purpose_id })
	try {
		const blockedUsers = await BlockedUsers.findAll({
			where: {
				[Op.or]: [{ user_id: user_id }, { blocked_id: user_id }],
			},
			raw: true,
		});

		const matchedUsers = await Matches.findAll({
			where: {
				[Op.or]: [
					{
						[Op.or]: [
							{ sender_id: user_id, status: 'rejected' },
							{ sender_id: user_id, status: 'accepted' },
							{ sender_id: user_id, status: 'deleted' },
							{ receiver_id: user_id, status: 'rejected' },
							{ receiver_id: user_id, status: 'accepted' },
							{ receiver_id: user_id, status: 'deleted' },
						],
					},
					{ sender_id: user_id, status: 'sent' },
				],
			},
			raw: true,
		});

		const blockedUserIds = blockedUsers.map((item) =>
			item.user_id === user_id ? item.blocked_id : item.user_id
		);
		const matchedUserIds = matchedUsers.map((item) =>
			item.sender_id === user_id ? item.receiver_id : item.sender_id
		);

		const avoidUserIds = findUnique(blockedUserIds, matchedUserIds);

		const matchingUsers = await Users.findAll({
			where: {
				is_active: true,
				is_hidden_users: false,
				profile_approved: 'approved',
				profile_tag: {
					[Op.ne]: null,
				},
				id: { [Op.notIn]: [user_id, ...avoidUserIds] },
			},
			include: [
				{
					model: UserPurposes,
					where: { purpose_id: purpose_id },
					attributes: [],
				},
			],
			attributes: ['id', 'profile_tag'],
			order: [['id', 'DESC']],
		});

		const suggestions = [];
		for (const user of matchingUsers) {
			const userInfo = await getProfile({ user_id: user.id });
			suggestions.push(userInfo.data);
		}

		return Promise.resolve({
			message: 'Matching users list',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function findLessMatches({ user_id }) {
	try {
		const currentUser = await Users.findByPk(user_id);

		if (!currentUser) {
			return Promise.reject('User not found');
		}

		const currentUserProfileTag = currentUser.profile_tag;

		const currentUserInterests = await Interests.findAll({
			include: [
				{
					model: UserInterests,
					where: { user_id: user_id, interest_type: 'like' },
					attributes: [],
				},
			],
			attributes: ['normalized_interest_id'],
			group: ['interests.normalized_interest_id', 'interests.id'],
		});

		const currentUserInterestGroupIds = currentUserInterests.map(
			(interest) => interest.normalized_interest_id
		);

		const currentUserDislikes = await Interests.findAll({
			include: [
				{
					model: UserInterests,
					where: { user_id: user_id, interest_type: 'dislike' },
					attributes: [],
				},
			],
			attributes: ['normalized_interest_id'],
			group: ['interests.normalized_interest_id', 'interests.id'],
		});

		const currentUserDislikeGroupIds = currentUserDislikes.map(
			(interest) => interest.normalized_interest_id
		);

		const currentUserPurposes = await Purposes.findAll({
			include: [
				{
					model: UserPurposes,
					where: { user_id: user_id },
					attributes: [],
				},
			],
			attributes: ['normalized_purpose_id'],
			group: ['purposes.normalized_purpose_id', 'purposes.id'],
		});

		const currentUserPurposeGroupIds = currentUserPurposes.map(
			(purpose) => purpose.normalized_purpose_id
		);

		const blockedUsers = await BlockedUsers.findAll({
			where: {
				[Op.or]: [{ user_id: user_id }, { blocked_id: user_id }],
			},
			raw: true,
		});

		const mactchedUsers = await Matches.findAll({
			where: {
				[Op.or]: [
					{
						[Op.or]: [
							{ sender_id: user_id, status: 'rejected' },
							{ sender_id: user_id, status: 'accepted' },
							{ sender_id: user_id, status: 'deleted' },
							{
								receiver_id: user_id,
								status: 'rejected',
							},
							{
								receiver_id: user_id,
								status: 'accepted',
							},
							{ receiver_id: user_id, status: 'deleted' },
						],
					},
					{ sender_id: user_id, status: 'sent' },
				],
			},
			raw: true,
		});

		const blockedUserIds = blockedUsers.map((item) =>
			item.user_id === user_id ? item.blocked_id : item.user_id
		);
		const matchedUserIds = mactchedUsers.map((item) =>
			item.sender_id === user_id ? item.receiver_id : item.sender_id
		);

		const avoidUserIds = findUnique(blockedUserIds, matchedUserIds);

		const matchingUsers = await Users.findAll({
			where: {
				is_active: true,
				is_hidden_users: false,
				profile_approved: 'approved',
				profile_tag: {
					[Op.ne]: null,
				},
				id: { [Op.notIn]: [user_id, ...avoidUserIds] },
			},
			attributes: ['id', 'profile_tag'],
			orderBy: [['id', 'DESC']],
		});

		const matchedUsersWithScores = [];

		for (const user of matchingUsers) {
			const userId = user.id;

			const userInterests = await Interests.findAll({
				include: [
					{
						model: UserInterests,
						where: { user_id: userId, interest_type: 'like' },
						attributes: [],
					},
				],
				attributes: ['normalized_interest_id'],
				group: ['interests.normalized_interest_id', 'interests.id'],
			});

			const userInterestGroupIds = userInterests.map(
				(interest) => interest.normalized_interest_id
			);

			const userDislikes = await Interests.findAll({
				include: [
					{
						model: UserInterests,
						where: {
							user_id: userId,
							interest_type: 'dislike',
						},
						attributes: [],
					},
				],
				attributes: ['normalized_interest_id'],
				group: ['interests.normalized_interest_id', 'interests.id'],
			});

			const userDislikeGroupIds = userDislikes.map(
				(interest) => interest.normalized_interest_id
			);

			const userPurposes = await Purposes.findAll({
				include: [
					{
						model: UserPurposes,
						where: { user_id: userId },
						attributes: [],
					},
				],
				attributes: ['normalized_purpose_id'],
				group: ['purposes.normalized_purpose_id', 'purposes.id'],
			});

			const userPurposeGroupIds = userPurposes.map(
				(purpose) => purpose.normalized_purpose_id
			);

			const matchingInterestGroupIds = currentUserInterestGroupIds.filter(
				(groupId) => userInterestGroupIds.includes(groupId)
			);

			const matchingDislikeGroupIds = currentUserDislikeGroupIds.filter(
				(groupId) => userDislikeGroupIds.includes(groupId)
			);

			const matchingPurposeGroupIds = currentUserPurposeGroupIds.filter(
				(groupId) => userPurposeGroupIds.includes(groupId)
			);

			if (
				user.profile_tag !== currentUserProfileTag &&
				matchingDislikeGroupIds.length === 0 &&
				matchingInterestGroupIds.length === 0 &&
				matchingPurposeGroupIds.length === 0
			) {
				matchedUsersWithScores.push({
					user_id: userId,
				});
			}
		}

		const suggestions = [];
		for (const rawuser of matchedUsersWithScores) {
			if (suggestions.length > 20) {
				break;
			}

			const userInfo = await getProfile({ user_id: rawuser.user_id });

			suggestions.push(userInfo.data);
		}

		return Promise.resolve({
			message: 'Less matches list',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function findBestMatches({ user_id, page = 1, limit = 20 }) {
	try {
		const currentUser = await Users.findByPk(user_id);

		if (!currentUser) {
			return Promise.reject('User not found');
		}

		const currentUserProfileTag = currentUser.profile_tag;

		const currentUserInterests = await Interests.findAll({
			include: [
				{
					model: UserInterests,
					where: { user_id: user_id, interest_type: 'like' },
					attributes: [],
				},
			],
			attributes: ['normalized_interest_id'],
			group: ['interests.normalized_interest_id', 'interests.id'],
		});

		const currentUserInterestGroupIds = currentUserInterests.map(
			(interest) => interest.normalized_interest_id
		);

		const currentUserDislikes = await Interests.findAll({
			include: [
				{
					model: UserInterests,
					where: { user_id: user_id, interest_type: 'dislike' },
					attributes: [],
				},
			],
			attributes: ['normalized_interest_id'],
			group: ['interests.normalized_interest_id', 'interests.id'],
		});

		const currentUserDislikeGroupIds = currentUserDislikes.map(
			(interest) => interest.normalized_interest_id
		);

		const currentUserPurposes = await Purposes.findAll({
			include: [
				{
					model: UserPurposes,
					where: { user_id: user_id },
					attributes: [],
				},
			],
			attributes: ['normalized_purpose_id'],
			group: ['purposes.normalized_purpose_id', 'purposes.id'],
		});

		const currentUserPurposeGroupIds = currentUserPurposes.map(
			(purpose) => purpose.normalized_purpose_id
		);

		const blockedUsers = await BlockedUsers.findAll({
			where: {
				[Op.or]: [{ user_id: user_id }, { blocked_id: user_id }],
			},
			raw: true,
		});

		const mactchedUsers = await Matches.findAll({
			where: {
				[Op.or]: [
					{
						[Op.or]: [
							{ sender_id: user_id, status: 'rejected' },
							{ sender_id: user_id, status: 'accepted' },
							{ sender_id: user_id, status: 'deleted' },
							{
								receiver_id: user_id,
								status: 'rejected',
							},
							{
								receiver_id: user_id,
								status: 'accepted',
							},
							{ receiver_id: user_id, status: 'deleted' },
						],
					},
					{ sender_id: user_id, status: 'sent' },
				],
			},
			raw: true,
		});

		const blockedUserIds = blockedUsers.map((item) =>
			item.user_id === user_id ? item.blocked_id : item.user_id
		);
		const matchedUserIds = mactchedUsers.map((item) =>
			item.sender_id === user_id ? item.receiver_id : item.sender_id
		);

		const avoidUserIds = findUnique(blockedUserIds, matchedUserIds);

		const matchingUsers = await Users.findAll({
			where: {
				is_active: true,
				is_hidden_users: false,
				profile_approved: 'approved',
				profile_tag: {
					[Op.ne]: null,
				},
				id: { [Op.notIn]: [user_id, ...avoidUserIds] },
			},
			attributes: ['id', 'profile_tag'],
			orderBy: [['id', 'DESC']],
		});

		const matchedUsersWithScores = [];

		for (const user of matchingUsers) {
			const userId = user.id;

			const userInterests = await Interests.findAll({
				include: [
					{
						model: UserInterests,
						where: { user_id: userId, interest_type: 'like' },
						attributes: [],
					},
				],
				attributes: ['normalized_interest_id'],
				group: ['interests.normalized_interest_id', 'interests.id'],
			});

			const userInterestGroupIds = userInterests.map(
				(interest) => interest.normalized_interest_id
			);

			const userDislikes = await Interests.findAll({
				include: [
					{
						model: UserInterests,
						where: {
							user_id: userId,
							interest_type: 'dislike',
						},
						attributes: [],
					},
				],
				attributes: ['normalized_interest_id'],
				group: ['interests.normalized_interest_id', 'interests.id'],
			});

			const userDislikeGroupIds = userDislikes.map(
				(interest) => interest.normalized_interest_id
			);

			const userPurposes = await Purposes.findAll({
				include: [
					{
						model: UserPurposes,
						where: { user_id: userId },
						attributes: [],
					},
				],
				attributes: ['normalized_purpose_id'],
				group: ['purposes.normalized_purpose_id', 'purposes.id'],
			});

			const userPurposeGroupIds = userPurposes.map(
				(purpose) => purpose.normalized_purpose_id
			);

			const matchingInterestGroupIds = currentUserInterestGroupIds.filter(
				(groupId) => userInterestGroupIds.includes(groupId)
			);

			const matchingDislikeGroupIds = currentUserDislikeGroupIds.filter(
				(groupId) => userDislikeGroupIds.includes(groupId)
			);

			const matchingPurposeGroupIds = currentUserPurposeGroupIds.filter(
				(groupId) => userPurposeGroupIds.includes(groupId)
			);

			if (
				user.profile_tag === currentUserProfileTag ||
				matchingDislikeGroupIds.length > 0 ||
				matchingInterestGroupIds.length > 0 ||
				matchingPurposeGroupIds.length > 0
			) {
				let score = 0;

				if (user.profile_tag === currentUserProfileTag) score += 10;
				if (user.last_active_time && dayjs().diff(dayjs(user.last_active_time), 'minute') < 60) {
					score += 10
				} else if (user.last_active_time && dayjs().diff(dayjs(user.last_active_time), 'minute') < 120) {
					score += 5
				}

				score += matchingInterestGroupIds.length * 2;

				score += matchingDislikeGroupIds.length * 2;

				score += matchingPurposeGroupIds.length * 3;

				matchedUsersWithScores.push({
					user_id: userId,
					score: score,
					matchingDislikeGroupIds: matchingDislikeGroupIds,
					matchingInterestGroupIds: matchingInterestGroupIds,
					matchingPurposeGroupIds: matchingPurposeGroupIds,
				});
			}
		}

		matchedUsersWithScores.sort((a, b) => {
			if (b.score === a.score) {
				return b.user_id - a.user_id;
			}
			return b.score - a.score;
		});

		const suggestions = [];

		//if there is no match profile then return sample profiles
		if (matchedUsersWithScores.length > 0) {
			for (
				var i = Math.max(page - 1, 0) * limit;
				i <
				Math.min(
					Math.max(page - 1, 0) * limit + limit,
					matchedUsersWithScores.length
				);
				i++
			) {
				const rawuser = matchedUsersWithScores[i];
				const userInfo = await getProfile({ user_id: rawuser.user_id });

				suggestions.push(userInfo.data);
			}
		} else {
			if (page === 1) {
				const randomSampleUsers = process.env.SAMPLE_PROFILES.split(',');

				for (const rawuser of randomSampleUsers) {
					const userInfo = await getProfile({ user_id: rawuser });

					suggestions.push(userInfo.data);
				}
			}
		}

		// for (const rawuser of matchedUsersWithScores) {
		//     if (suggestions.length > 20) {
		//         break
		//     }

		//     const userInfo = await getProfile({ user_id: rawuser.user_id })

		//     suggestions.push(userInfo.data)
		// }

		return Promise.resolve({
			message: 'Best matches list',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getExploreList({ user_id }) {
	try {
		const suggestions = [];

		const blockedUsers = await BlockedUsers.findAll({
			where: {
				[Op.or]: [{ user_id: user_id }, { blocked_id: user_id }],
			},
			raw: true,
		});

		const mactchedUsers = await Matches.findAll({
			where: {
				[Op.or]: [
					{
						[Op.or]: [
							{ sender_id: user_id, status: 'rejected' },
							{ sender_id: user_id, status: 'accepted' },
							{ sender_id: user_id, status: 'deleted' },
							{
								receiver_id: user_id,
								status: 'rejected',
							},
							{
								receiver_id: user_id,
								status: 'accepted',
							},
							{ receiver_id: user_id, status: 'deleted' },
						],
					},
					{ sender_id: user_id, status: 'sent' },
				],
			},
			raw: true,
		});

		const blockedUserIds = blockedUsers.map((item) =>
			item.user_id === user_id ? item.blocked_id : item.user_id
		);
		const matchedUserIds = mactchedUsers.map((item) =>
			item.sender_id === user_id ? item.receiver_id : item.sender_id
		);

		const avoidUserIds = findUnique(blockedUserIds, matchedUserIds);

		// const allUserIds = await Users.findAll({
		// 	where: {
		// 		is_active: true,
		// 		is_hidden_users: false,
		// 		profile_approved: 'approved',
		// 		profile_tag: {
		// 			[Op.ne]: null,
		// 		},
		// 		id: {
		// 			[Op.notIn]: [user_id, ...avoidUserIds],
		// 		},
		// 	},
		// 	attributes: ['id'],
		// 	order: [['id', 'desc']],
		// 	raw: true,
		// });
		console.log(avoidUserIds.length);

		const allUserIds = await Users.findAll({
			where: {
				is_active: true,
				is_hidden_users: false,
				profile_approved: 'approved',
				profile_tag: {
					[Op.ne]: null,
				},
				id: {
					[Op.notIn]: [user_id, ...avoidUserIds],
				},
			},
			attributes: ['id'],
			order: [['id', 'desc']],
			raw: true,
		});

		// let matchResult = [];
		// let idSuggestions = [];
		// if (allUserIds.length > 1) {
		// 	try {
		// 		matchResult = await matchUsers(user_id, allUserIds);
		// 		idSuggestions = matchResult.match(/\d+/g);
		// 	} catch (error) {
		// 		idSuggestions = allUserIds.map((item) => item.id);
		// 	}
		// } else {
		// 	idSuggestions = allUserIds.map((item) => item.id);
		// }
		const users = (await calculateMatchScore(user_id, avoidUserIds, 20)).map(
			(u) => u.user_id
		);

		for (const rawuser of users) {
			console.log(rawuser);
			if (suggestions.length > 20) {
				break;
			}

			const userInfo = await getProfile({ user_id: rawuser });

			suggestions.push(userInfo.data);
		}

		return Promise.resolve({
			message: 'Explore list',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getMatchesWithPreminum({ user_id }) {
	try {
		const freeCount = await Matches.count({
			where: {
				[Op.or]: [
					{ sender_id: user_id },
					{ receiver_id: user_id },
				],
			},
			order: [['send_date', 'ASC']],
		});

		const matches = await Matches.scope({ method: ['withIsFree', user_id] }).findAll({
			where: {
				[Op.or]: [
					{ sender_id: user_id, status: 'sent' },
					{ sender_id: user_id, status: 'accepted' },
					{ receiver_id: user_id, status: 'sent' },
					{ receiver_id: user_id, status: 'accepted' },
				],
			},
			include: [
				{ model: Users, as: 'sender' },
				{ model: Users, as: 'receiver' },
			],
			order: [['last_message_date', 'DESC']],
		});
		const finalMatches = [];
		for (const match of matches) {
			if (match.get('sender_id') === user_id) {
				const userInfo = await getProfile({
					user_id: match.get('receiver_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			} else {
				const userInfo = await getProfile({
					user_id: match.get('sender_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			}
		}

		return Promise.resolve({
			message: 'Matches list',
			data: {
				matches: finalMatches,
				freeTotal: 3,
				freeCount: freeCount //Math.min(freeCount, 3),
			}
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getMatches({ user_id }) {
	try {
		const matches = await Matches.findAll({
			where: {
				[Op.or]: [
					{ sender_id: user_id, status: 'sent' },
					{ sender_id: user_id, status: 'accepted' },
					{ receiver_id: user_id, status: 'sent' },
					{ receiver_id: user_id, status: 'accepted' },
				],
			},
			include: [
				{
					model: Users,
					as: 'sender',
					where: { profile_approved: 'approved' },
				},
				{
					model: Users,
					as: 'receiver',
					where: { profile_approved: 'approved' },
				},
			],
			order: [['last_message_date', 'DESC']],
		});
		const finalMatches = [];
		for (const match of matches) {
			if (match.get('sender_id') === user_id) {
				const userInfo = await getProfile({
					user_id: match.get('receiver_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			} else {
				const userInfo = await getProfile({
					user_id: match.get('sender_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			}
		}

		return Promise.resolve({
			message: 'Matches list',
			data: finalMatches,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getRecentMatches({ user_id }) {
	try {
		const threeDaysAgo = new Date();
		threeDaysAgo.setDate(threeDaysAgo.getDate() - 300);

		const matches = await Matches.findAll({
			where: {
				[Op.and]: [
					{
						[Op.or]: [
							{ sender_id: user_id, status: 'sent' },
							{ sender_id: user_id, status: 'accepted' },
							{ receiver_id: user_id, status: 'sent' },
							{ receiver_id: user_id, status: 'accepted' },
						],
					},
					{
						sent_date: {
							[Op.gte]: threeDaysAgo,
						},
					},
					{
						messagesCount: {
							[Op.lte]: 5,
						},
					},
				],
			},
			include: [
				{ model: Users, as: 'sender' },
				{ model: Users, as: 'receiver' },
			],
			order: [['sent_date', 'DESC']],
		});

		const finalMatches = [];
		for (const match of matches) {
			if (match.get('sender_id') === user_id) {
				const userInfo = await getProfile({
					user_id: match.get('receiver_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			} else {
				const userInfo = await getProfile({
					user_id: match.get('sender_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			}
		}

		return Promise.resolve({
			message: 'Matches list',
			data: finalMatches,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getUnverifiedMatches({ user_id }) {
	try {
		const matches = await Matches.findAll({
			where: {
				[Op.or]: [
					{ sender_id: user_id, status: 'sent' },
					{ sender_id: user_id, status: 'accepted' },
					{ receiver_id: user_id, status: 'sent' },
					{ receiver_id: user_id, status: 'accepted' },
				],
			},
			include: [
				{
					model: Users,
					as: 'sender',
					where: { profile_approved: { [Op.ne]: 'approved' } },
				},
				{
					model: Users,
					as: 'receiver',
					where: { profile_approved: { [Op.ne]: 'approved' } },
				},
			],
			order: [['last_message_date', 'DESC']],
		});
		const finalMatches = [];
		for (const match of matches) {
			if (match.get('sender_id') === user_id) {
				const userInfo = await getProfile({
					user_id: match.get('receiver_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			} else {
				const userInfo = await getProfile({
					user_id: match.get('sender_id'),
				});
				finalMatches.push({ ...match.toJSON(), profile: userInfo.data });
			}
		}

		return Promise.resolve({
			message: 'Matches list',
			data: finalMatches,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function rejectSuggestion({ user_id, friend_id }) {
	try {
		let existMatch = await Matches.findOne({
			where: {
				[Op.or]: [
					{ sender_id: user_id, receiver_id: friend_id },
					{ sender_id: friend_id, receiver_id: user_id },
				],
			},
		});

		if (!existMatch) {
			existMatch = await Matches.create({
				sender_id: user_id,
				receiver_id: friend_id,
			});
		}

		existMatch = await Matches.update(
			{ status: 'rejected' },
			{
				where: { id: existMatch.id },
			}
		);

		// user answered the match. Update the user's onesignal tag with the next unanswered match.
		// const nextNotificationMatch = await getLastRecentUnansweredMatch(
		// 	existMatch.receiver_id
		// );
		// addMatchTagOnesignal(existMatch.receiver_id, nextNotificationMatch);

		const lastestUnanswerDate = await getLastestUnanswerMatch(existMatch.receiver_id)
		updateMatchDateTag(existMatch.receiver_id, lastestUnanswerDate)

		return Promise.resolve({
			message: 'Suggestion rejected',
			data: existMatch,
		});
	} catch (error) {
		return Promise.reject(error);
	}
}

async function disconnect({ id, user_id, friend_id }) {
	try {
		let existMatch = await Matches.findOne({
			where: {
				[Op.or]: [
					{ sender_id: user_id, receiver_id: friend_id, id },
					{ sender_id: friend_id, receiver_id: user_id, id },
				],
			},
		});

		if (existMatch) {
			existMatch = await Matches.update(
				{ status: 'deleted' },
				{
					where: { id: id },
				}
			);

			return Promise.resolve({
				message: 'Connection deleted',
				data: existMatch,
			});
		}

		return Promise.reject('Connection not found!');
	} catch (error) {
		return Promise.reject(error);
	}
}

async function acceptSuggestion({ user_id, friend_id }) {
	try {
		let existMatch = await Matches.findOne({
			where: {
				[Op.or]: [
					{ sender_id: user_id, receiver_id: friend_id },
					{ sender_id: friend_id, receiver_id: user_id },
				],
			},
		});

		const requestUser = await Users.findOne({
			where: { id: user_id },
			attributes: ['id', 'full_name', 'profile_approved', 'email'],
		});

		const receiveUser = await Users.findOne({
			where: { id: friend_id },
			attributes: ['id', 'full_name', 'profile_approved', 'email'],
		});

		if (requestUser && requestUser.profile_approved !== 'approved') {
			return Promise.reject(
				'Your account is almost ready! While we complete the approval, feel free to browse and get familiar with other profiles. You’ll be connecting soon!'
			);
		}

		if (!existMatch) {
			const conversation_id = await createConversation(user_id, friend_id);
			try {
				addMessageToConversation(conversation_id, requestUser, receiveUser);
			} catch (error) { }
			if (conversation_id) {
				existMatch = await Matches.create({
					sender_id: user_id,
					receiver_id: friend_id,
					status: 'sent',
					conversation_id,
					last_message_date: new Date(),
				});
				const m = await existMatch.toJSON();

				addMatchTagOnesignal(friend_id, m);

				const lastestUnanswerDate = await getLastestUnanswerMatch(existMatch.receiver_id)
				updateMatchDateTag(existMatch.receiver_id, lastestUnanswerDate)

				if (requestUser) {
					addNewNotification(
						friend_id,
						user_id,
						existMatch.id,
						null,
						'new_request',
						'You get new connect request.',
						`${requestUser.full_name} wants to connect with you!`
					);
					addNewPushNotification(
						friend_id,
						existMatch,
						null,
						'notification',
						'New connect request!',
						`${requestUser.full_name} wants to connect with you!`
					);

					try {
						const senderPurposes = await UserPurposes.findAll({
							where: { user_id: user_id },
							attributes: {
								include: [
									[
										Sequelize.col(
											'purpose.name'
										),
										'name',
									],
								],
							},
							include: [
								{
									model: Purposes,
									attributes: [
										['name', 'name'],
									],
									where: {
										normalized_purpose_id:
										{
											[Op.ne]:
												null,
										},
									},
								},
							],
							raw: true,
						});

						const sender_purposes = senderPurposes.map(
							(up) => up.name
						);

						const receiverPurposes = await UserPurposes.findAll(
							{
								where: { user_id: user_id },
								attributes: {
									include: [
										[
											Sequelize.col(
												'purpose.name'
											),
											'name',
										],
									],
								},
								include: [
									{
										model: Purposes,
										attributes: [
											[
												'name',
												'name',
											],
										],
										where: {
											normalized_purpose_id:
											{
												[Op.ne]:
													null,
											},
										},
									},
								],
								raw: true,
							}
						);

						const receiver_purposes = receiverPurposes.map(
							(up) => up.name
						);

						sendRequestEmail({
							to_email: receiveUser.email,
							to_name: receiveUser.full_name,
							to_purposes: receiver_purposes,
							sender_name: requestUser.full_name,
							sender_purposes: sender_purposes,
							conversation_id,
						});
					} catch (error) { }
				}
			}
		} else {
			if (existMatch.status === 'sent') {
				// const conversation_id = await createConversation(user_id, friend_id)
				// if (conversation_id) {
				//     const updatedMatches = await Matches.update({ status: 'accepted', conversation_id, response_date: new Date() }, {
				//         where: {
				//             id: existMatch.id
				//         },
				//     })

				const updatedMatches = await Matches.update(
					{
						status: 'accepted',
						last_message_date: new Date(),
						response_date: new Date(),
					},
					{
						where: {
							id: existMatch.id,
						},
					}
				);
				// user answered the match. Update the user's onesignal tag with the next unanswered match.
				// const nextNotificationMatch = await getLastRecentUnansweredMatch(
				// 	existMatch.receiver_id
				// );

				// addMatchTagOnesignal(existMatch.receiver_id, nextNotificationMatch);

				const lastestUnanswerDate = await getLastestUnanswerMatch(existMatch.receiver_id)
				updateMatchDateTag(existMatch.receiver_id, lastestUnanswerDate)

				existMatch = await Matches.findOne({
					where: {
						id: existMatch.id,
					},
					include: [
						{ model: Users, as: 'sender' },
						{ model: Users, as: 'receiver' },
					],
				});

				if (existMatch.get('sender_id') === user_id) {
					const userInfo = await getProfile({
						user_id: existMatch.get('receiver_id'),
					});
					existMatch = {
						...existMatch.toJSON(),
						profile: userInfo.data,
					};
				} else {
					const userInfo = await getProfile({
						user_id: existMatch.get('sender_id'),
					});
					existMatch = {
						...existMatch.toJSON(),
						profile: userInfo.data,
					};
				}

				addNewNotification(
					user_id,
					friend_id,
					existMatch.id,
					null,
					'new_match',
					'You get new match!',
					'Congratulation! You get new match!'
				);
				addNewNotification(
					friend_id,
					user_id,
					existMatch.id,
					null,
					'new_match',
					'You get new match!',
					'Congratulation! You get new match!'
				);

				addNewPushNotification(
					user_id,
					existMatch,
					null,
					'message',
					'You get new match!',
					'Congratulation! You get new match!'
				);
				addNewPushNotification(
					friend_id,
					existMatch,
					null,
					'message',
					'You get new match!',
					'Congratulation! You get new match!'
				);
				// }
			}
		}

		return Promise.resolve({
			message: 'Suggestion accepted',
			data: existMatch,
		});
	} catch (error) {
		return Promise.reject(error);
	}
}

const createConversation = async (user1Id, user2Id) => {
	try {
		const conversation_id = uuidv4();

		await db
			.collection('conversations')
			.doc(conversation_id)
			.set({
				id: conversation_id,
				participants: [user1Id, user2Id],
				messages: [],
			});

		return conversation_id;
	} catch (error) {
		console.log('Error creating conversation: ', error);
		throw new Error('Failed to create conversation');
	}
};

const addMessageToConversation = async (conversationId, fromUser, toUser) => {
	try {
		let interestList = [];
		const currentUserLikes = (
			await interestsController.getLikes({ user_id: fromUser.id })
		).data.map((d) => d.dataValues);
		const friendLikes = (
			await interestsController.getLikes({ user_id: toUser.id })
		).data.map((d) => d.dataValues);

		const currentUserDislikes = (
			await interestsController.getDislikes({ user_id: fromUser.id })
		).data.map((d) => d.dataValues);
		const friendDislikes = (
			await interestsController.getDislikes({ user_id: toUser.id })
		).data.map((d) => d.dataValues);

		try {
			interestList = await interestsController.checkInterestMatch(
				{ likes: currentUserLikes, dislikes: currentUserDislikes },
				{ likes: friendLikes, dislikes: friendDislikes }
			);
		} catch (err) { }

		const sameInterests = formatNamesWithType(interestList);

		const messageId = uuidv4();
		const message =
			`Hi ${toUser.full_name},\n` +
			`I’d love to connect with you as we share the same interests ${sameInterests.length > 0 ? `in ${sameInterests}` : ''
			}. 😊\n\n` +
			`Looking forward to connecting!`;

		await db
			.collection('conversations')
			.doc(conversationId)
			.collection('messages')
			.add({
				_id: messageId,
				text: message,
				createdAt: new Date(),
				user: {
					_id: fromUser?.id,
					name: fromUser?.full_name ?? '',
				},
				readBy: [fromUser.id],
				type: 'text',
			});
	} catch (error) {
		console.log('Error creating conversation: ', error);
		throw new Error('Failed to create conversation');
	}
};

async function updateLastMessage({ user_id, conversation_id, last_message }) {
	try {
		const last_message_date = new Date();
		// we don't need these anymore because we're keeping the full messages log
		const updatedMatch = await Matches.update(
			{
				last_message,
				last_message_date,
				last_message_sender: user_id,
				// messagesCount: sequelize.literal('messagesCount + 1'),
			},
			{
				where: {
					[Op.or]: [{ sender_id: user_id }, { receiver_id: user_id }],
					conversation_id: conversation_id,
				},
			}
		);

		await Matches.increment(
			{ messagesCount: 1 },
			{
				where: {
					[Op.or]: [{ sender_id: user_id }, { receiver_id: user_id }],
					conversation_id: conversation_id,
				},
			}
		);

		const existMatch = await Matches.findOne({
			where: {
				[Op.or]: [{ sender_id: user_id }, { receiver_id: user_id }],
				conversation_id: conversation_id,
			},
			include: [
				{ model: Users, as: 'sender' },
				{ model: Users, as: 'receiver' },
			],
		});

		await Messages.create({
			text: last_message,
			senderId: user_id,
			matchId: existMatch.id,
			createdAt: last_message_date,
		});

		try {
			if (existMatch.sender_id === user_id) {
				addNewPushNotification(
					existMatch.receiver_id,
					existMatch.toJSON(),
					null,
					'message',
					existMatch.sender?.full_name ?? 'New message',
					last_message
				);
			} else {
				addNewPushNotification(
					existMatch.sender_id,
					existMatch.toJSON(),
					null,
					'message',
					existMatch.receiver?.full_name ?? 'New message',
					last_message
				);
			}
		} catch (error) {
			console.log({ error });
		}

		return Promise.resolve({
			data: existMatch,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getConversation({ user_id, conversation_id }) {
	try {
		const match = await Matches.findOne({
			where: {
				[Op.or]: [
					{ sender_id: user_id, conversation_id },
					{ receiver_id: user_id, conversation_id },
				],
			},
			include: [
				{ model: Users, as: 'sender' },
				{ model: Users, as: 'receiver' },
			],
		});

		if (!match) {
			return Promise.reject('Connection not found!');
		}

		if (match.get('sender_id') === user_id) {
			const userInfo = await getProfile({ user_id: match.get('receiver_id') });

			return Promise.resolve({
				message: 'Conversation detail',
				data: { ...match.toJSON(), profile: userInfo.data },
			});
		} else {
			const userInfo = await getProfile({ user_id: match.get('sender_id') });

			return Promise.resolve({
				message: 'Conversation detail',
				data: { ...match.toJSON(), profile: userInfo.data },
			});
		}
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getSampleProfiles() {
	try {
		const suggestions = [];
		// const randomSampleUsers = getRandomElements(
		// 	process.env.SAMPLE_PROFILES.split(',') ?? [],
		// 	3
		// );
		const randomSampleUsers = await Users.findAll({
			where: {
				is_active: true,
				is_hidden_users: false,
				profile_approved: 'approved',
				video_intro: {
					[Op.ne]: null,
				},
				profile_tag: {
					[Op.ne]: null,
				}
			},
			attributes: ['id', 'profile_tag'],
			orderBy: [['id', 'DESC']],
		});

		for (const rawuser of randomSampleUsers) {
			const userInfo = await getProfile({ user_id: rawuser });

			suggestions.push(userInfo.data);
		}

		return Promise.resolve({
			message: 'Sample profiles',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getSampleExplore() {
	try {
		const suggestions = [];
		const randomSampleUsers = process.env.SAMPLE_PROFILES.split(',');

		for (const rawuser of randomSampleUsers) {
			try {
				const userInfo = await getProfile({ user_id: rawuser });

				suggestions.push(userInfo.data);
			} catch (error) {

			}
		}

		return Promise.resolve({
			message: 'Sample profiles',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function getMatchById(id) {
	return Matches.findOne({ where: { id } });
}

async function getMessages(conversationId, pageSize = 10, nextPageToken) {
	if (!conversationId) {
		return {
			messages: [],
			nextPageToken: null,
		};
	}

	if (nextPageToken === '-1') {
		return {
			messages: [],
			nextPageToken: '-1',
		};
	}

	const messagesRef = db
		.collection('conversations')
		.doc(conversationId)
		.collection('messages');

	let query = messagesRef.orderBy('createdAt', 'asc').limit(parseInt(pageSize));

	if (nextPageToken && nextPageToken !== '') {
		const snapshot = await messagesRef.doc(nextPageToken).get();
		console.log('snapshot', snapshot);
		if (!snapshot.exists) {
			throw Error('Invalid nextPageToken');
		}
		query = query.startAfter(snapshot);
	}

	const querySnapshot = await query.get();

	if (querySnapshot.empty) {
		return {
			messages: [],
			nextPageToken: '-1',
		};
	}

	const messages = [];
	let lastDoc = null;

	querySnapshot.forEach((doc) => {
		messages.push({ id: doc.id, ...doc.data() });
		lastDoc = doc;
	});

	return {
		messages,
		nextPageToken: lastDoc.id,
	};
}

async function calculateMatchScore(userId, incompatibleUserIds, limit = 20) {
	const matches = await sequelize.query(
		`

		SELECT user_id, COALESCE(interests_table.matching_score + purposes_table.score,interests_table.matching_score,0)  as match_score FROM (
		SELECT 
    u2.id AS user_id,
    COALESCE(SUM(
        CASE
            WHEN ui1.interest_type = ui2.interest_type THEN 1
            WHEN ui1.interest_type != ui2.interest_type THEN -1
            ELSE 0
        END
    ), 0) AS matching_score
FROM users u1
CROSS JOIN users u2
LEFT JOIN user_interests ui1 ON u1.id = ui1.user_id
LEFT JOIN interests i1 ON ui1.interest_id = i1.id
LEFT JOIN interests i2 ON i1.normalized_interest_id = i2.normalized_interest_id
LEFT JOIN user_interests ui2 ON i2.id = ui2.interest_id AND u2.id = ui2.user_id
WHERE u1.id = :currentUserId AND u2.id != :currentUserId
   AND u2.profile_approved = 'approved' AND u2.is_active = TRUE AND u2.is_hidden_users = FALSE
   AND u2.profile_tag IS NOT NULL
   AND u2.id NOT IN (:incompatibleUserIds)
GROUP BY u2.id

) interests_table 

LEFT JOIN (

	SELECT ui2.user_id AS uid, COUNT(*)*2 as score
	FROM users u1
	 JOIN user_purposes ui1 ON u1.id = ui1.user_id
	 JOIN purposes i1 ON ui1.purpose_id = i1.id
	 JOIN purposes i2 ON i1.normalized_purpose_id = i2.normalized_purpose_id
	 JOIN user_purposes ui2 ON i2.id = ui2.purpose_id
	WHERE u1.id = :currentUserId
		AND ui2.user_id != :currentUserId
		AND u1.profile_approved = 'approved' AND u1.is_active = TRUE AND u1.is_hidden_users = FALSE
		AND u1.profile_tag IS NOT NULL
		AND u1.id NOT IN (:incompatibleUserIds)
	GROUP BY ui2.user_id

	) purposes_table ON interests_table.user_id = purposes_table.uid
	 ORDER BY match_score DESC,
	 user_id DESC 
	 LIMIT ${limit};


        `,
		{
			type: sequelize.QueryTypes.SELECT,
			replacements: { currentUserId: userId, incompatibleUserIds, limit },
		}
	);

	return matches;
}

async function syncMessages(page = 0, limit = 100) {
	console.log(`Sync messages for match page ${page}`);

	const messages = await Messages.findAll({ limit: 1 });

	if (messages.length !== 0 && page === 0) {
		console.log('Messages already exist in the database...Do not sync.');
		return;
	}

	const matches = await Matches.findAll({
		offset: page * limit,
		limit,
	});

	await Promise.all(
		matches.map(async (m) => {
			const conversationId = m.conversation_id;

			if (!conversationId) {
				return;
			}

			const messages = await db
				.collection('conversations')
				.doc(conversationId)
				.collection('messages')
				.get();

			const documents = [];
			messages.forEach((doc) => {
				documents.push({ id: doc.id, ...doc.data() });
			});

			return Promise.all(
				documents.map(async (message) => {
					return Messages.create({
						text: message.text,
						matchId: m.id,
						senderId: message.user._id,
						createdAt: new Date(
							message.createdAt.seconds * 1000 +
							message.createdAt.nanoseconds /
							1000000
						),
					});
				})
			);
		})
	);

	if (matches.length !== 0) {
		return syncMessages(page + 1, limit);
	}

	console.log('Finished syncing messages.');
}

async function getLastRecentUnansweredMatch(userId) {
	const twoDaysAgo = new Date();
	twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
	const result = await Matches.findAll({
		where: {
			status: 'sent',
			receiver_id: userId,
			sent_date: {
				[Op.gte]: twoDaysAgo,
			},
		},
		order: [['sent_date', 'DESC']],
		limt: 1,
	});

	if (!result.length) {
		return;
	}

	return result[0];
}

async function getLastestUnanswerMatch(userId) {
	const result = await Matches.findAll({
		where: {
			status: 'sent',
			receiver_id: userId,
		},
		order: [['sent_date', 'DESC']],
		limt: 1,
	});

	if (!result.length) {
		return '';
	}

	return result[0].sent_date;
}

async function searchByJourney({ journey_id, limit = 20, offset = 0 }) {
	try {
		if (!journey_id) {
			return Promise.reject('Journey id is required');
		}

		const suggestions = [];

		const filterUsers = await Users.findAll({
			where: {
				is_active: true,
				is_hidden_users: false,
				profile_approved: 'approved',
				profile_tag: {
					[Op.ne]: null,
				},
			},
			include: [
				{
					model: UserPurposes,
					as: 'user_purposes',
					where: { purpose_id: journey_id },
					attributes: [],
				},
			],
			attributes: ['id', 'profile_tag'],
			limit: limit,
			offset: offset,
			order: [['id', 'DESC']],
			raw: true,
		});

		for (const rawuser of filterUsers) {
			const userInfo = await getSimpleProfile({ user_id: rawuser.id });
			suggestions.push(userInfo.data);
		}

		return Promise.resolve({
			message: 'Search by journey',
			data: suggestions,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

module.exports = findBestMatches;

module.exports = {
	getMessages,
	getExploreList,
	getMatches,
	acceptSuggestion,
	rejectSuggestion,
	updateLastMessage,
	disconnect,
	findBestMatches,
	findLessMatches,
	getConversation,
	getSampleProfiles,
	getMatchById,
	getSampleExplore,
	syncMessages,
	db,
	getMatchesWithPreminum,
	getRecentMatches,
	getUnverifiedMatches,
	findMatchesByPurpose,
	searchByJourney
};
