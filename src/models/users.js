const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('@/config/database');
const Tags = require('./tags');
const { v4: uuidv4 } = require('uuid');

const Users = sequelize.define('users', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	full_name: {
		type: DataTypes.STRING(100),
		allowNull: true,
	},
	username: {
		type: DataTypes.STRING(100),
		allowNull: true,
	},
	email: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true,
	},
	password: {
		type: DataTypes.STRING,
	},
	login_type: {
		type: DataTypes.ENUM('phone', 'email', 'apple', 'google'),
	},
	gender: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	email_verified: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	is_active: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	membership_expired_at: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	pronouns: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	avatar: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	avatar_blur: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	birthday: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	publicGender: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	publicPronouns: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	emailNotificationEnable: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	notificationEnable: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	subscribeEmail: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	location: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	last_longitude: {
		type: DataTypes.DOUBLE,
		allowNull: true,
	},
	last_latitude: {
		type: DataTypes.DOUBLE,
		allowNull: true,
	},
	is_hidden_users: {
		type: DataTypes.BOOLEAN,
		allowNull: true,
		defaultValue: false,
	},
	is_premium_user: {
		type: DataTypes.BOOLEAN,
		allowNull: true,
		defaultValue: false,
	},
	is_moderators: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	is_support: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	profile_approved: {
		type: DataTypes.ENUM('pending', 'rejected', 'approved', 'resubmitted', 'partially_approved'),
		allowNull: false,
		defaultValue: 'pending',
	},
	online_status: {
		type: DataTypes.ENUM('active', 'away', 'offline'),
		allowNull: false,
		defaultValue: 'active',
	},
	profile_rejected_reason: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	profile_action_date: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	video_intro_public: {
		type: DataTypes.BOOLEAN,
		defaultValue: true,
	},
	video_intro: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_purpose: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	audio_purpose: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	skip_recording_count: {
		type: DataTypes.INTEGER,
		defaultValue: 0
	},
	score_ranking: {
		type: DataTypes.INTEGER,
		defaultValue: 100
	},
	subtitle_purpose: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_challenge: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	audio_challenge: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	subtitle_challenge: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_why: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	audio_why: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	subtitle_why: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_interests: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	audio_interests: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	subtitle_interests: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_purpose_audio: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_intro_blur: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_purpose_blur: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	video_interests_blur: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	payment_type: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	payment_id: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	referral_id: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true,
		defaultValue: () => uuidv4().replace(/-/g, '').toUpperCase(),
	},
	profile_tag: {
		type: DataTypes.INTEGER,
		allowNull: true,
		references: {
			model: 'tags',
			key: 'id',
		},
		onDelete: 'NO ACTION',
	},
	last_active_time: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	note: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	user_note: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	audio_intro: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	subtitle_intro: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	summary: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	moderator_note: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	video_intro_transcript: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	video_purpose_transcript: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	video_interests_transcript: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	is_video_intro_blur: {
		type: DataTypes.BOOLEAN,
		defaultValue: false
	},
	is_video_purpose_blur: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	is_video_interests_blur: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	is_avatar_blur: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	register_platform: {
		type: DataTypes.STRING,
		allowNull: true,
		defaultValue: 'web'
	},
	journey_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
		references: {
			model: 'journeys',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	journey_category_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
		references: {
			model: 'journey_categories',
			key: 'id',
		},
		onDelete: 'CASCADE',
	}
});

module.exports = Users;

Users.belongsTo(Tags, { foreignKey: 'profile_tag' });

const Journeys = require('./journeys');
const JourneyCategories = require('./journey_categories');

Users.belongsTo(Journeys, { foreignKey: 'journey_id' });

Users.belongsTo(JourneyCategories, { foreignKey: 'journey_category_id' });

Users.addScope('defaultScope', {
	attributes: {
		exclude: ['password'],
	},
});

Users.addScope('includeBlurVideo', {
	attributes: {
		include: [
			[
				Sequelize.literal(`
					CASE
						WHEN is_video_intro_blur = TRUE THEN video_intro_blur
						ELSE video_intro
					END
				`),
				'video_intro'
			],
			[
				Sequelize.literal(`
					CASE
						WHEN is_video_purpose_blur = TRUE THEN video_purpose_blur
						ELSE video_purpose
					END
				`),
				'video_purpose'
			],
			[
				Sequelize.literal(`
					CASE
						WHEN is_avatar_blur = TRUE THEN avatar_blur
						ELSE avatar
					END
				`),
				'avatar'
			],
			[
				Sequelize.literal(`
					CASE
						WHEN is_video_interests_blur = TRUE THEN video_interests_blur
						ELSE video_interests
					END
				`),
				'video_interests'
			]
		]
	}
});


