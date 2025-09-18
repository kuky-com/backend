const { Op, Sequelize, fn, col, where } = require('sequelize');
const { subWeeks, subMonths, subYears, format } = require('date-fns');
const User = require('@models/users');
const Matches = require('../../models/matches');
const sendbird = require('../sendbird');
const Messages = require('../../models/messages');
const ProfileViews = require('../../models/profile_views');
const Journeys = require('../../models/journeys');
const Sessions = require('../../models/sessions');
const sequelize = require('../../config/database');
const Users = require('../../models/users');
const JourneyCategories = require('../../models/journey_categories');

function parseTimeline(timeline) {
	const now = new Date();

	switch (timeline.toLowerCase()) {
		case 'week':
			return subWeeks(now, 1);
		case 'month':
			return subMonths(now, 1);
		case 'year':
			return subYears(now, 1);
		case 'all':
			return null;
		default:
			throw new Error('Invalid timeline specified');
	}
}

function parseGranulairty(granularity) {
	switch (granularity.toLowerCase()) {
		case 'day':
			return 'yyyy-MM-dd';

		case 'week':
			return 'IYYY-IW';

		case 'month':
			return 'yyyy-MM';

		case 'year':
			return 'yyyy';

		default:
			throw new Error('Invalid granularity specified');
	}
}

/**
 * Generates a dynamic query to count users created based on granularity and timeline.
 *
 * @param {string} granularity - The granularity ('day', 'week', 'month', 'year').
 * @param {string} timeline - The timeline ('week', 'month', 'year', 'time').
 */
async function getUserGrowth(granularity, timeline) {
	const startDate = parseTimeline(timeline);
	const groupByFormat = parseGranulairty(granularity);

	// Build the query for grouped data
	const whereClause = startDate ? { createdAt: { [Op.gte]: startDate } } : {};

	const groupedUsers = await User.findAll({
		attributes: [
			[
				User.sequelize.fn(
					'to_char',
					User.sequelize.col('createdAt'),
					groupByFormat
				),
				'interval',
			],

			[
				User.sequelize.fn(
					'SUM',
					User.sequelize.literal(
						"CASE WHEN profile_approved = 'approved'::enum_users_profile_approved THEN 1 ELSE 0 END"
					)
				),
				'approvedUsersCount',
			],

			[User.sequelize.fn('COUNT', '*'), 'userCount'],
		],
		where: whereClause,
		group: ['interval'],
		order: [[User.sequelize.literal('interval'), 'ASC']],
	});

	const totalUsers = await User.count();

	const result = groupedUsers.map((user) => ({
		interval: user.get('interval'),
		year: user.get('year'),
		userCount: parseInt(user.get('userCount'), 10),
		approvedCount: parseInt(user.get('approvedUsersCount'), 10),
	}));

	const totalInInterval = result.reduce((sum, usr) => sum + usr.userCount, 0);

	for (let i = 1; i < result.length; i++) {
		const prev = result[i - 1];
		const current = result[i];
		current.growthPercent =
			((current.userCount - prev.userCount) / prev.userCount) * 100;
	}

	return { intervals: result, totalUsers, totalInInterval };
}

/**
 * Generates a dynamic query to count users matches based on timeline.
 *
 * @param {string} timeline - The timeline ('week', 'month', 'year', 'time').
 */
async function getMatches(timeline) {
	const startDate = parseTimeline(timeline);

	// Build the query for grouped data
	const whereClause = startDate ? { createdAt: { [Op.gte]: startDate } } : {};

	const groupedMatches = await Matches.findAll({
		attributes: [[User.sequelize.fn('COUNT', '*'), 'count'], 'status'],
		where: whereClause,
		group: ['status'],
	});

	const totalMatches = await Matches.count();
	const total = groupedMatches.reduce((sum, m) => sum + parseInt(m.get('count'), 10), 0);

	return {
		matches: groupedMatches.map((m) => ({
			count: parseInt(m.get('count')),
			status: m.get('status'),
		})),
		totalMatchesAllTime: totalMatches,
		total,
	};
}

/**
 * Generates a dynamic query to count messages created based on granularity and timeline.
 *
 * @param {string} granularity - The granularity ('day', 'week', 'month', 'year').
 * @param {string} timeline - The timeline ('week', 'month', 'year', 'time').
 */
