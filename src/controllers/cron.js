const cron = require('node-cron');
const Matches = require('../models/matches');
const { Op } = require('sequelize');
const Users = require('../models/users');
const Messages = require('../models/messages');
const { addNewPushNotification } = require('./notifications');
const interestsController = require('./interests');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./matches');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

cron.schedule('0 * * * *', async () => {
    try {
        console.log('Task running every hours:', new Date().toLocaleString());

        const validMatches = await Matches.findAll({
            where: {
                status: 'accepted',
                last_message_date: {
                    [Op.lt]: new Date(new Date() - 24 * 60 * 60 * 1000),
                },
                bot_messages_count: {
                    [Op.lt]: 3,
                },
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

            if ((currentUserLikes.length > 0 || currentUserDislikes.length > 0) && (friendLikes.length > 0 || friendDislikes.length > 0)) {
                // try {
                //     const bot_message = await generateBotMessage(
                //         { likes: currentUserLikes, dislikes: currentUserDislikes },
                //         { likes: friendLikes, dislikes: friendDislikes }
                //     );

                //     if(bot_message.length > 0) {
                //         await botSendMessage({ conversation_id, last_message: bot_message });
                //     }
                // } catch (err) { }
            }


            // await botSendMessage({ conversation_id, last_message });
        }
    } catch (error) {
        console.log({ error })
    }
});

async function generateBotMessage(user1, user2) {
    try {
        const context = `Hey! I'm building an app that matches users based on common purposes, likes and dislikes. 

        When two users are matched, but for sometime they not star their conversation or not send any message for a day. We want to create
        a bot that will join the conversation and encourage users to talk based on their common likes and dislikes. The bot will need to talk
        based on likes and dislikes of the users base on any latest news or trends. The message need to be not too long, less than 80 characters, but enough to encourage
        the users to talk.


        I'll give you a list of two items to match with the following format:
        Type: type of match
        Item1: user 1 purpose
        Item2:  user2 2 purpose 

        The bot name is Kuky bot, but not return something like 'Kuky bot: "'.
        Just return the message content only. If cannot find a common subject, return empty string.
        `;

        const messages = [];

        for (let like of user1.likes) {
            for (let like2 of user2.likes) {
                messages.push(`
                 Tag: "like"
                 Item1 : ${like.name}
                 Item2: ${like2.name}
                 
                 ------
                 `);
            }
        }

        for (let dislike of user1.dislikes) {
            for (let dislike2 of user2.dislikes) {
                messages.push(`
                 Tag: "dislike"
                 Item1 : ${dislike.name}
                 Item2: ${dislike2.name}
                 
                 ------
                 `);
            }
        }

        if (messages.length === 0) {
            return ''
        }
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',

            messages: [
                { content: context, role: 'system' },
                { content: messages.join(), role: 'user' },
            ],
        });
        const result = response.choices[0].message.content.trim()

        return result
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
                // last_message_sender: 0,
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

        // await Messages.create({
        //     text: last_message,
        //     senderId: 0,
        //     matchId: existMatch.id,
        //     createdAt: last_message_date,
        // });

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