Users.addScope('blurVideo', {
	attributes: [
		[
			Sequelize.literal(`
				CASE
					WHEN is_video_intro_blur = TRUE THEN video_intro_blur
					ELSE video_intro
				END
			`),
			'video_intro'
		],
		[
			Sequelize.literal(`
				CASE
					WHEN is_video_purpose_blur = TRUE THEN video_purpose_blur
					ELSE video_purpose
				END
			`),
			'video_purpose'
		],
		[
			Sequelize.literal(`
				CASE
					WHEN is_avatar_blur = TRUE THEN avatar_blur
					ELSE avatar
				END
			`),
			'avatar'
		],
		[
			Sequelize.literal(`
				CASE
					WHEN is_video_interests_blur = TRUE THEN video_interests_blur
					ELSE video_interests
				END
			`),
			'video_interests'
		],
	],
});

Users.addScope('simpleProfile', {
	attributes: [
		'id', 'full_name', 'avatar', 'location', 'birthday', 
					'referral_id', 'last_active_time', 'online_status', 'profile_approved', 'summary',
					'video_intro', 'video_purpose', 'video_interests'
	]
});

Users.addScope('withPassword', {
	attributes: {
		include: ['password'],
	},
});

Users.addScope('withInterestCount', {
	attributes: {
		exclude: ['password'],
		include: [
			[
				Sequelize.literal(`(
                    SELECT CAST(COUNT(*) AS INTEGER)
                    FROM user_interests AS ui
                    WHERE ui.user_id = users.id and ui.interest_type = 'like'
                )`),
				'likeCount'
			],
			[
				Sequelize.literal(`(
                    SELECT CAST(COUNT(*) AS INTEGER)
                    FROM user_interests AS ui
                    WHERE ui.user_id = users.id and ui.interest_type = 'dislike'
                )`),
				'dislikeCount'
			],
			[
				Sequelize.literal(`(
                    SELECT CAST(COUNT(*) AS INTEGER)
                    FROM user_purposes AS up
                    WHERE up.user_id = users.id
                )`),
				'purposeCount'
			]
		]
	},
});

Users.addScope('askJPFGeneral', {
	attributes: {
		include: [
			[
				sequelize.literal(false),
				'askJPFGeneral'
			]
		]
	},
});

Users.addScope('askJPFSpecific', {
	attributes: {
		include: [
			[
				sequelize.literal(false),
				'askJPFSpecific'
			]
		]
	}
});

// Users.addScope('askJPFGeneral', {
// 	attributes: {
// 		include: [
// 			[
// 				Sequelize.literal(`(
// 					SELECT CASE
// 						WHEN COUNT(*) = 0 THEN true
// 						ELSE EXISTS (
// 							SELECT 1
// 							FROM jpf_questions AS jq
// 							WHERE jq.level_type = 'general'
// 							AND NOT EXISTS (
// 								SELECT 1
// 								FROM jpf_user_answers AS ua
// 								WHERE ua.user_id = users.id
// 								AND ua.question_id = jq.id
// 								AND ua.is_active = TRUE
// 							)
// 						)
// 					END
// 					FROM jpf_questions AS jq
// 					WHERE jq.level_type = 'general'
// 				)`),
// 				'askJPFGeneral'
// 			]
// 		]
// 	},
// });

// Users.addScope('askJPFSpecific', {
// 	attributes: {
// 		include: [
// 			[
// 				Sequelize.literal(`(
// 					SELECT CASE
// 						WHEN users.journey_id IS NULL THEN true
// 						ELSE NOT EXISTS (
// 							SELECT 1
// 							FROM journeys AS j
// 							JOIN jpf_questions AS jq1 ON jq1.id = j.jpf_question1
// 							JOIN jpf_questions AS jq2 ON jq2.id = j.jpf_question2
// 							WHERE j.id = users.journey_id
// 							AND EXISTS (
// 								SELECT 1
// 								FROM jpf_user_answers AS ua1
// 								WHERE ua1.user_id = users.id
// 								AND ua1.question_id = jq1.id
// 								AND ua1.is_active = TRUE
// 							)
// 							AND EXISTS (
// 								SELECT 1
// 								FROM jpf_user_answers AS ua2
// 								WHERE ua2.user_id = users.id
// 								AND ua2.question_id = jq2.id
// 								AND ua2.is_active = TRUE
// 							)
// 						)
// 					END
// 				)`),
// 				'askJPFSpecific'
// 			]
// 		]
// 	}
// });

const ReviewUsers = require('./review_users');
const UserPurposes = require('./user_purposes');

Users.hasMany(ReviewUsers, {
	foreignKey: 'user_id',
	as: 'reviews',
});

Users.hasMany(ReviewUsers, {
	foreignKey: 'reviewer_id',
	as: 'givenReviews',
});

Users.hasMany(UserPurposes, { foreignKey: 'user_id' });