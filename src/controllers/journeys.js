const Users = require('@/models/users');
const UserPurposes = require('../models/user_purposes');
const UserInterests = require('../models/user_interests');
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const Tags = require('../models/tags');
const { OpenAI } = require('openai');
const { Op, Sequelize } = require('sequelize');
const { getProfile, getUser } = require('./users');
const { categoryMap } = require('../config/categories');
const {
    updateOnesignalUserTags,
    addBatchNotifications,
    getProfileTagFilter,
} = require('./onesignal');
const sequelize = require('../config/database');
const JourneyCategories = require('../models/journey_categories');
const Journeys = require('../models/journeys');
const JPFQuestions = require('../models/jpf_questions');
const JPFAnswers = require('../models/jpf_answers');
const JPFUserAnswer = require('../models/jpf_user_answers');
const { is } = require('date-fns/locale');
const BlockedUsers = require('../models/blocked_users');
const Matches = require('../models/matches');
const { findUnique } = require('../utils/utils');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function getCategories() {
    const categories = await JourneyCategories.findAll();

    return Promise.resolve({
        message: 'All journey categories!',
        data: categories,
    });
}

async function getJourneys({ category }) {
    const journeys = await Journeys.findAll({
        where: {
            category
        }
    })

    return Promise.resolve({
        message: 'All journeys!',
        data: journeys,
    });
}

async function getAllJourneys() {
    const journeys = await Journeys.findAll()

    return Promise.resolve({
        message: 'All journeys!',
        data: journeys,
    });
}

async function getActiveJourneys({ user_id }) {
    try {
        let extraQuery = ''
        
        if(user_id) {
            const blockedUsers = await BlockedUsers.findAll({
				where: {
					[Op.or]: [{ user_id: user_id }, { blocked_id: user_id }],
				},
				raw: true,
			});

			const matchedUsers = await Matches.findAll({
				where: {
					[Op.or]: [
						{
							[Op.or]: [
								{ sender_id: user_id, status: 'rejected' },
								{ sender_id: user_id, status: 'accepted' },
								{ sender_id: user_id, status: 'deleted' },
								{ receiver_id: user_id, status: 'rejected' },
								{ receiver_id: user_id, status: 'accepted' },
								{ receiver_id: user_id, status: 'deleted' },
							],
						},
						{ receiver_id: user_id, status: 'sent' },
					],
				},
				raw: true,
			});

			const blockedUserIds = blockedUsers.map((item) =>
				item.user_id === user_id ? item.blocked_id : item.user_id
			);
			const matchedUserIds = matchedUsers.map((item) =>
				item.sender_id === user_id ? item.receiver_id : item.sender_id
			);

			const avoidUserIds = findUnique(blockedUserIds, matchedUserIds);
            avoidUserIds.push(user_id)

            extraQuery = `and u.id not in (${avoidUserIds.join(', ')})`
        }

        console.log({extraQuery})
        
        const query = `
            SELECT 
                p.*,
                COUNT(u.id) AS usage_count
            FROM 
                journeys p
            JOIN 
                users u ON p.id = u.journey_id
            WHERE 
                u.profile_approved = 'approved' and is_active = TRUE and is_hidden_users = FALSE ${extraQuery}
            GROUP BY 
                p.id
            HAVING 
                COUNT(u.id) >= 1
            ORDER BY 
                usage_count DESC;
        `;

        const results = await sequelize.query(query, {
            type: Sequelize.QueryTypes.SELECT,
        });

        return Promise.resolve({
            message: 'Active journeys retrieved successfully!',
            data: results,
        });
    } catch (error) {
        console.log('Error retrieving active journeys:', error);
        return Promise.reject(error);
    }
}

async function getGeneralQuestion({ user_id }) {
    try {
        const questions = await JPFQuestions.findAll({
            where: {
                level_type: 'general',
            },
        });

        const formattedQuestions = []


        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const selectedAnswer = await JPFUserAnswer.findOne({
                where: {
                    user_id: user_id,
                    question_id: question.id,
                    is_active: true,
                },
            });

            const answers = await JPFAnswers.findAll({
                where: {
                    question: question.id,
                },
                raw: true
            });

            formattedQuestions.push({
                ...question.toJSON(),
                selectedAnswer: selectedAnswer ? selectedAnswer.answer : null,
                answers: answers || [],
            });
        }

        return Promise.resolve({
            message: 'All general questions!',
            data: formattedQuestions,
        });
    } catch (error) {
        console.error('Error fetching general questions:', error);
        return Promise.reject('Error fetching general questions');
    }
}

async function getJPFQuestions({ journey_id, user_id }) {
    const journey = await Journeys.findOne({
        where: {
            id: journey_id
        }
    });

    if (!journey) {
        return Promise.reject('Journey not found!');
    }

    const question1 = await JPFQuestions.findOne({
        where: {
            id: journey.jpf_question1
        },
        include: [
            {
                model: JPFAnswers,
                as: 'answers',
            }
        ],
    });

    const question2 = await JPFQuestions.findOne({
        where: {
            id: journey.jpf_question2
        },
        include: [
            {
                model: JPFAnswers,
                as: 'answers',
            }
        ],
    });

    return Promise.resolve({
        message: 'All journeys!',
        data: [
            {
                ...question1.toJSON(),
            },
            {
                ...question2.toJSON(),
            },
        ],
    });
}

async function getVideoQuestion({ journey_id }) {
    const journey = await Journeys.findOne({
        where: {
            id: journey_id
        }
    })

    if (!journey) {
        return Promise.reject('Journey not found!');
    }

    const question = await JPFQuestions.findOne({
        where: {
            id: journey.jpf_video_question
        }
    })

    return Promise.resolve({
        message: 'Video question!',
        data: question,
    });
}

const submitAnswer = async ({ answers, user_id }) => {
    if (!Array.isArray(answers) || answers.length === 0) {
        return Promise.reject('Answers must be a non-empty array');
    }

    try {
        const results = [];

        for (const { question_id, answer_id, answer_text } of answers) {
            if (!user_id || !question_id || (!answer_id && !answer_text)) {
                return Promise.reject('Missing required fields in one or more answers');
            }

            await JPFUserAnswer.update(
                {
                    is_active: false,
                },
                {
                    where: {
                        user_id,
                        question_id,
                    },
                }
            );

            const userAnswer = await JPFUserAnswer.create({
                user_id,
                question_id,
                answer_id,
                answer_text,
            });

            results.push(userAnswer);
        }

        const userInfo = await getUser(user_id);

        return Promise.resolve({
            data: userInfo,
            message: 'Update successfully',
        });
    } catch (error) {
        console.log('Error submitting answers:', error);
        return Promise.reject('Error submitting answers');
    }
};

module.exports = {
    getCategories,
    getJourneys,
    getGeneralQuestion,
    getJPFQuestions,
    getVideoQuestion,
    submitAnswer,
    getAllJourneys,
    getActiveJourneys
};
