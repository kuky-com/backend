const Users = require('@/models/users');
const Matches = require('../models/matches');
const Notifications = require('../models/notifications');
const { addOnesignalNotification } = require('@controllers/onesignal');
const { Op } = require('sequelize');
const Sequelize = require('../config/database');
var admin = require('firebase-admin');
const Sessions = require('../models/sessions');

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
		if (user_id === 1) {
			const supportUsers = await Users.findAll({
				where: { is_support: true },
				attributes: ['id'],
				raw: true,
			});
			console.log({ supportUsers })
			for (const supportUser of supportUsers) {
				await sendSinglePush(
					supportUser.id,
					match,
					suggest,
					type,
					title,
					content,
					true
				);
			}
		} else {
			await sendSinglePush(user_id, match, suggest, type, title, content, false);
		}

		return Promise.resolve({
			message: 'Push notification sent successfully',
		});
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function sendSinglePush(user_id, match = null, suggest = null, type, title, content, is_support = false) {
	try {
		const sessions = await Sessions.findAll({
			where: {
				user_id: user_id,
				logout_date: {
					[Op.eq]: null,
				},
				session_token: {
					[Op.ne]: null,
				},
			},
			attributes: [
				[
					Sequelize.fn('DISTINCT', Sequelize.col('session_token')),
					'session_token',
				],
			],
			raw: true,
		});
		const sessionTokens = sessions.map((item) => item.session_token);
		if (sessionTokens.length > 0) {
			const notiData = JSON.stringify({
				type,
				match,
				suggest,
			});

			const res = await admin.messaging().sendEachForMulticast({
				notification: {
					title: title,
					body: content,
				},
				data: { data: notiData },
				tokens: sessionTokens,
			});
		}

		await addOnesignalNotification(
			title,
			content,
			{
				type,
				matchId: match?.id,
				suggestUserId: suggest?.id,
				conversationId: match?.conversation_id,
				is_support: is_support
			},
			user_id
		);

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
};
