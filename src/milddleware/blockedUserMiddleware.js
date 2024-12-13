/** This function retuns a middleware that is used for requests that access a user resource
 * by another user. The other user must have the id in the path as :userId
 *
 * This needs to be used after authMiddleware.
 *
 *  If it's used with `withError` = true then it throws an error if current user is blocked
 *
 * Otherwise, it adds blocked: true or blocked: false to the request and the errors must be handled in the actual routes
 */

const BlockedUsers = require('../models/blocked_users');
const { Op } = require('sequelize');

function blockedUserMiddleware(withError = false) {
	return (req, res, next) => {
		const currentUserId = req?.user_id;
		const otherUser = req?.params?.userId;

		if (!currentUserId || !otherUser) {
			return res.status(500).json({
				message: "Server error. Middleware wasn't applied correctly",
			});
		}

		const blocked = BlockedUsers.findOne({
			where: {
				[Op.or]: [
					{
						user_id: currentUserId,
						blocked_id: otherUser,
					},
					{
						user_id: otherUser,
						blocked_id: currentUserId,
					},
				],
			},
		});

		if (withError) {
			if (blocked && blocked.id) {
				return res
					.status(409)
					.json({ message: 'Blocked by user' });
			}

			next();
		} else {
			res.blocked = !!(blocked && blocked.id);
		}
	};
}
module.exports = { blockedUserMiddleware };
