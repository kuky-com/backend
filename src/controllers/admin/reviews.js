const ReviewUsers = require('@/models/review_users');
const Users = require('@/models/users');
const { Op, Sequelize, where } = require('sequelize');

async function getReviews({ page = 1, limit = 20, query = '', status = '' }) {
	const isNumericQuery = !isNaN(query) && query !== '';
	const offset = (page - 1) * limit;

	const relevanceScore = Sequelize.literal(`
          CASE
            WHEN "review_users"."user_id" = ${isNumericQuery ? query : -1} THEN 60
            WHEN "review_users"."reviewer_id" = ${isNumericQuery ? query : -1} THEN 60
            WHEN "review_users"."note" LIKE '%${query}%' THEN 4

            WHEN "user"."email" LIKE '%${query}%' THEN 2
            WHEN "reviewer"."email" LIKE '%${query}%' THEN 2
            WHEN "user"."full_name" LIKE '%${query}%' THEN 1
            WHEN "reviewer"."full_name" LIKE '%${query}%' THEN 1
            ELSE 0
          END
        `);

	if (status === '') {
		return {
			count: 0,
			rows: [],
		};
	}

	const { rows, count } = await ReviewUsers.findAndCountAll({
		limit,
		offset,
		include: [
			{
				model: Users,
				as: 'reviewer',
				attributes: ['id', 'full_name', 'email', 'avatar'],
			},
			{
				model: Users,
				as: 'user',
				attributes: ['id', 'full_name', 'email', 'avatar'],
			},
		],
		where: {
			status: status.split(','),
			[Op.or]: [
				{
					user_id: {
						[Op.eq]: isNumericQuery ? query : -1,
					},
				},
				{
					reviewer_id: {
						[Op.eq]: isNumericQuery ? query : -1,
					},
				},
				{
					note: {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$user.full_name$': {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$reviewer.full_name$': {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$user.email$': {
						[Op.like]: `%${query}%`,
					},
				},
				{
					'$reviewer.email$': {
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

async function updateReviewStatus(reviewId, status) {
	return ReviewUsers.update(
		{
			status,
		},
		{
			where: {
				id: reviewId,
			},
		}
	);
}

module.exports = {
	getReviews,
	updateReviewStatus,
};
