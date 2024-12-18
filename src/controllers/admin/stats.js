const { Op } = require('sequelize');
const { subWeeks, subMonths, subYears, format } = require('date-fns');
const User = require('@models/users');
const Matches = require('../../models/matches');
const sendbird = require('../sendbird');
const Messages = require('../../models/messages');

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
 * Generates a dynamic query to count users created based on granularity and timeline.
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

async function getCallsCount(next, acc = {}) {
	const result = await sendbird.getDirectCalls(next);
	if (!acc['video']) {
		acc['video'] = { total: 0, totalDuration: 0 };
	}

	if (!acc['voice']) {
		acc['voice'] = { total: 0, totalDuration: 0 };
	}

	let new_acc = result.calls
		.filter((c) => c.started_by.startsWith(process.env.NODE_ENV))
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
		return getCallsCount(result.next, new_acc);
	}

	return new_acc;
}

module.exports = {
	getUserGrowth,
	getMatches,
	getMessagesCount,
	getCallsCount,
};