async function getMessagesCount(granularity, timeline) {
	const startDate = parseTimeline(timeline);
	const groupByFormat = parseGranulairty(granularity);

	// Build the query for grouped data
	const whereClause = startDate ? { createdAt: { [Op.gte]: startDate } } : {};

	const groupedMessages = await Messages.findAll({
		attributes: [
			[
				Messages.sequelize.fn(
					'to_char',
					Messages.sequelize.col('createdAt'),
					groupByFormat
				),
				'interval',
			],

			[Messages.sequelize.fn('COUNT', '*'), 'total'],
		],
		where: whereClause,
		group: ['interval'],
		order: [[User.sequelize.literal('interval'), 'ASC']],
	});

	const totalMessages = await Messages.count();

	const result = groupedMessages.map((message) => ({
		interval: message.get('interval'),
		year: message.get('year'),
		total: parseInt(message.get('total'), 10),
	}));

	const totalInInterval = result.reduce((sum, m) => sum + m.total, 0);

	return { intervals: result, totalMessages, totalInInterval };
}

/**
 * Generates a dynamic query to count profile views based on granularity and timeline.
 *
 * @param {string} granularity - The granularity ('day', 'week', 'month', 'year').
 * @param {string} timeline - The timeline ('week', 'month', 'year', 'time').
 */
async function getProfileViewsCount(granularity, timeline) {
	const startDate = parseTimeline(timeline);
	const groupByFormat = parseGranulairty(granularity);

	// Build the query for grouped data
	const whereClause = startDate ? { createdAt: { [Op.gte]: startDate } } : {};

	const groupedViews = await ProfileViews.findAll({
		attributes: [
			[
				Messages.sequelize.fn(
					'to_char',
					Messages.sequelize.col('createdAt'),
					groupByFormat
				),
				'interval',
			],

			[Messages.sequelize.fn('COUNT', '*'), 'total'],
		],
		where: whereClause,
		group: ['interval'],
		order: [[ProfileViews.sequelize.literal('interval'), 'ASC']],
	});

	const totalViews = await ProfileViews.count();

	const result = groupedViews.map((v) => ({
		interval: v.get('interval'),
		year: v.get('year'),
		total: parseInt(v.get('total'), 10),
	}));

	const totalInInterval = result.reduce((sum, m) => sum + m.total, 0);

	return { intervals: result, totalViews, totalInInterval };
}

async function getCallsCount(timeline, next, acc = {}) {
	const lastDate = parseTimeline(timeline);

	let unixTimestamp = 0;

	if (lastDate) {
		unixTimestamp = lastDate.getTime();
	}

	const result = await sendbird.getDirectCalls(next, unixTimestamp);
	if (!acc['video']) {
		acc['video'] = { total: 0, totalDuration: 0 };
	}

	if (!acc['voice']) {
		acc['voice'] = { total: 0, totalDuration: 0 };
	}

	let new_acc = result.calls
		.filter((c) => c.started_by.startsWith(process.env.NODE_ENV))
		.filter((c) => c.started_at >= unixTimestamp)
		.reduce((a, call) => {
			a[call.is_video_call ? 'video' : 'voice'].total += 1;
			a[call.is_video_call ? 'video' : 'voice'].totalDuration += call.duration;

			if (!a[call.is_video_call ? 'video' : 'voice'][call.end_result]) {
				a[call.is_video_call ? 'video' : 'voice'][call.end_result] = {
					duration: call.duration,
					count: 1,
				};

				return a;
			}

			a[call.is_video_call ? 'video' : 'voice'][call.end_result].duration +=
				call.duration;
			a[call.is_video_call ? 'video' : 'voice'][call.end_result].count += 1;
			return a;
		}, acc);

	if (result.has_next) {
		return getCallsCount(timeline, result.next, new_acc);
	}

	return new_acc;
}

async function getCountJourneys() {
	try {
		const results = []

		const journeys = await Journeys.findAll({
			raw: true
		})

		journeys.forEach(async (journey) => {
			const count = await Users.count({
				where: {
					journey_id: journey.id
				}
			})
			results.push({ name: journey.name, id: journey.id, count: count })
		});

		const totalUsers = await Users.count({
			where: {
				journey_id: {
					[Op.ne]: null
				}
			}
		})

		return { journeys: results, total: totalUsers }
	} catch (error) {
		console.error('Error fetching user counts by journey:', error);
		return { journeys: [], total: 0 }
	}
}

async function getCountJourneyCategories() {
	try {
		const results = []

		const categories = await JourneyCategories.findAll({
			raw: true
		})

		categories.forEach(async (category) => {
			const count = await Users.count({
				where: {
					journey_category_id: category.id
				}
			})
			results.push({ name: category.name, id: category.id, count: count })
		});

		const totalUsers = await Users.count({
			where: {
				journey_category_id: {
					[Op.ne]: null
				}
			}
		})

		return { categories: results, total: totalUsers }
	} catch (error) {
		console.error('Error fetching user counts by journey:', error);
		return { categories: [], total: 0 }
	}
}

