const express = require("express");
const interests = require("@controllers/interests");
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware')

router.post('/update-purposes', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { purposes } = request.body

    if (!user_id || !purposes) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, purposes"
        })
    }

    return interests.updatePurposes({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.post('/update-likes', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { likes } = request.body

    if (!user_id || !likes) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, likes"
        })
    }

    return interests.updateLikes({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.post('/update-dislikes', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { dislikes } = request.body

    if (!user_id || !dislikes) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, dislikes"
        })
    }

    return interests.updateDislikes({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})


router.get('/purposes', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.getPurposes({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/profile-tag', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.updateProfileTag({ user_id }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/likes', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.getLikes({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/dislikes', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.getDislikes({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/all-interests', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.getAllInterests({ user_id, ...request.body }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/normalize-interests', (request, response, next) => {
    return interests.normalizeInterests().then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/normalize-purposes', (request, response, next) => {
    return interests.normalizePurposes().then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.post('/wordlist-validation', (request, response, next) => {
    const { words } = request.body

    if (!words) {
        return response.json({
            success: false,
            message: "Missing required params: words"
        })
    }

    return interests.wordlistValidation({ words }).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/force-update-all-tags', (request, response, next) => {
    return interests.forceUpdateProfileTags().then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/all-purposes', (request, response, next) => {
    return response.json({
        success: true,
        data: [
            'Find support for anxiety',
            'Cope with depression',
            'Build confidence',
            'Navigate a divorce or breakup',
            'Overcome grief or loss',
            'Manage stress better',
            'Create healthier habits',
            'Improve work-life balance',
            'Learn mindfulness techniques',
            'Connect with others facing similar challenges',
        ]
    })
})

router.get('/all-likes', (request, response, next) => {
    return response.json({
        success: true,
        data: [
            'Reading',
            'Writing or journaling',
            'Painting or drawing',
            'Cooking or baking',
            'Playing musical instruments',
            'Listening to music',
            'Watching movies or TV shows',
            'Hiking or nature walks',
            'Gardening',
            'Fitness or working out',
            'Yoga or meditation',
            'Gaming',
            'Traveling',
            'Photography',
            'Crafting or DIY projects',
            'Dancing'
        ]
    })
})

router.get('/all-dislikes', (request, response, next) => {
    return response.json({
        success: true,
        data: [
            'Crowded places',
            'Loud noises',
            'Socializing with strangers',
            'Conflict or arguments',
            'Public speaking',
            'Unstructured routines',
            'Being alone for extended periods',
            'Lack of support',
            'Feeling judged',
            'Overwhelming tasks',
            'Poor communication',
            'Toxic relationships',
            'Excessive screen time',
        ]
    })
})

router.get('/all-tags', (request, response, next) => {
    return interests.getAllTags().then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/journey-list', (request, response, next) => {
    return interests.getValidJourneys().then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})


//new onboarding api

router.get('/journey-categories', (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.getJourneyCategories({user_id}).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/journeys', (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    const { category_id } = request.query

    if (!category_id) {
        return response.json({
            success: false,
            message: "Missing required params: category_id"
        })
    }

    return interests.getJourneys({category_id, user_id}).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/jpf-general-questions', (request, response, next) => {
    return interests.getGeneralQuestion(request.query).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/jpf-questions', (request, response, next) => {
    return interests.getJPFQuestions(request.query).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.get('/jpf-video-question', (request, response, next) => {
    return interests.getVideoQuestion(request.query).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.post('/submit-answer', (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return interests.submitAnswer({...request.body, user_id}).then(({ data, message }) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

module.exports = router;