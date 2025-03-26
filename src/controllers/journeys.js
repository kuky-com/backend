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
const JPFUserAnswer = require('../models/jpf_user_answers');
const JPFAnswers = require('../models/jpf_answers');

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

async function getJourneys({ category_id }) {
	const journeys = await Journeys.findAll({
		where: {
			category_id
		}
	})

	return Promise.resolve({
		message: 'All journeys!',
		data: journeys,
	});
}

async function getGeneralQuestion({ user_id }) {
	const questions = await JPFQuestions.findAll({
		where: {
			level_type: 'general'
		},
	});

	const formattedQuestions = await Promise.all(
		questions.map(async (question) => {
			const answers = await JPFUserAnswer.findAll({
				where: {
					question_id: question.id,
					user_id,
				},
			});

			return {
				...question.toJSON(),
				selectedAnswer: answers?.[0]?.answer || null,
				allAnswers: answers || [],
			};
		})
	);

	return Promise.resolve({
		message: 'All general questions!',
		data: formattedQuestions,
	});
}

async function getJPFQuestions({ journey_id, user_id }) {
	const journey = await Journeys.findOne({
		where: {
			id: journey_id
		}
	});

	if (!journey) {
		return Promise.reject({
			message: 'Journey not found!',
		});
	}

	const question1 = await JPFQuestions.findOne({
		where: {
			id: journey.jpf_questions1
		},
		include: [
			{
				model: JPFUserAnswer,
				as: 'selected_answers',
				where: { user_id },
				required: false,
			},
            {
                model: JPFAnswers,
				as: 'answers',
            }
		],
	});

	const question2 = await JPFQuestions.findOne({
		where: {
			id: journey.jpf_questions2
		},
		include: [
			{
				model: JPFUserAnswer,
				as: 'selected_answers',
				where: { user_id },
				required: false,
			},
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
				selectedAnswer: question1.answers?.[0]?.answer || null,
			},
			{
				...question2.toJSON(),
				selectedAnswer: question2.answers?.[0]?.answer || null,
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
		return Promise.reject({
			message: 'Journey not found!',
		});
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

const submitAnswer = async ({ question_id, answer, user_id }) => {

	if (!user_id || !question_id || !answer) {
		return Promise.reject({
			message: 'Missing required fields',
		});
	}

	try {
		await JPFUserAnswer.destroy({
			where: {
				user_id,
				question_id,
			},
		});

		const userAnswer = await JPFUserAnswer.create({
            user_id,
            question_id,
            answer,
        });

		return Promise.resolve({
			message: 'Answer submitted successfully!',
			data: userAnswer,
		});
	} catch (error) {
		console.log('Error submitting answer:', error);
		return Promise.reject({
			message: 'Error submitting answer',
		});
	}
}

module.exports = {
	getCategories,
	getJourneys,
	getGeneralQuestion,
	getJPFQuestions,
	getVideoQuestion,
	submitAnswer
};
