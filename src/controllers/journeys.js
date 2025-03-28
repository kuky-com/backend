const Users = require('@/models/users');
const UserPurposes = require('../models/user_purposes');
const UserInterests = require('../models/user_interests');
const Purposes = require('../models/purposes');
const Interests = require('../models/interests');
const Tags = require('../models/tags');
const { OpenAI } = require('openai');
const { Op, Sequelize } = require('sequelize');
const { getProfile } = require('./users');
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

async function getGeneralQuestion({ user_id }) {
    try {
        const questions = await JPFQuestions.findAll({
            where: {
                level_type: 'general',
            },
        });

        const formattedQuestions = []
        

        for(let i = 0; i < questions.length; i++) {
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

const submitAnswer = async ({answers, user_id}) => {
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

        return Promise.resolve({
            message: 'Answers submitted successfully!',
            data: results,
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
    getAllJourneys
};