async function getProfileApprovalStats() {
	try {
		const stats = await Users.findAll({
			where: {
				is_active: true
			},
			attributes: [
				'profile_approved',
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
			],
			group: ['profile_approved'],
			raw: true
		});

		// Initialize counts for all possible statuses
		const result = []
		let total = 0

		const names = {
			approved: 'Approved',
			rejected: 'Rejected',
			pending: 'Pending',
			resubmitted: 'Resubmitted',
			partially_approved: 'Partially Approved'
		};

		// Update counts from database results
		stats.forEach(stat => {
			result.push({
				name: names[stat.profile_approved],
				count: parseInt(stat.count),
				id: stat.profile_approved
			})
			total += parseInt(stat.count);
		});

		return {stats: result, total}
	} catch (error) {
		console.error('Error fetching profile approval stats:', error);
		return {
			approved: 0,
			rejected: 0,
			pending: 0,
			resubmitted: 0,
			total: 0
		};
	}
}

async function getUsersByPlatformStats() {
	try {
		const stats = await Users.findAll({
			where: {
				is_active: true,
				register_platform: {
					[Op.ne]: null
				}
			},
			attributes: [
				'register_platform',
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
			],
			group: ['register_platform'],
			raw: true
		});

		const result = [];
		let total = 0;

		// Process the stats
		stats.forEach(stat => {
			result.push({
				name: stat.register_platform,
				count: parseInt(stat.count),
				id: stat.register_platform
			});
			total += parseInt(stat.count);
		});

		return { stats: result, total };
	} catch (error) {
		console.error('Error fetching users by platform stats:', error);
		return { stats: [], total: 0 };
	}
}

async function getUsersByLeadStats() {
	try {
		const stats = await Users.findAll({
			where: {
				is_active: true,
				lead: {
					[Op.ne]: null
				}
			},
			attributes: [
				'lead',
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
			],
			group: ['lead'],
			raw: true
		});

		const result = [];
		let total = 0;

		// Process the stats
		stats.forEach(stat => {
			result.push({
				name: stat.lead,
				count: parseInt(stat.count),
				id: stat.lead
			});
			total += parseInt(stat.count);
		});

		return { stats: result, total };
	} catch (error) {
		console.error('Error fetching users by lead stats:', error);
		return { stats: [], total: 0 };
	}
}

async function getUsersByCampaignStats() {
	try {
		const stats = await Users.findAll({
			where: {
				is_active: true,
				campaign: {
					[Op.ne]: null
				}
			},
			attributes: [
				'campaign',
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
			],
			group: ['campaign'],
			raw: true
		});

		const result = [];
		let total = 0;

		// Process the stats
		stats.forEach(stat => {
			result.push({
				name: stat.campaign,
				count: parseInt(stat.count),
				id: stat.campaign
			});
			total += parseInt(stat.count);
		});

		return { stats: result, total };
	} catch (error) {
		console.error('Error fetching users by campaign stats:', error);
		return { stats: [], total: 0 };
	}
}

async function getSubscriptionStats() {
	try {
		const stats = await Users.findAll({
			where: {
				is_active: true
			},
			attributes: [
				'subscription_status',
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
			],
			group: ['subscription_status'],
			raw: true
		});

		const result = [];
		let total = 0;

		// Define subscription status mappings and colors
		const statusMappings = {
			'active': { label: 'Paying Customer', color: '#4CAF50' },
			'trial': { label: 'Trial User', color: '#FF9800' },
			'expired': { label: 'Expired', color: '#F44336' },
			'canceled': { label: 'Canceled', color: '#9E9E9E' },
			'none': { label: 'Non-Paying Customer', color: '#2196F3' }
		};

		// Process the stats
		stats.forEach(stat => {
			const mapping = statusMappings[stat.subscription_status] || { 
				label: stat.subscription_status, 
				color: '#9E9E9E' 
			};
			
			result.push({
				status: stat.subscription_status,
				label: mapping.label,
				count: parseInt(stat.count),
				color: mapping.color
			});
			total += parseInt(stat.count);
		});

		// Sort by count descending
		result.sort((a, b) => b.count - a.count);

		return { stats: result, total };
	} catch (error) {
		console.error('Error fetching subscription stats:', error);
		return { stats: [], total: 0 };
	}
}

