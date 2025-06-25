const { Op } = require("sequelize");
const Users = require("../../models/users");
const { getUser } = require("../users");
const Journeys = require("../../models/journeys")
const { default: axios } = require("axios");
const { default: OpenAI } = require('openai');
const { predefinedTags } = require('../common');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeUserTags(userInfo) {
    try {

        if(userInfo.interests.length === 0 && 
            !userInfo.video_intro_transcript && 
            !userInfo.video_purpose_transcript && 
            !userInfo.video_interests_transcript) {
            return Promise.resolve({
                data: [],
                message: 'No interests or video transcripts available for analysis',
            });
        }

        const interests = userInfo.interests.filter(item => item.user_interests.interest_type === 'like').map((interest) => interest.name).join(', ') + '';
        const dislikes = userInfo.interests.filter(item => item.user_interests.interest_type === 'dislike').map((dislike) => dislike.name).join(', ') + '';

        const prompt = `
                   You are a user tagging system. Your goal is to analyze user information and assign relevant tags from a predefined list.
                    Be precise and assign only tags that are strongly related to the provided information. If no clear tag applies, do not assign one.
                    Consider nuances in language and infer interests even if not explicitly stated.

                    Predefined Tags: ${predefinedTags.join(', ')}

                    User Information:
                    Likes: ${interests}
                    Dislikes: ${dislikes}
                    ${userInfo.video_intro_transcript ? `Introduction video Transcription: ${userInfo.video_intro_transcript}` : ''}
                    ${userInfo.video_purpose_transcript ? `Journey video Transcription: ${userInfo.video_purpose_transcript}` : ''}
                    ${userInfo.video_interests_transcript ? `Interest video Transcription: ${userInfo.video_interests_transcript}` : ''}

                    Based on the above information, list the most relevant tags from the Predefined Tags list.
                    Format your output as a comma-separated list of tags, e.g., "tag1,tag2,tag3". If not enough information is provided, return an empty list.
                    Do not include any additional text or explanations, just the tags.
                    `;
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
            });

            const result = response.choices[0]?.message?.content?.trim();

            return Promise.resolve({
                data: result.split(',').map(tag => tag.trim()),
                message: 'Update successfully',
            });
        } catch (error) {
            console.log({ error });
        }
    } catch (error) {
        console.log({ error })
    }
}

const autoAnalyzeUser = async (req, res) => {
    const missingJourneyUsers = await Users.scope('withInterestCount').findAll({
        where: {
            is_active: true,
            journey_id: null,
            journey_category_id: null,
        },
        raw: true,
    });

    console.log(`Found ${missingJourneyUsers.length} missing journey users for try to analyze again`);
    const journeys = await Journeys.findAll({
                attributes: ['id', 'name'],
                raw: true
            })
    const journeyList = journeys.map((journey) => `${journey.name} - ${journey.id}`).join('\n')
    
    for (let i = 0; i < missingJourneyUsers.length; i++) {
        try {
            let user_id = missingJourneyUsers[i].id;
            let userInfo = await getUser(user_id);
            if (userInfo.likeCount === 0 || userInfo.dislikeCount === 0) {
                console.log(`User ${user_id} has no interests, skipping analysis.`);
                continue;
            }
            const interests = userInfo.interests.filter(item => item.user_interests.interest_type === 'like').map((interest) => interest.name).join(', ') + '';
            const dislikes = userInfo.interests.filter(item => item.user_interests.interest_type === 'dislike').map((dislike) => dislike.name).join(', ') + '';

            const prompt = `We have following information and list of journeys, please analyze the user and give us best matching journey for the user.
                            Full name: ${userInfo.full_name}
                            Interested journey: ${userInfo.journey?.name ?? ''}
                            Interesting: ${interests}
                            Dislikes: ${dislikes}
                            What he/she said in the video intro: ${userInfo.video_intro_transcript ?? ''}
                            What he/she said in the video journey: ${userInfo.video_purpose_transcript ?? ''}
                            What he/she said in the video interests: ${userInfo.video_interests_transcript ?? ''}


                            #List of journeys - format is name - id: 
                            ${journeyList}

                            #In the response return only journey id, no other text, no explanation, no other information.
                        `;

            try {
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'system', content: prompt }],
                });

                const journey_id = parseInt(response.choices[0]?.message?.content?.trim())
                if (isNaN(journey_id)) {
                    console.log(`Invalid journey ID for user ${user_id}:`, response.choices);
                    continue;
                }

                const journey = await Journeys.findOne({ where: { id: journey_id }, raw: true })

                await Users.update(
                    { journey_id: journey.id, journey_category_id: journey.category },
                    { where: { id: user_id } }
                );

                try {
                    const tags = await analyzeUserTags(userInfo);
                    if (tags.data.length > 0) {
                        await Users.update(
                            { matching_tags: tags.data },
                            { where: { id: user_id } }
                        );
                    }
                } catch (error) {
                    
                }

            } catch (error) {
                console.log({ error });
            }
            
        } catch (error) {
            console.log({ error })
        }
    }

    return res.status(200).json({
        message: 'All profile processed',
    });
}

module.exports = {
    autoAnalyzeUser
}