const cron = require('node-cron');
const Matches = require('../../models/matches');
const { Op } = require('sequelize');
const Users = require('../../models/users');
const Messages = require('../../models/messages');
const { addNewPushNotification } = require('../notifications');
const interestsController = require('../interests');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../users');
const { id } = require('date-fns/locale');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function botCron() {
    try {
        console.log('Task running every 10 minutes:', new Date().toLocaleString());

        const validMatches = await Matches.findAll({
            where: {
                status: 'accepted',
                id: {
                    [Op.in]: [3, 4, 5, 732]
                }
            },
            include: [
                { model: Users, as: 'sender' },
                { model: Users, as: 'receiver' },
            ],
        })

        for (let i = 0; i < validMatches.length; i++) {
            const match = validMatches[i];
            const { conversation_id, sender, receiver } = match;

            const currentUserLikes = (
                await interestsController.getLikes({ user_id: sender.id })
            ).data.map((d) => d.dataValues);
            const friendLikes = (
                await interestsController.getLikes({ user_id: receiver.id })
            ).data.map((d) => d.dataValues);

            const currentUserDislikes = (
                await interestsController.getDislikes({ user_id: sender.id })
            ).data.map((d) => d.dataValues);
            const friendDislikes = (
                await interestsController.getDislikes({ user_id: receiver.id })
            ).data.map((d) => d.dataValues);

            const currentUserPurposes = (
                await interestsController.getPurposes({ user_id: sender.id })
            ).data.map((d) => d.dataValues);
            const friendPurposes = (
                await interestsController.getPurposes({ user_id: receiver.id })
            ).data.map((d) => d.dataValues);

            if ((currentUserLikes.length > 0 || currentUserDislikes.length > 0) && (friendLikes.length > 0 || friendDislikes.length > 0)) {
                console.log({ conversation_id })
                try {
                    const bot_message = await generateBotMessage(
                        conversation_id,
                        { likes: currentUserLikes, dislikes: currentUserDislikes, purposes: currentUserPurposes },
                        { likes: friendLikes, dislikes: friendDislikes, purposes: friendPurposes }
                    );

                    console.log({ bot_message })

                    if (bot_message && bot_message.trim().length > 10) {
                        await botSendMessage({ conversation_id, last_message: bot_message });
                    }
                } catch (err) {
                    console.log({ err })
                }
            }
        }
    } catch (error) {
        console.log({ error })
    }
}

async function generateBotMessage(conversation_id, user1, user2) {
    try {
        const messageRef = await db
            .collection('conversations')
            .doc(conversation_id)
            .collection('messages')
            .orderBy("createdAt", "asc")
            .get()
        const messages = messageRef.docs.map(doc => doc.data());

        const botMessages = messages
            .filter(msg => msg.user && msg.user._id === 0 && (!msg.type || msg.type === 'text'))
            .map(msg => {
                const timestamp = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                return `Bot: ${msg.text} [${timestamp.toISOString()}]`;
            })
            .join('\n');

        const userMessages = messages
            .filter(msg => msg.user && msg.user._id !== 0 && (!msg.type || msg.type === 'text'))
            .map(msg => {
                const timestamp = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                return `User${msg.user._id}: ${msg.text} [${timestamp.toISOString()}]`;
            })
            .join('\n');

        const lastMessage = messages[messages.length - 1];
        const lastMessageTime = lastMessage?.createdAt?.toDate
            ? lastMessage.createdAt.toDate()
            : new Date(lastMessage?.createdAt || 0);

        const user1Likes = (user1.likes || []).map(item => item.name);
        const user2Likes = (user2.likes || []).map(item => item.name);
        const user1Dislikes = (user1.dislikes || []).map(item => item.name);
        const user2Dislikes = (user2.dislikes || []).map(item => item.name);
        const user1Purposes = (user1.purposes || []).map(item => item.name);
        const user2Purposes = (user2.purposes || []).map(item => item.name);

        const prompt = `
    You are an AI chatbot managing a conversation between two users and analyzing previous bot messages.

    ### User Details:
    - User 1 Likes: ${user1Likes.join(', ') || 'None'}
    - User 2 Likes: ${user2Likes.join(', ') || 'None'}
    - User 1 Dislikes: ${user1Dislikes.join(', ') || 'None'}
    - User 2 Dislikes: ${user2Dislikes.join(', ') || 'None'}
    - User 1 Purposes: ${user1Purposes.join(', ') || 'None'}
    - User 2 Purposes: ${user2Purposes.join(', ') || 'None'}

    ### Conversation History:
    ${userMessages}

    ### Previous Bot Messages:
    ${botMessages}

    ### Last Message Details:
    - Sent at: ${lastMessageTime.toISOString()}
    - Hours since last message: ${((new Date() - lastMessageTime) / (1000 * 60 * 60)).toFixed(2)}

    ### Instructions:
    1. Analyze the conversation history and previous bot messages.
    2. Decide if it's the right time to send a message may be after sometime if no message or if user ask bot for something.
    3. If it's **NOT** time, respond with an **EMPTY STRING** (\`""\`). No explanations, no reasoning, no context.
    4. If it **IS** time, respond with **only the chatbot's message content**.
    5. Ensure your response is strictly either an **empty string** or a **clean chatbot message** with no introductions, explanations, or metadata.
    6. If bot already have sent 5 messages in row but there is no response from users, stop sending messages.
    7. Dont send something like "Kuky bot: " in the message content.
    8. Dont send something like "It's time to send a message" in the message content, we need meaningful message.
    9. We may need to base on recent news or trends to encourage users to talk eg. if bot like football, it can talk about recent football match. Or if both purpose is loss weight, it can talk about recent weight loss trend or what activity they can do to loss weight.
    10. If users ask for something, bot should response to it.

    Ensure your response follows these rules.
    `;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
            });

            return response.choices[0]?.message?.content?.trim() || '';
        } catch (error) {
            console.log('Error generating AI message:', error.message);
            return '';
        }
    } catch (error) {
        console.log({ error })
        return ''
    }
}

async function botSendMessage({ conversation_id, last_message }) {
    try {
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
    botCron
}