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
					} catch (error) { }
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

		// foramt onesignal tags with the deleted user interests

		// const deletedInterests = await UserInterests.findAll({
		// 	where: {
		// 		user_id,
		// 		interest_type: 'like',
		// 		interest_id: { [Op.notIn]: newInterestIds },
		// 	},
		// 	include: [{ model: Interests }],
		// });

		// const onesignaluser = await getOnesignalUser(user_id);
		// let tags = onesignaluser.properties.tags;

		// for (const i of deletedInterests) {
		// 	tags = await formatOnesignalTags(
		// 		tags,
		// 		'like',
		// 		i.interest.normalized_interest_id,
		// 		'delete'
		// 	);
		// }

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
					} catch (error) { }
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

		// format onesignal like tags for new user
		// for (const like of newUserLikes) {
		// 	if (!currentLikesIds.includes(like.interest_id)) {
		// 		tags = formatOnesignalTags(
		// 			tags,
		// 			'like',
		// 			like.interest.normalized_interest_id,
		// 			'add'
		// 		);
		// 	}
		// }

		// sonesignaluser.properties.tags = tags;
		// update the onesignal tags
		// updateOnesignalUser(onesignaluser, user_id);
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
					} catch (error) { }
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

		if (interests.length === 0) {
			return Promise.reject('There is no selected interest');
		}

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

		// const initialUser = await Users.findOne({ where: { id: user_id } });

		const updatedUser = await Users.update(
			{ profile_tag: bestTag.id },
			{
				where: { id: user_id },
			}
		);

		const userInfo = await getProfile({ user_id });

		// if (initialUser.profile_tag !== bestTag.id) {
		// 	console.log('should send PN ');
		// 	await addBatchNotifications(
		// 		'New possible connections!',
		// 		'There are new users that you might be interested in! 👀',
		// 		[getProfileTagFilter(bestTag.id)]
		// 	);

		// 	await updateOnesignalUserTags(user_id, 'tag', bestTag.id, 'add');
		// }

		return Promise.resolve({
			message: 'User profile tag has been updated!',
			data: userInfo.data,
		});
	} catch (error) {
		try {
			console.log('Error user update dislikes:', error);
			// const initialUser = await Users.findOne({ where: { id: user_id } });

			const updatedUser = await Users.update(
				{ profile_tag: 1 },
				{
					where: { id: user_id },
				}
			);

			const userInfo = await getProfile({ user_id });

			// if (initialUser.profile_tag !== 1) {
			// 	await addBatchNotifications(
			// 		'New possible connections!',
			// 		'There are new users that you might be interested in! 👀',
			// 		getProfileTagFilter(1)
			// 	);
			// 	await updateOnesignalUserTags(user_id, 'tag', 1, 'add');
			// }

			return Promise.resolve({
				message: 'User profile tag has been updated!',
				data: userInfo.data,
			});
		} catch (error) {
			console.log({ error });
		}
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
			)}'. Be specific and assign the purpose to the closest, most relevant category, only show category in the given list, only return if purpose word or phase is in English.\n\nPurpose: ${purpose.name
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
			)}'. Be specific and assign the purpose to the closest, most relevant category, only show category in the given list, only return if purpose word or phase is in English.\n\nInterest: ${interest.name
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
	// link user with purpose
	const userPurpose = await UserPurposes.create({
		user_id: userId,
		purpose_id: purpose.id,
	});
	const user_purposes = (
		await UserPurposes.findOne({
			where: {
				id: userPurpose.id,
			},
			include: [{ model: Purposes }],
		})
	).toJSON();

	return {
		...user_purposes.purpose,
		user_purposes,
	};
}

