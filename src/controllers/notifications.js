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
const Tags = require('../models/tags');
const { OpenAI } = require('openai');
const { Op, Sequelize } = require('sequelize');
var admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const Notifications = require('../models/notifications');

const Sessions = require('../models/sessions');

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications';
const ONESISGNAL_APP_ID = 'c3fb597e-e318-4eab-9d90-cd43b9491bc1';

const headers = {
	accept: 'application/json',
	Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
	'content-type': 'application/json',
};

async function getNotificationList({ user_id }) {
	try {
		const notifications = await Notifications.findAll({
			where: { user_id: user_id },
			order: [['notification_date', 'DESC']],
			include: [
				{ model: Users, as: 'user' },
				{ model: Users, as: 'sender' },
				{ model: Matches, as: 'match' },
			],
		});

		return Promise.resolve({
			message: 'Notification list success',
			data: notifications,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function markNotificationAsSeen({ user_id, notification_id }) {
	try {
		const updateNotification = await Notifications.update(
			{ seen: true },
			{ where: { id: notification_id, user_id: user_id } }
		);

		return Promise.resolve({
			message: 'Notification update success',
			data: updateNotification,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function markAllNotificationsAsSeen({ user_id }) {
	try {
		const notifications = await Notifications.update(
			{ seen: true },
			{ where: { user_id: user_id, seen: false } }
		);
		return Promise.resolve({
			message: 'Notification list success',
			data: notifications,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function countUnseenNotifications({ user_id }) {
	try {
		const unseenCount = await Notifications.count({
			where: { user_id: user_id, seen: false },
		});

		return Promise.resolve({
			message: 'Get unseeon count success',
			data: unseenCount,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function createOnesignalUser(user) {
	const tags = {};

	// TODO: uncommnet when we get more likes/purposes
	// for (let i of user.interests) {
	// 	// console.log(i);
	// 	if (i.user_interests.interest_type === 'like' && i.normalized_interest_id) {
	// 		const id = `${process.env.NODE_ENV}_like_${i.normalized_interest_id}`;

	// 		if (tags[id]) {
	// 			tags[id] = tags[id] + 1;
	// 		} else {
	// 			tags[id] = 1;
	// 		}
	// 	}
	// }

	// for (let p of user.purposes) {
	// 	if (p.normalized_purpose_id) {
	// 		const id = `${process.env.NODE_ENV}_purpose_${p.normalized_purpose_id}`;

	// 		if (tags[id]) {
	// 			tags[id] = tags[id] + 1;
	// 		} else {
	// 			tags[id] = 1;
	// 		}
	// 	}
	// }

	if (user.profile_tag) {
		const tag_id = `${process.env.NODE_ENV}_profile_tag`;
		tags[tag_id] = user.profile_tag;
	}

	const onesignalId = process.env.NODE_ENV + '_' + user.id;

	await fetch(`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users`, {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/json' },
		body: JSON.stringify({
			identity: { external_id: onesignalId },
			properties: {
				tags,
			},
		}),
	});
}

async function getOnesignalUser(userId) {
	const onesignalId = process.env.NODE_ENV + '_' + userId;
	const response = await fetch(
		`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users/by/external_id/${onesignalId}`,
		{
			method: 'GET',
			headers: {
				accept: 'application/json',
				Authorization: `Key ${process.env.ONESIGNAL_API_KEY}`,
			},
		}
	);

	return response.json();
}

async function updateOnesignalUser(newOnesignalUser, userId) {
	const onesignalId = process.env.NODE_ENV + '_' + userId;

	const updateResponse = await fetch(
		`https://api.onesignal.com/apps/${ONESISGNAL_APP_ID}/users/by/external_id/${onesignalId}`,
		{
			method: 'PATCH',
			body: JSON.stringify(newOnesignalUser),
			headers: {
				accept: 'application/json',
				Authorization: `${process.env.ONESIGNAL_API_KEY}`,
				'content-type': 'application/json',
			},
		}
	);

	return updateResponse.json();
}

function getUpdatedOnesignalTags(tags, type, normalizedId, operation) {
	return tags;
	// TODO: uncomment

	// const tagId = process.env.NODE_ENV + '_' + type + '_' + normalizedId;
	// if (operation === 'add') {
	// 	if (tags[tagId]) {
	// 		tags[tagId] = parseInt(tags[tagId]) + 1;
	// 	} else {
	// 		tags[tagId] = 1;
	// 	}
	// } else {
	// 	tags[tagId] = parseInt(tags[tagId]) - 1;
	// 	if (tags[tagId] <= 0) {
	// 		tags[tagId] = '';
	// 	}
	// }

	// return tags;
}

async function updateOnesignalUserTags(userId, type, normalizedId, operation) {
	if (!normalizedId) {
		return;
	}

	const user = await getOnesignalUser(userId);

	user.properties.tags = getUpdatedOnesignalTags(
		user.properties.tags,
		type,
		normalizedId,
		operation
	);

	return updateOnesignalUser(user, userId);
}

async function addNewNotification(
	user_id,
	sender_id = null,
	match_id = null,
	suggest_id = null,
	type,
	title,
	content
) {
	try {
		const newNotification = await Notifications.create({
			user_id: user_id,
			sender_id: sender_id,
			match_id: match_id,
			suggest_id: suggest_id,
			notification_type: type,
			content,
			title,
		});

		return Promise.resolve({
			message: 'New notification created',
			data: newNotification,
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function addNewPushNotification(user_id, match = null, suggest = null, type, title, content) {
	try {
		// const sessions = await Sessions.findAll({
		// 	where: {
		// 		user_id: user_id,
		// 		logout_date: {
		// 			[Op.eq]: null,
		// 		},
		// 		session_token: {
		// 			[Op.ne]: null,
		// 		},
		// 	},
		// 	attributes: [
		// 		[
		// 			Sequelize.fn('DISTINCT', Sequelize.col('session_token')),
		// 			'session_token',
		// 		],
		// 	],
		// 	raw: true,
		// });
		// const sessionTokens = sessions.map((item) => item.session_token);
		// if (sessionTokens.length > 0) {

		// 	// const res = await admin.messaging().sendEachForMulticast({
		// 	// 	notification: {
		// 	// 		title: title,
		// 	// 		body: content,
		// 	// 	},
		// 	// 	data: { data: notiData },
		// 	// 	tokens: sessionTokens,
		// 	// });
		// }

		// const notiData = JSON.stringify({
		// 	type,
		// 	match,
		// 	suggest,
		// });

		const body = {
			include_external_user_ids: [`${process.env.NODE_ENV}_${user_id}`],
			channel_for_external_user_ids: 'push',
			app_id: ONESISGNAL_APP_ID,

			// additional_data:
			data: {
				type,
				matchId: match?.id,
				suggestUserId: suggest?.id,
				conversationId: match?.conversation_id,
			},
			headings: {
				en: title,
			},
			contents: {
				en: content,
			},
		};

		const res = await fetch(ONESIGNAL_URL, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		});
		const r = await res.json();
		console.log('ok', body, headers, r);
		if (r.errors?.length) {
			console.log('Notification errors: ', r.errors);
		}

		return Promise.resolve({
			message: 'New notification created',
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

module.exports = {
	getNotificationList,
	markNotificationAsSeen,
	markAllNotificationsAsSeen,
	addNewNotification,
	addNewPushNotification,
	countUnseenNotifications,
	createOnesignalUser,
	updateOnesignalUserTags,
	getOnesignalUser,
	getUpdatedOnesignalTags,
	updateOnesignalUser,
};
