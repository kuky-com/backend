const Users = require('@/models/users');
const Matches = require('@/models/matches');
const { Op } = require('sequelize');
const { addNewNotification, addNewPushNotification } = require('../notifications');
const { db } = require('../common');
const { sendEmail } = require('../email');

/**
 * Main cron job function to check for unread messages and notify users
 */
async function checkUnreadMessages() {
    try {
        console.log('Starting unread message cron job...');

        // Get all active users
        const users = await getAllActiveUsers();
        console.log(`Checking unread messages for ${users.length} users`);

        let totalNotificationsSent = 0;

        // Process each user
        for (const user of users) {
            try {
                const result = await processUserUnreadMessages(user);
                totalNotificationsSent += result.notificationsSent;

                if (result.friendsWithUnreadMessages.length > 0) {
                    console.log(`User ${user.id} has unread messages from: ${result.friendsWithUnreadMessages.join(', ')}`);
                }
            } catch (userError) {
                console.log(`Error processing user ${user.id}:`, userError);
            }
        }

        console.log(`Unread message check completed. Sent ${totalNotificationsSent} notifications.`);

        return Promise.resolve({
            message: 'Unread message check completed successfully',
            data: {
                usersProcessed: users.length,
                totalNotificationsSent
            }
        });

    } catch (error) {
        console.log('Error in unread message cron job:', error);
        return Promise.reject(error);
    }
}

/**
 * Get all active users from the database
 */
async function getAllActiveUsers() {
    return await Users.findAll({
        where: {
            is_active: true,
            is_hidden_users: false,
            profile_approved: {
                [Op.in]: ['approved', 'partially_approved']
            },
            is_moderators: true
        },
        attributes: ['id', 'full_name', 'email']
    });
}

/**
 * Process unread messages for a specific user
 */
async function processUserUnreadMessages(user) {
    // Get all current matches for this user
    const userMatches = await getUserMatches(user.id);

    if (userMatches.length === 0) {
        return { notificationsSent: 0, friendsWithUnreadMessages: [] };
    }

    const friendsWithUnreadMessages = [];
    let conversation = null;

    // Check each match for unread messages
    for (const match of userMatches) {
        if (!match.conversation_id) continue;

        try {
            const unreadCount = await getUnreadMessageCount(match.conversation_id, user.id);

            if (unreadCount > 0) {
                // Get the other user (friend) info
                const friend = match.sender_id === user.id
                    ? match.receiver
                    : match.sender;

                friendsWithUnreadMessages.push(friend.full_name);
                if (conversation === null)
                    conversation = match // Store conversation ID for email

                // Mark conversation as having unread messages
                await markConversationAsUnread(match);
            }
        } catch (error) {
            console.log(`Error checking conversation ${match.conversation_id}:`, error);
        }
    }

    // Send notifications if there are friends with unread messages
    let notificationsSent = 0;
    if (friendsWithUnreadMessages.length > 0) {
        await sendUnreadNotifications(user, friendsWithUnreadMessages, conversation);
        notificationsSent = 1;
    }

    return { notificationsSent, friendsWithUnreadMessages };
}

/**
 * Get all accepted matches for a user
 */
async function getUserMatches(userId) {
    return await Matches.findAll({
        where: {
            [Op.or]: [
                { sender_id: userId, status: 'accepted' },
                { receiver_id: userId, status: 'accepted' }
            ],
            conversation_id: {
                [Op.ne]: null
            }
        },
        include: [
            {
                model: Users,
                as: 'sender',
                attributes: ['id', 'full_name', 'email'],
                where: { is_active: true }
            },
            {
                model: Users,
                as: 'receiver',
                attributes: ['id', 'full_name', 'email'],
                where: { is_active: true }
            }
        ],
        order: [['last_message_date', 'DESC']]
    });
}

/**
 * Get unread message count for a conversation (based on your client code pattern)
 */
