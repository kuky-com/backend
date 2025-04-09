const Users = require('@/models/users');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Purposes = require('../../models/purposes');
const Interests = require('../../models/interests');
const Matches = require('../../models/matches');
const { Op, Sequelize } = require('sequelize');
const LeadUsers = require('../../models/lead_users');
const { normalizePurposes, getPurposes } = require('../interests');
const UserPurposes = require('../../models/user_purposes');
const Suggestions = require('../../models/suggestions');
const emailService = require('../email');
const { addNewNotification, addNewPushNotification } = require('../notifications');
const AdminUsers = require('../../models/admin_users');
const AdminSessions = require('../../models/admin_sessions');
const AppVersions = require('../../models/versions');
const Tags = require('../../models/tags');
const { updateRejectedDateTag } = require('../onesignal');
const ReferralUsers = require('../../models/referral_users');
const Messages = require('../../models/messages');
const { db } = require('../matches');
const { v4: uuidv4 } = require('uuid');
const JourneyCategories = require('../../models/journey_categories');
const Journeys = require('../../models/journeys');

function generateToken(session_id, admin_id) {
	return jwt.sign({ session_id, admin_id }, process.env.JWT_SECRET, {
		expiresIn: '30d',
	});
}

async function createLeadUsers(users) {
	try {
		users.forEach(async (user) => {
			let purpose = await Purposes.findOne({
				where: {
					name: user.purpose,
				},
			});

			if (!purpose) {
				purpose = await Purposes.create({
					name: user.purpose,
				});
				await normalizePurposes(purpose.id);
			}

			let userInfo = await LeadUsers.findOne({
				where: {
					email: user.email,
				},
			});

			if (!userInfo) {
				await LeadUsers.create({
					...user,
					purpose_id: purpose.id,
				});
			} else {
				await LeadUsers.update(
					{
						...user,
						purpose_id: purpose.id,
					},
					{
						where: {
							email: user.email,
						},
					}
				);
			}
		});

		const leadUsers = await LeadUsers.findAll();

		return Promise.resolve({
			data: leadUsers,
			message: 'Update successfully',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function checkSuggestion({ to_email, suggest_email }) {
	try {
		if (to_email === suggest_email) {
			return Promise.reject('To email and suggestion is same');
		}

		const suggestUser = await Users.findOne({
			where: {
				email: suggest_email,
			},
		});

		if (!suggestUser) {
			return Promise.reject('Suggest user not exist');
		}

		if (!suggestUser) {
			return Promise.reject('Suggest user not exist');
		}

		const user = await Users.findOne({
			where: {
				email: to_email,
			},
		});

		const suggestPurposes = await UserPurposes.findAll({
			where: { user_id: suggestUser.id },
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

		let to_email_purposes = [];
		const suggest_email_purposes = suggestPurposes.map((up) => up.name);
		if (user) {
			let existMatch = await Matches.findOne({
				where: {
					[Op.or]: [
						{
							sender_id: user.id,
							receiver_id: suggestUser.id,
						},
						{
							sender_id: suggestUser.id,
							receiver_id: user.id,
						},
					],
				},
			});

			if (existMatch) {
				return Promise.reject('These 2 people has already connected.');
			}

			const toPurposes = await UserPurposes.findAll({
				where: { user_id: user.id },
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

			to_email_purposes = toPurposes.map((up) => up.name);
		} else {
			const leadUser = await LeadUsers.findOne({
				where: {
					email: to_email,
				},
			});

			if (!leadUser) {
				return Promise.reject(`Dont have information about ${to_email}!`);
			}

			to_email_purposes = [leadUser.purpose];
		}

		return Promise.resolve({
			data: {
				to_email_purposes,
				suggest_email_purposes,
				to_email_registered: user !== null,
			},
			message: 'This suggestion is valid!',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function sendSuggestion({ to_email, suggest_email }) {
	try {
		if (to_email === suggest_email) {
			return Promise.reject('To email and suggestion is same');
		}

		const suggestUser = await Users.findOne({
			where: {
				email: suggest_email,
			},
		});

		if (!suggestUser) {
			return Promise.reject('Suggest user not exist');
		}

		if (!suggestUser) {
			return Promise.reject('Suggest user not exist');
		}

		const user = await Users.findOne({
			where: {
				email: to_email,
			},
		});

		const suggestPurposes = await UserPurposes.findAll({
			where: { user_id: suggestUser.id },
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

		let to_email_purposes = [];
		let to_full_name = '';
		const suggest_email_purposes = suggestPurposes.map((up) => up.name);

		if (user) {
			let existMatch = await Matches.findOne({
				where: {
					[Op.or]: [
						{
							sender_id: user.id,
							receiver_id: suggestUser.id,
						},
						{
							sender_id: suggestUser.id,
							receiver_id: user.id,
						},
					],
				},
			});

			if (existMatch) {
				return Promise.reject('These 2 people has already connected.');
			}

			const toPurposes = await UserPurposes.findAll({
				where: { user_id: user.id },
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

			to_email_purposes = toPurposes.map((up) => up.name);
			to_full_name = user.full_name;

			addNewNotification(
				user.id,
				suggestUser.id,
				null,
				suggestUser.id,
				'new_suggestions',
				'New suggestion',
				`You and ${suggestUser.full_name} are on the same journey.`
			);
			addNewPushNotification(
				user.id,
				null,
				suggestUser,
				'new_suggestions',
				'New suggestion',
				`You and ${suggestUser.full_name} are on the same journey.`
			);
		} else {
			const leadUser = await LeadUsers.findOne({
				where: {
					email: to_email,
				},
			});

			if (!leadUser) {
				return Promise.reject(`Dont have information about ${to_email}!`);
			}

			to_email_purposes = [leadUser.purpose];
			to_full_name = leadUser.full_name;
		}

		const suggestion = await Suggestions.create({
			email: to_email,
			friend_id: suggestUser.id,
		});

		await emailService.sendSuggestEmail({
			to_email,
			suggest_purposes: suggest_email_purposes,
			suggest_name: suggestUser.full_name,
			to_purposes: to_email_purposes,
			to_name: to_full_name,
			suggest_id: suggestUser.id,
		});

		return Promise.resolve({
			data: suggestion,
			message: 'Suggestion email sent!',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function createAdmin({ full_name, username, password }) {
	try {
		const existingUser = await AdminUsers.findOne({
			where: { username },
		});
		if (existingUser) {
			return Promise.reject('Username already registered');
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const user = await AdminUsers.create({
			full_name,
			username,
			password: hashedPassword,
			is_active: false,
		});

		return Promise.resolve({ message: 'Admin account created!' });
	} catch (error) {
		console.log({ error });
		return Promise.reject(error);
	}
}

async function login({ username, password }) {
	try {
		const admin = await AdminUsers.scope('withPassword').findOne({
			where: { username },
		});

		if (!admin) {
			return Promise.reject('Admin not found');
		}

		if (!admin.is_active) {
			return Promise.reject('Admin not verified');
		}

		const isMatch = await bcrypt.compare(password, admin.password);
		if (!isMatch) {
			return Promise.reject('Invalid username or password');
		}

		const newSession = await AdminSessions.create({
			admin_id: admin.id,
			platform: 'web',
			login_date: new Date(),
		});

		const token = generateToken(newSession.id, admin.id);
		const jsonAdmin = admin.toJSON();
		delete jsonAdmin.password;
		return Promise.resolve({
			data: {
				admin: jsonAdmin,
				token,
			},
			message: 'Login successful',
		});
	} catch (error) {
		console.log(error);
		return Promise.reject('Login failed! Please try again!');
	}
}

async function getUsers({ page = 1, limit = 20, query = '', profileStatus, hasVideo, platforms }) {
	try {
		const offset = (page - 1) * limit;

		const { count, rows } = await Users.findAndCountAll();

		const isNumericQuery = !isNaN(query) && query !== '';

		const relevanceScore = Sequelize.literal(`
            CASE
				WHEN users.id = ${isNumericQuery ? Number.parseInt(query) : -1} THEN 3
				WHEN LOWER(email) LIKE LOWER('%${query}%') THEN 2
				WHEN LOWER(full_name) LIKE LOWER('%${query}%') THEN 1
				ELSE 0
			END
        `);

		if (profileStatus === '') {
			return {
				data: {
					total: 0,
					users: [],
				},
				message: 'Users list',
			};
		}

		if (platforms === '') {
			return {
				data: {
					total: 0,
					users: [],
				},
				message: 'Users list',
			};
		}

		const whereClause = {
			profile_approved: {
				[Op.in]: profileStatus.split(','),
			},
			register_platform: {
				[Op.in]: platforms.split(','),
			},
			[Op.or]: [
				Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('email')), {
					[Op.like]: `%${query.toLowerCase()}%`
				}),
				Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('full_name')), {
					[Op.like]: `%${query.toLowerCase()}%`
				}),
			].concat(
				isNumericQuery
					? [
						{
							id: Number.parseInt(query),
						},
					]
					: []
			),
		};

		if (hasVideo && hasVideo === '1') {
			whereClause.video_intro = { [Op.ne]: null };
		}

		const users = await Users.findAll({
			limit: limit,
			offset: offset,
			order: [
				[relevanceScore, 'DESC'],
				['id', 'DESC'],
			],
			where: whereClause,
			include: [
				{
					model: Purposes,
					// attributes: ['name'],
				},
				{
					model: Interests,
				},
				{
					model: Tags,
				},
				{
					model: JourneyCategories
				},
				{
					model: Journeys
				}
			],
			attributes: {
				include: [
					[
						Sequelize.literal(`(
							SELECT COUNT(*)
							FROM matches AS m
							WHERE m.sender_id = users.id OR m.receiver_id = users.id
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
								WHERE m.sender_id = users.id OR m.receiver_id = users.id
							)
						)`),
						'messages_count',
					],
				],
			},
		});

		return Promise.resolve({
			data: {
				total: count,
				users,
			},
			message: 'Users list',
		});
	} catch (error) {
		console.log(error);
		return Promise.reject('Login failed! Please try again!');
	}
}

async function profileAction({ status, reason, user_id }) {
	try {
		if (status === 'rejected' && !reason) {
			return Promise.reject('Reject profile require reason');
		}

		const user = await Users.findOne({
			where: {
				id: user_id,
			},
		});

		if (!user) {
			return Promise.reject('User not exist');
		}

		await Users.update(
			status === 'rejected'
				? {
					profile_approved: 'rejected',
					profile_rejected_reason: reason,
					profile_action_date: new Date(),
				}
				: {
					profile_approved: status,
					profile_action_date: new Date(),
				},
			{
				where: {
					id: user_id,
				},
			}
		);

		try {
			updateRejectedDateTag(user_id, status)
		} catch (error) {
			console.log({ error })
		}

		if (status === 'approved') {
			addNewNotification(
				user.id,
				null,
				null,
				null,
				'profile_approved',
				'Your profile has been approved',
				'Your account has been approved, and you’re all set to start connecting on Kuky.'
			);
			addNewPushNotification(
				user.id,
				null,
				null,
				'profile_approved',
				'Your profile has been approved',
				`Your account has been approved, and you’re all set to start connecting on Kuky.`
			);
			emailService.sendApproveProfileEmail({ to_email: user.email, to_name: user?.full_name });

			try {
				const matchedUsers = await Users.findAll({
					where: {
						journey_id: user.journey_id
					}
				})

				const journey = await Journeys.findOne({
					where: {
						id: user.journey_id
					}
				})

				for (const matchedUser of matchedUsers) {
					await addNewPushNotification(matchedUser.user_id, null, user, 'new_suggestion', `New suggestion 🤝`, `${user.full_name} is on the same journey as you: ${journey?.name}. Tap to view their request and support each other!`);
				}
			} catch (error) {
				console.log({ error })
			}
		} else {
			addNewNotification(
				user.id,
				null,
				null,
				null,
				'profile_rejected',
				'Your profile has been rejected',
				`Unfortunately, your account couldn’t be approved at this time due to the following reason: ${reason}.`
			);
			addNewPushNotification(
				user.id,
				null,
				null,
				'profile_rejected',
				'Your profile has been rejected',
				`Unfortunately, your account couldn’t be approved at this time due to the following reason: ${reason}.`
			);
			emailService.sendRejectProfileEmail({ to_email: user.email, to_name: user?.full_name, reasons: reason.split('\n') });
		}

		return Promise.resolve({
			message: 'Profile updated!',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function setModerator({ is_moderators, user_id }) {
	try {
		const user = await Users.findOne({
			where: {
				id: user_id,
			},
		});

		if (!user) {
			return Promise.reject('User not exist');
		}

		const result = await Users.update(
			{
				is_moderators: is_moderators,
			},
			{
				where: {
					id: user_id,
				},
			}
		);

		return Promise.resolve({
			message: 'Profile updated!',
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function addVersion({
	version_ios,
	version_android,
	is_required,
	description,
	version_title,
}) {
	try {
		const version = await AppVersions.create({
			version_ios,
			version_android,
			is_required,
			description,
			version_title,
		});

		return Promise.resolve({
			message: 'Version added!',
			data: version,
		});
	} catch (error) {
		console.log('Profile update error:', error);
		return Promise.reject(error);
	}
}

async function getMatches({ page = 1, limit = 20, query = '', status = '' }) {
	const isNumericQuery = !isNaN(query) && query !== '';
	const offset = (page - 1) * limit;

	const relevanceScore = Sequelize.literal(`
		CASE
			WHEN receiver_id =  ${isNumericQuery ? Number.parseInt(query) : -1} THEN 60
			WHEN sender_id =  ${isNumericQuery ? Number.parseInt(query) : -1} THEN 60

			WHEN sender.email LIKE '%${query}%' THEN 2
			WHEN receiver.email LIKE '%${query}%' THEN 2

			WHEN sender.full_name LIKE '%${query}%' THEN 1
			WHEN receiver.full_name LIKE '%${query}%' THEN 1

			ELSE 0
		END
	`);

	if (status === '') {
		return {
			count: 0,
			rows: [],
		};
	}

	const { rows, count } = await Matches.findAndCountAll({
		limit,
		offset,
		include: [
			{
				model: Users,
				as: 'sender',
				attributes: ['id', 'full_name', 'email', 'avatar'],
			},
			{
				model: Users,
				as: 'receiver',
				attributes: ['id', 'full_name', 'email', 'avatar'],
			},
		],
		where: {
			status: status.split(','),
			[Op.or]: [
				{
					sender_id: {
						[Op.eq]: isNumericQuery ? query : -1,
					},
				},
				{
					receiver_id: {
						[Op.eq]: isNumericQuery ? query : -1,
					},
				},
				{
					'$sender.full_name$': {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$receiver.full_name$': {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$sender.email$': {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$receiver.email$': {
						[Op.like]: `%${query}%`,
					},
				},
			],
		},

		order: [
			[relevanceScore, 'DESC'],
			['createdAt', 'DESC'],
		],
	});

	return { rows, count };
}

async function getReferrals({ page = 1, limit = 20 }) {
	const offset = (page - 1) * limit;
	const { rows, count } = await ReferralUsers.findAndCountAll({
		include: [
			{
				model: Users,
				as: 'referral_user',
				attributes: ['id', 'full_name', 'email', 'avatar'],
			},
			{
				model: Users,
				as: 'user',
				attributes: ['id', 'full_name', 'email', 'avatar'],
			},
		],
		limit: limit,
		offset: offset,
		order: [
			['id', 'DESC'],
		]
	});

	return { rows, count }
}

async function getLandingPageAmbassadorsInfo() {
	try {
		const snapshot = await db
			.collection('landing_page_ambassadors_info')
			.orderBy('createdAt', 'desc')
			.get();

		const ambassadorsInfo = snapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data()
		}));

		return Promise.resolve({
			data: ambassadorsInfo,
			message: 'Ambassadors info retrieved successfully',
		});
	} catch (error) {
		console.log('Error retrieving ambassadors info:', error);
		return Promise.reject('Error retrieving ambassadors info');
	}
}

async function getLandingPageContactUs() {
	try {
		const snapshot = await db
			.collection('landing_page_contact_us_info')
			.orderBy('createdAt', 'desc')
			.get();

		const contactsInfo = snapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data()
		}));

		return Promise.resolve({
			data: contactsInfo,
			message: 'Contactus info retrieved successfully',
		});
	} catch (error) {
		console.log('Error retrieving ambassadors info:', error);
		return Promise.reject('Error retrieving ambassadors info');
	}
}


async function botSendMessage({ conversation_id, last_message }) {
	try {
		console.log({ conversation_id, last_message })
		const last_message_date = new Date();
		// we don't need these anymore because we're keeping the full messages log
		const updatedMatch = await Matches.update(
			{
				last_message,
				last_message_date,
				last_message_sender: 0,
				send_date: last_message_date,
			},
			{
				where: {
					conversation_id: conversation_id,
				},
			}
		);

		const messageId = uuidv4();
		db
			.collection('conversations')
			.doc(conversation_id)
			.collection('messages')
			.add({
				_id: messageId,
				text: last_message,
				createdAt: new Date(),
				user: {
					_id: 0,
					name: 'Kuky Bot',
				},
				readBy: [0],
				type: 'text',
			});

		await Matches.increment(
			{ messagesCount: 1 },
			{
				where: {
					conversation_id: conversation_id,
				},
			}
		);
		await Matches.increment(
			{ bot_messages_count: 1 },
			{
				where: {
					conversation_id: conversation_id,
				},
			}
		);

		const existMatch = await Matches.findOne({
			where: {
				conversation_id: conversation_id,
			},
			include: [
				{ model: Users, as: 'sender' },
				{ model: Users, as: 'receiver' },
			],
		});

		await Messages.create({
			text: last_message,
			senderId: 0,
			matchId: existMatch.id,
			createdAt: last_message_date,
		});

		try {
			addNewPushNotification(
				existMatch.receiver_id,
				existMatch.toJSON(),
				null,
				'message',
				'Kuky Bot',
				last_message
			);
			addNewPushNotification(
				existMatch.sender_id,
				existMatch.toJSON(),
				null,
				'message',
				'Kuky Bot',
				last_message
			);
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


module.exports = {
	createLeadUsers,
	checkSuggestion,
	sendSuggestion,
	createAdmin,
	login,
	getUsers,
	profileAction,
	addVersion,
	getMatches,
	getReferrals,
	botSendMessage,
	getLandingPageAmbassadorsInfo,
	getLandingPageContactUs,
	setModerator
};