async function getStickinessStats(granularity = 'month', timeline = 'year') {
	try {
		const startDate = parseTimeline(timeline);
		const monthlyActiveUsers = await sequelize.query(`
			SELECT 
				to_char(date_trunc('month', COALESCE(last_active, login_date)), 'YYYY-MM') as month,
				COUNT(DISTINCT user_id) as mau
			FROM sessions
			WHERE COALESCE(last_active, login_date) IS NOT NULL
			${startDate ? `AND COALESCE(last_active, login_date) >= '${startDate.toISOString()}'` : ''}
			GROUP BY date_trunc('month', COALESCE(last_active, login_date))
			ORDER BY month
		`, { type: Sequelize.QueryTypes.SELECT });

		const dailyActiveUsers = await sequelize.query(`
			SELECT 
				to_char(daily_stats.month, 'YYYY-MM') as month,
				AVG(daily_stats.daily_users) as avg_dau
			FROM (
				SELECT 
					date_trunc('month', COALESCE(last_active, login_date)) as month,
					date_trunc('day', COALESCE(last_active, login_date)) as day,
					COUNT(DISTINCT user_id) as daily_users
				FROM sessions
				WHERE COALESCE(last_active, login_date) IS NOT NULL
				${startDate ? `AND COALESCE(last_active, login_date) >= '${startDate.toISOString()}'` : ''}
				GROUP BY date_trunc('month', COALESCE(last_active, login_date)), date_trunc('day', COALESCE(last_active, login_date))
			) daily_stats
			GROUP BY daily_stats.month
			ORDER BY month
		`, { type: Sequelize.QueryTypes.SELECT });

		const stickinessData = monthlyActiveUsers.map(mauData => {
			const dauData = dailyActiveUsers.find(d => d.month === mauData.month);
			const mau = parseInt(mauData.mau);
			const avgDau = dauData ? parseFloat(dauData.avg_dau) : 0;
			const stickinessScore = mau > 0 ? (avgDau / mau) * 100 : 0;

			return {
				month: mauData.month,
				mau,
				avgDau: Math.round(avgDau),
				stickinessScore: Math.round(stickinessScore * 10) / 10 // Round to 1 decimal place
			};
		});

		const totalMAU = stickinessData.reduce((sum, data) => sum + data.mau, 0);
		const totalAvgDAU = stickinessData.reduce((sum, data) => sum + data.avgDau, 0);
		const avgStickinessScore = stickinessData.length > 0 
			? stickinessData.reduce((sum, data) => sum + data.stickinessScore, 0) / stickinessData.length
			: 0;

		const sessionMetrics = await sequelize.query(`
			SELECT 
				COUNT(DISTINCT user_id) as total_active_users,
				COUNT(*) as total_sessions,
				AVG(EXTRACT(EPOCH FROM (logout_date - login_date))/60) as avg_session_duration_minutes,
				COUNT(CASE WHEN logout_date IS NULL THEN 1 END) as active_sessions
			FROM sessions
			WHERE login_date IS NOT NULL
			${startDate ? `AND login_date >= '${startDate.toISOString()}'` : ''}
		`, { type: Sequelize.QueryTypes.SELECT });

		const metrics = sessionMetrics[0];

		return {
			intervals: stickinessData,
			summary: {
				avgMAU: Math.round(totalMAU / (stickinessData.length || 1)),
				avgDAU: Math.round(totalAvgDAU / (stickinessData.length || 1)),
				avgStickinessScore: Math.round(avgStickinessScore * 10) / 10,
				totalActiveUsers: parseInt(metrics.total_active_users || 0),
				totalSessions: parseInt(metrics.total_sessions || 0),
				avgSessionDuration: Math.round(parseFloat(metrics.avg_session_duration_minutes || 0) * 10) / 10,
				activeSessions: parseInt(metrics.active_sessions || 0)
			},
		};
	} catch (error) {
		console.error('Error fetching stickiness stats:', error);
		
		return { 
			intervals: [],
			summary: { 
				avgMAU: 0, 
				avgDAU: 0, 
				avgStickinessScore: 0,
				totalActiveUsers: 0,
				totalSessions: 0,
				avgSessionDuration: 0,
				activeSessions: 0
			},
			error: `Unable to calculate stickiness from sessions: ${error.message}. Showing empty data.`,
			note: 'Stickiness calculation failed. Showing empty data.'
		};
	}
}

module.exports = {
	getUserGrowth,
	getMatches,
	getMessagesCount,
	getCallsCount,
	getProfileViewsCount,
	getCountJourneys,
	getCountJourneyCategories,
	getProfileApprovalStats,
	getUsersByPlatformStats,
	getUsersByLeadStats,
	getUsersByCampaignStats,
	getSubscriptionStats,
	getStickinessStats
};