async function getUnreadMessageCount(conversationId, userId) {
    try {
        // Get messages from Firestore conversation
        const messagesSnapshot = await db
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('createdAt', 'desc')
            .get();

        if (messagesSnapshot.empty) {
            return 0;
        }

        // Count total messages minus messages read by this user
        // This matches your client-side logic
        const totalMessages = messagesSnapshot.docs.length;
        const readMessages = messagesSnapshot.docs.filter(doc => {
            const messageData = doc.data();
            const readBy = messageData.readBy || [];
            return readBy.includes(userId);
        }).length;

        const unreadCount = totalMessages - readMessages;
        return Math.max(0, unreadCount); // Ensure non-negative

    } catch (error) {
        console.log(`Error getting unread count for conversation ${conversationId}:`, error);
        return 0;
    }
}

/**
 * Mark conversation as having unread messages (you can extend this if needed)
 */
async function markConversationAsUnread(match) {
    try {
        // Update the match record to indicate there are unread messages
        // This could be used for additional tracking if needed
        await Matches.update(
            {
                // You could add an unread_count field here if you want to track it in the database
                last_message_date: new Date() // Update timestamp
            },
            {
                where: { id: match.id }
            }
        );
    } catch (error) {
        console.log(`Error marking conversation as unread:`, error);
    }
}

/**
 * Send email and push notifications about friends waiting for replies
 */
async function sendUnreadNotifications(user, friendsWithUnreadMessages, conversation) {
    try {
        const friendNames = friendsWithUnreadMessages.join(', ');
        const friendCount = friendsWithUnreadMessages.length;

        // Create notification content
        let notificationTitle, notificationContent, emailSubject;

        if (friendCount === 1) {
            notificationTitle = 'Unread messages';
            notificationContent = `${friendNames} is waiting for your reply!`;
            emailSubject = `${friendNames} is waiting for your reply on Kuky`;
        } else {
            const displayNames = friendCount > 2
                ? `${friendsWithUnreadMessages.slice(0, 2).join(', ')}, and others`
                : friendNames;

            notificationTitle = 'Unread messages';
            notificationContent = `${displayNames} are waiting for your reply!`;
            emailSubject = `You have ${friendCount} friends waiting for your reply on Kuky`;
        }

        try {
            // Send in-app notification
            await addNewNotification(
                user.id,
                null, // sender_id (null for system notification)
                conversation.id, // match_id
                null, // suggest_id
                'message',
                notificationTitle,
                notificationContent
            );
        } catch (error) {

        }

        try {
            // Send push notification
            await addNewPushNotification(
                user.id,
                conversation, // match
                null, // suggest
                'message',
                notificationTitle,
                notificationContent
            );

        } catch (error) {

        }
        // Send email notification
        await sendUnreadMessageEmail(user, friendNames, friendCount, emailSubject, conversation.conversation_id);

        console.log(`Sent unread message notifications to user ${user.id}`);

    } catch (error) {
        console.log(`Error sending notifications to user ${user.id}:`, error);
    }
}

/**
 * Send email notification about unread messages
 */
async function sendUnreadMessageEmail(user, friendNames, friendCount, subject, conversation_id) {
    try {
        const templateData = {
            user_name: user.full_name,
            friend_names: friendNames,
            friend_count: friendCount,
            is_single_friend: friendCount === 1,
            message: friendCount === 1
                ? `${friendNames} sent you a message and is waiting for your reply.`
                : `${friendNames} sent you messages and are waiting for your reply.`,
            conversation_id: conversation_id
        };

        console.log({ email: user.email, subject, templateData });
        // Use existing email service with unread_message template
        await sendEmail(user.email, subject, 'unread_message', templateData);

    } catch (error) {
        console.log(`Error sending email to ${user.email}:`, error);
        // Don't throw error to continue with other notifications
    }
}

/**
 * Test function to check unread messages for a specific user
 */
async function checkUnreadMessagesForUser(userId) {
    try {
        const user = await Users.findByPk(userId, {
            attributes: ['id', 'full_name', 'email']
        });

        if (!user) {
            return Promise.reject('User not found');
        }

        const result = await processUserUnreadMessages(user);

        return Promise.resolve({
            message: `Processed unread messages for user ${userId}`,
            data: {
                userId,
                friendsWithUnreadMessages: result.friendsWithUnreadMessages,
                notificationsSent: result.notificationsSent
            }
        });

    } catch (error) {
        console.log(`Error checking unread messages for user ${userId}:`, error);
        return Promise.reject(error);
    }
}

module.exports = {
    checkUnreadMessages,
    checkUnreadMessagesForUser
};