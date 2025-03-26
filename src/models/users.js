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
	profile_approved: {
		type: DataTypes.ENUM('pending', 'rejected', 'approved', 'resubmitted'),
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