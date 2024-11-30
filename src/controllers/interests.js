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

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

async function getPurposes({ user_id }) {
	try {
		const purposes = await UserPurposes.findAll({
			where: {
				user_id: user_id,
			},
			attributes: {
				include: [[Sequelize.col('purpose.name'), 'name']],
			},
			include: [
				{
					model: Purposes,
					attributes: [['name', 'name']],
					where: {
						normalized_purpose_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message: 'Success',
			data: purposes,
		});
	} catch (error) {
		console.log('Error user purposes:', error);
		return Promise.reject(error);
	}
}

async function getAllInterests({ user_id }) {
	try {
		const interests = await UserInterests.findAll({
			where: {
				user_id: user_id,
			},
			attributes: {
				include: [[Sequelize.col('interest.name'), 'name']],
			},
			include: [
				{
					model: Interests,
					attributes: [['name', 'name']],
					where: {
						normalized_interest_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message: 'Success',
			data: interests,
		});
	} catch (error) {
		console.log('Error user interests:', error);
		return Promise.reject(error);
	}
}

async function getLikes({ user_id }) {
	try {
		const likes = await UserInterests.findAll({
			where: {
				user_id: user_id,
				interest_type: 'like',
			},
			attributes: {
				include: [[Sequelize.col('interest.name'), 'name']],
			},
			include: [
				{
					model: Interests,
					attributes: [['name', 'name']],
					where: {
						normalized_interest_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message: 'Success',
			data: likes,
		});
	} catch (error) {
		console.log('Error user likes:', error);
		return Promise.reject(error);
	}
}

async function getDislikes({ user_id }) {
	try {
		const likes = await UserInterests.findAll({
			where: {
				user_id: user_id,
				interest_type: 'dislike',
			},
			attributes: {
				include: [[Sequelize.col('interest.name'), 'name']],
			},
			include: [
				{
					model: Interests,
					attributes: [['name', 'name']],
					where: {
						normalized_interest_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message: 'Success',
			data: likes,
		});
	} catch (error) {
		console.log('Error user dislikes:', error);
		return Promise.reject(error);
	}
}

const getUserInterests = async (user_id) => {
	const userInterests = await UserInterests.findAll({
		where: { user_id },
		include: [
			{
				model: Interests,
				attributes: [['name', 'name']],
				where: {
					normalized_interest_id: {
						[Op.ne]: null,
					},
				},
			},
		],
	});

	return userInterests.map((ui) => ({
		interest: ui.interest.name,
		type: ui.interest_type,
	}));
};

async function updatePurposes({ user_id, purposes }) {
	try {
		const currentUserPurposes = await UserPurposes.findAll({
			where: { user_id },
			include: [{ model: Purposes }],
		});

		const currentPurposeIds = currentUserPurposes.map((up) => up.purpose_id);

		const purposeRecords = await Promise.all(
			purposes.map(async (name) => createGeneralPurpose(name))
		);

		const newPurposeIds = purposeRecords.filter((p) => p !== null).map((p) => p.id);

		await UserPurposes.destroy({
			where: {
				user_id,
				purpose_id: { [Op.notIn]: newPurposeIds },
			},
		});

		await Promise.all(
			newPurposeIds.map(async (purpose_id) => {
				if (!currentPurposeIds.includes(purpose_id)) {
					try {
						await UserPurposes.create({ user_id, purpose_id });
					} catch (error) {}
				}
			})
		);

		const newUserPurposes = await UserPurposes.findAll({
			where: { user_id },
			include: [
				{
					model: Purposes,
					where: {
						normalized_purpose_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message:
				newUserPurposes.length < purposes.length
					? `Oops! That doesn't look like an English word. Please try again.`
					: 'User purposes updated successfully.',
			data: newUserPurposes,
		});
	} catch (error) {
		console.log('Error user update purposes:', error);
		return Promise.reject(error);
	}
}

async function createGeneralInterest(name) {
	if (name && name.length > 1) {
		let interest = await Interests.findOne({
			where: { name: name },
		});
		if (interest) {
			return interest;
		}
		interest = await Interests.create({
			name: name,
		});
		await normalizeInterests(interest.id);
		return interest;
	} else {
		return null;
	}
}

async function updateLikes({ user_id, likes }) {
	try {
		const currentUserLikes = await UserInterests.findAll({
			where: { user_id, interest_type: 'like' },
			include: [{ model: Interests }],
		});

		const currentLikesIds = currentUserLikes.map((up) => up.interest_id);

		const interestRecords = await Promise.all(
			likes.map(async (name) => createGeneralInterest(name))
		);

		const newInterestIds = interestRecords.filter((p) => p !== null).map((p) => p.id);

		await UserInterests.destroy({
			where: {
				user_id,
				interest_type: 'like',
				interest_id: { [Op.notIn]: newInterestIds },
			},
		});

		await Promise.all(
			newInterestIds.map(async (interest_id) => {
				if (!currentLikesIds.includes(interest_id)) {
					try {
						await UserInterests.create({
							user_id,
							interest_type: 'like',
							interest_id,
						});
					} catch (error) {}
				}
			})
		);

		const newUserLikes = await UserInterests.findAll({
			where: { user_id, interest_type: 'like' },
			include: [
				{
					model: Interests,
					where: {
						normalized_interest_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message:
				newUserLikes.length < likes.length
					? `Oops! That doesn't look like an English word. Please try again.`
					: 'User likes updated successfully.',
			data: newUserLikes,
		});
	} catch (error) {
		console.log('Error user update likes:', error);
		return Promise.reject(error);
	}
}

async function updateDislikes({ user_id, dislikes }) {
	try {
		const currentUserDislikes = await UserInterests.findAll({
			where: { user_id, interest_type: 'dislike' },
			include: [{ model: Interests }],
		});

		const currentDislikesIds = currentUserDislikes.map((up) => up.interest_id);

		const interestRecords = await Promise.all(
			dislikes.map(async (name) => {
				if (name && name.length > 1) {
					let interest = await Interests.findOne({
						where: { name: name },
					});
					if (interest) {
						return interest;
					}
					interest = await Interests.create({
						name: name,
					});
					await normalizeInterests(interest.id);
					return interest;
				} else {
					return null;
				}
			})
		);

		const newInterestIds = interestRecords.filter((p) => p !== null).map((p) => p.id);

		await UserInterests.destroy({
			where: {
				user_id,
				interest_type: 'dislike',
				interest_id: { [Op.notIn]: newInterestIds },
			},
		});

		await Promise.all(
			newInterestIds.map(async (interest_id) => {
				if (!currentDislikesIds.includes(interest_id)) {
					try {
						await UserInterests.create({
							user_id,
							interest_type: 'dislike',
							interest_id,
						});
					} catch (error) {}
				}
			})
		);

		const newUserDislikes = await UserInterests.findAll({
			where: { user_id, interest_type: 'dislike' },
			include: [
				{
					model: Interests,
					where: {
						normalized_interest_id: {
							[Op.ne]: null,
						},
					},
				},
			],
		});

		return Promise.resolve({
			message:
				newUserDislikes.length < dislikes.length
					? `Oops! That doesn't look like an English word. Please try again.`
					: 'User dislikes updated successfully.',
			data: newUserDislikes,
		});
	} catch (error) {
		console.log('Error user update dislikes:', error);
		return Promise.reject(error);
	}
}

const getTagIdsByName = async (tagNames) => {
	const tags = await Tags.findAll({
		where: {
			name: tagNames,
		},
	});

	return tags.map((tag) => ({ name: tag.name, id: tag.id }));
};

async function updateProfileTag({ user_id }) {
	try {
		const interests = await getUserInterests(user_id);

		let likes = [];
		let dislikes = [];

		interests.forEach((userInterest) => {
			if (userInterest.type === 'like') {
				likes.push(userInterest.interest);
			} else if (userInterest.type === 'dislike') {
				dislikes.push(userInterest.interest);
			}
		});

		const tags = await Tags.findAll({
			attributes: ['id', 'name'],
			raw: true,
		});
		const tagNames = tags.map((tag) => tag.name);

		const prompt = `Based on the following user interests, categorize this user into the most suitable category based on the provided tags:
        
        Likes: ${likes.join(', ')}
        Dislikes: ${dislikes.join(', ')}
        
        Tags: ${tagNames.join(', ')}
        
        Provide a category for the user based on these tags.  Just show category name no other words.`;
		const response = await openai.completions.create({
			model: 'gpt-3.5-turbo-instruct',
			prompt,
			max_tokens: 150,
		});
		const bestTagName = response.choices[0].text.trim();
		const bestTag = tags.find(
			(tag) => tag.name.toLowerCase() === bestTagName.toLowerCase()
		);

		const updatedUser = await Users.update(
			{ profile_tag: bestTag.id },
			{
				where: { id: user_id },
			}
		);

		const userInfo = await getProfile({ user_id });

		return Promise.resolve({
			message: 'User profile tag has been updated!',
			data: userInfo.data,
		});
	} catch (error) {
		console.log('Error user update dislikes:', error);
		const updatedUser = await Users.update(
			{ profile_tag: 1 },
			{
				where: { id: user_id },
			}
		);

		const userInfo = await getProfile({ user_id });

		return Promise.resolve({
			message: 'User profile tag has been updated!',
			data: userInfo.data,
		});
	}
}

async function normalizePurposes(purposeId) {
	try {
		let purposes = [];

		if (purposeId) {
			purposes = await Purposes.findAll({
				where: {
					id: purposeId,
				},
				attributes: ['name', 'id'],
				order: [['id', 'asc']],
			});
		} else {
			purposes = await Purposes.findAll({
				attributes: ['name', 'id'],
				order: [['id', 'asc']],
			});
		}

		const categoryNames = Object.keys(categoryMap);

		for (let purpose of purposes) {
			const prompt = `Classify the following purpose into a more specific predefined category, such as '${categoryNames.join(
				"', '"
			)}'. Be specific and assign the purpose to the closest, most relevant category, only show category in the given list, only return if purpose word or phase is in English.\n\nPurpose: ${
				purpose.name
			}\nCategory:`;

			// console.log({prompt})
			const response = await openai.completions.create({
				model: 'gpt-3.5-turbo-instruct',
				prompt: prompt,
				max_tokens: 10,
			});

			try {
				const normalizedId =
					categoryMap[response.choices[0].text.trim().toLowerCase()];

				await Purposes.update(
					{ normalized_purpose_id: normalizedId },
					{ where: { id: purpose.id } }
				);
			} catch (error) {
				console.log({ error });
			}
		}

		//find all invalid purposes word then delete it
		// const inValidPurposeIds = await Purposes.findAll({
		//     where: {
		//         normalized_purpose_id: {
		//             [Op.eq]: null
		//         }
		//     },
		//     attributes: ['id'],
		//     raw: true
		// })

		// const ids = inValidPurposeIds.map((item) => item.id)

		// await UserPurposes.destroy({
		//     where: {
		//         purpose_id: {
		//             [Op.in]: ids
		//         }
		//     }
		// })
		// await Purposes.destroy({
		//     where: {
		//         id: {
		//             [Op.in]: ids
		//         }
		//     }
		// })

		return Promise.resolve({
			message: 'Updated purposes!',
		});
	} catch (error) {
		console.log(error);

		return Promise.resolve({
			message: 'Updated purposes!',
		});
	}
}

async function normalizeInterests(interestId) {
	try {
		let interests = [];

		if (interestId) {
			interests = await Interests.findAll({
				where: {
					id: interestId,
				},
				attributes: ['name', 'id'],
				order: [['id', 'asc']],
			});
		} else {
			interests = await Interests.findAll({
				attributes: ['name', 'id'],
				order: [['id', 'asc']],
			});
		}

		const categoryNames = Object.keys(categoryMap);

		for (let interest of interests) {
			const prompt = `Classify the following interest into a more specific predefined category, such as '${categoryNames.join(
				"', '"
			)}'. Be specific and assign the purpose to the closest, most relevant category, only show category in the given list, only return if purpose word or phase is in English.\n\nInterest: ${
				interest.name
			}\nCategory:`;

			const response = await openai.completions.create({
				model: 'gpt-3.5-turbo-instruct',
				prompt: prompt,
				max_tokens: 10,
			});

			try {
				const normalizedId =
					categoryMap[response.choices[0].text.trim().toLowerCase()];

				await Interests.update(
					{ normalized_interest_id: normalizedId },
					{ where: { id: interest.id } }
				);
			} catch (error) {
				console.log({ error });
			}
		}

		//find all invalid interests word then delete it
		// const inValidInterestIds = await Interests.findAll({
		//     where: {
		//         normalized_interest_id: {
		//             [Op.eq]: null
		//         }
		//     },
		//     attributes: ['id'],
		//     raw: true
		// })

		// const ids = inValidInterestIds.map((item) => item.id)

		// await UserInterests.destroy({
		//     where: {
		//         interest_id: {
		//             [Op.in]: ids
		//         }
		//     }
		// })
		// await Interests.destroy({
		//     where: {
		//         id: {
		//             [Op.in]: ids
		//         }
		//     }
		// })

		return Promise.resolve({
			message: 'Updated interests!',
		});
	} catch (error) {
		console.log(error);

		return Promise.resolve({
			message: 'Updated interests!',
		});
	}
}

async function wordlistValidation({ words }) {
	try {
		const validWords = [];

		for (const word of words) {
			let interest = await Interests.findOne({
				where: {
					name: word,
					normalized_interest_id: {
						[Op.ne]: null,
					},
				},
			});
			if (interest) {
				validWords.push(word);
			} else {
				let purpose = await Purposes.findOne({
					where: {
						name: word,
						normalized_purpose_id: {
							[Op.ne]: null,
						},
					},
				});

				if (purpose) {
					validWords.push(word);
				} else {
					const prompt = `Is the following phase is English. Just response yes or no. Phase: '${word}'`;

					const response = await openai.completions.create({
						model: 'gpt-3.5-turbo-instruct',
						prompt: prompt,
						max_tokens: 10,
					});

					try {
						if (
							response.choices[0].text
								.trim()
								.toLowerCase()
								.includes('yes')
						) {
							validWords.push(word);
						}
					} catch (error) {
						console.log({ error });
					}
				}
			}
		}

		return Promise.resolve({
			message: 'Checkover',
			data: validWords,
		});
	} catch (error) {
		console.log(error);

		return Promise.reject(error);
	}
}

async function createGeneralPurpose(purposeName) {
	// Check if a purpose with the same name exists
	let purpose = await Purposes.findOne({
		where: { name: purposeName },
	});

	if (purpose) {
		return purpose;
	}
	// create purpose if it doesn't exist

	purpose = await Purposes.create({
		name: purposeName,
	});

	await normalizePurposes(purpose.id);

	return purpose;
}

async function createUserPurpose({ userId, purposeName }) {
	if (!purposeName || !purposeName.length > 1) {
		throw new Error('Purpose must be a word.');
	}

	const purpose = await createGeneralPurpose(purposeName);
	console.log(purpose.id);
	// link user with purpose
	const userPurpose = await UserPurposes.create({
		user_id: userId,
		purpose_id: purpose.id,
	});
	return UserPurposes.findOne({
		where: {
			id: userPurpose.id,
		},
		include: [{ model: Purposes }],
	});
}

async function deletePurpose({ userId, userPurposeId }) {
	const userPurpose = await UserPurposes.findOne({
		where: {
			id: userPurposeId,
			user_id: userId,
		},
	});

	if (!userPurpose) {
		throw new Error(`Purpose doesn't exist`);
	}

	await UserPurposes.destroy({
		where: { user_id: userId, id: userPurposeId },
	});

	// find all users that have the exact same purpose id
	const allPurposes = await UserPurposes.findAll({
		where: { purpose_id: userPurpose.purpose_id },
	});

	if (allPurposes.length === 0) {
		await Purposes.destroy({ where: { id: userPurpose.purpose_id } });
	}
	return true;
}

async function createUserInterest({ userId, interestName, interestType }) {
	if (!interestName || !interestName.length > 1) {
		throw new Error('Interest must be a word.');
	}
	const interest = await createGeneralInterest(interestName);

	const userInterest = await UserInterests.create({
		user_id: Number.parseInt(userId),
		interest_id: interest.id,
		interest_type: interestType,
	});

	return UserInterests.findOne({
		where: {
			id: userInterest.id,
		},
		include: [{ model: Interests }],
	});
}

async function deleteInterest({ userId, userInterestId }) {
	console.log(userId, userInterestId);
	const userInterest = await UserInterests.findOne({
		where: {
			id: userInterestId,
			user_id: userId,
		},
	});

	if (!userInterest) {
		throw new Error(`Interest doesn't exist`);
	}

	await UserInterests.destroy({
		where: { user_id: userId, id: userInterestId },
	});

	// find all users that have the exact same purpose id
	const allInterests = await UserInterests.findAll({
		where: { interest_id: userInterest.interest_id },
	});

	if (allInterests.length === 0) {
		await Interests.destroy({ where: { id: userInterest.interest_id } });
	}
	return true;
}

module.exports = {
	getPurposes,
	getLikes,
	getDislikes,
	updatePurposes,
	updateLikes,
	updateDislikes,
	updateProfileTag,
	normalizePurposes,
	normalizeInterests,
	getAllInterests,
	wordlistValidation,
	createUserPurpose,
	deletePurpose,
	createUserInterest,
	deleteInterest,
};