async function deletePurpose({ userId, userPurposeId }) {
	const userPurpose = await UserPurposes.findOne({
		where: {
			id: userPurposeId,
			user_id: userId,
		},
		include: [{ model: Purposes }],
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

	const user_interests = (
		await UserInterests.findOne({
			where: {
				id: userInterest.id,
			},
			include: [{ model: Interests }],
		})
	).toJSON();

	// if (user_interests.interest_type === 'like') {
	// 	await updateOnesignalUserTags(
	// 		userId,
	// 		'like',
	// 		user_interests.interest.normalized_interest_id,
	// 		'add'
	// 	);
	// }

	return {
		...user_interests.interest,
		user_interests,
	};
}

async function deleteInterest({ userId, userInterestId }) {
	const userInterest = await UserInterests.findOne({
		where: {
			id: userInterestId,
			user_id: userId,
		},
		include: [{ model: Interests }],
	});

	if (!userInterest) {
		throw new Error(`Interest doesn't exist`);
	}

	await UserInterests.destroy({
		where: { user_id: userId, id: userInterestId },
	});

	// if (userInterest.interest_type === 'like') {
	// 	await updateOnesignalUserTags(
	// 		userId,
	// 		'like',
	// 		userInterest.interest.normalized_interest_id,
	// 		'delete'
	// 	);
	// }

	// find all users that have the exact same purpose id
	const allInterests = await UserInterests.findAll({
		where: { interest_id: userInterest.interest_id },
	});

	if (allInterests.length === 0) {
		await Interests.destroy({ where: { id: userInterest.interest_id } });
	}
	return true;
}

/**
 * user1: { 
	purposes: [
{ name: 'p1', id: 1 },
{name: 'p2', id: 2 }
	]
likes: [ { 
name: 'puppies',
id: 1,
} , ...],
 dislikes: [{name: 'cats', id: 2 }, ...]

 user2: same ...
}
 * 
If there's no common purpose, maybe there is a common like. Or one user as a purpose that another user likes.

		If there's no common purpose or no common like, use the common dislikes. 

		The most important thing in the match is the purpose, so if you can find something common in the user purposes please use that,
		 then likes and then dislikes. 

		If one user likes something that another user dislikes, that is not something in common.

		The message should be something succint that matches both users. No "OR"

		Based on both users intersts likes, and dislikes please return this message show the common purpose/like/dislike 
		that made you choose that specific message.






		----

				Focus on what the users have in common, the number one priority being a shared purpose. 
		For example, if one user likes bears and another one likes bunnies, they both like animals.

		Do the following thing: 
		For each of the user1 purposes, take each of the user2 purposes and ask yourself: "Do this purposes have anything in common?" 
		If the answer is yes, then compose a message based on that, if there's not a 


		You can extrapolate the common purpose/like/disliks.

			FOR 4o we can use: 

				response_format: {
			type: 'json_schema',
			json_schema: {
				name: 'answer',
				schema: {
					match: 'match number',
					message: 'The reason why the users should talk based on the common purpsoe',
					tag: 'The extrapolated common purpose',
				},
			},
		},

*/
async function checkPurposeMatch(user1, user2) {
	try {
		const context = `Hey! I'm building an app that matches users based on common purposes, likes and dislikes. 

		When two users are matched, we want to show them a reason for their match, a reason to start a conversation. 
		For example, if one user purpose is 'learning guitar' and another user purpose is 'learning to play drums' we 
		want to show them a prompt saying "You are both learning a musical instrument".  Basically, their common purpose,
		a reason that they should start a conversation. 


		I'll give you a list of two items to match with the following format:
		Item1: user 1 purpose
		Item2:  user2 2 purpose 
		
		
		For each pair of items you will you will: 
			1. Extrapolate the common purpose from these items. 
			2. Generate a number between 0 and 100 that signifies how alike are the two purposes
			. 0 - not alike at all,
			  25 - small similarity
			  50- kind of alike, but not exactly the same
			  75- very close, but not exactly the same
			  100 - the same, only wording differs
				
			3. Create a message that encourages users to talk based on these common purpose of the items. Make the message succint 


		The response should be a json in the following format: 
		[{
			match: match number
			message: The reason why the users should talk based on the common purpose. 
			Should be formulated as something that you display in the app, about what the users have in common
			 "You both are going though....". 
}, ...]
		`;

		const messages = [];

		if (user1.purposes.length === 0 || user2.purposes.length === 0) {
			return [];
		}

		for (let purpose of user1.purposes) {
			for (let purpose2 of user2.purposes) {
				console.log(purpose, purpose2);
				messages.push(`
				 Item1 : ${purpose.name}
				 Item2: ${purpose2.name}
				 
				 ------
				 `);
			}
		}

		const response = await openai.chat.completions.create({
			model: 'gpt-4o',

			messages: [
				{ content: context, role: 'system' },
				{ content: messages.join(), role: 'user' },
			],
		});

		const result = JSON.parse(response.choices[0].message.content.trim().replace(/\n/g, '').replace(/\t/g, '').replace(/```json/g, '').replace(/```/g, ''));


		return result.filter((r) => r.match > 0).sort((a, b) => b.match - a.match);
	} catch (error) {
		return []
	}
}

async function checkInterestMatch(user1, user2) {
	try {
		const context = `Hey! I'm building an app that matches users based on common purposes, likes and dislikes. 

		When two users are matched, we want to show them a reason for their match, a reason to start a conversation. 
		For example, if one user likes dogs and another user likes 'cats'' we 
		want to show them a prompt saying "Discuss about your shared love for animals".  Basically, their common like or dislike,
		a reason that they should start a conversation. 


		I'll give you a list of two items to match with the following format:
		Tag: type of match
		Item1: user 1 purpose
		Item2:  user2 2 purpose 
		
		
		For each pair of items you will you will: 
			1. Extrapolate the common like from these items. 
			2. Generate a number between 0 and 100 that signifies how alike are the two likes/dislikes
			. 0 - not alike at all,
			  25 - small similarity
			  50- kind of alike, but not exactly the same
			  75- very close, but not exactly the same
			  100 - the same, only wording differs
				
			3. Create a message that encourages users to talk based on these common interest of the items. Make the message succint.
				If tag is dislike, make formulate the message like this: "You both dislike..."

		The match number should be 0 if there's nothing common in the interests

		Analyse each pair individually! 
		The response should be a json in the following format: 
		[{
			type: the same type from the input
			match: match number
			tag: The common denomitor of the interests. 1-2 words max. Example: Music, Mental Health, Fitness, Animals...etc
			message: The reason why the users should talk based on the common like/dislike. 
			Should be formulated as something that you display in the app, about what the users have in common
			 "You both dislike....." or "You both like....". 
}, ...]
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
			return [];
		}
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',

			messages: [
				{ content: context, role: 'system' },
				{ content: messages.join(), role: 'user' },
			],
		});

		const result = JSON.parse(response.choices[0].message.content.trim().replace(/\n/g, '').replace(/\t/g, '').replace(/```json/g, '').replace(/```/g, ''));

		return result
			.sort((a, b) => b.match - a.match)
			.filter((m) => m.match > 0)
			.filter(
				(item, index, self) =>
					index ===
					self.findIndex((t) => t.type === item.type && t.tag === item.tag)
			);
	} catch (error) {
		return []
	}
}

async function forceUpdateProfileTags() {
	const missingUsers = await Users.findAll({
		where: {
			profile_tag: {
				[Op.eq]: null,
			},
		},
		attributes: ['id', 'profile_tag'],
		orderBy: [['id', 'DESC']],
		raw: true,
	});
	for (var user of missingUsers) {
		try {
			await updateProfileTag({ user_id: user.id });
		} catch (error) {
			console.log({ error });
		}
	}

	return Promise.resolve({
		message: 'Update completed!',
	});
}

async function getAllTags() {
	const tags = await Tags.findAll({
		attributes: ['id', 'name'],
	});

	return Promise.resolve({
		message: 'All journey tags!',
		data: tags,
	});
}

async function getValidJourneys() {
    try {
        const query = `
            SELECT 
                p.id,
                p.name,
                COUNT(up.id) AS usage_count
            FROM 
                purposes p
            JOIN 
                user_purposes up ON p.id = up.purpose_id
            JOIN 
                users u ON up.user_id = u.id
            WHERE 
                u.profile_approved = 'approved' and u.profile_tag is not null and is_active = TRUE and is_hidden_users = FALSE
            GROUP BY 
                p.id
            HAVING 
                COUNT(up.id) >= 3
            ORDER BY 
                usage_count DESC;
        `;

        const results = await sequelize.query(query, {
            type: Sequelize.QueryTypes.SELECT,
        });

        console.log({ results });

        return Promise.resolve({
            message: 'Purposes retrieved successfully!',
            data: results,
        });
    } catch (error) {
        console.log('Error retrieving purposes:', error);
        return Promise.reject(error);
    }
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
	checkPurposeMatch,
	checkInterestMatch,
	forceUpdateProfileTags,
	getAllTags,
	getValidJourneys
};
