const express = require("express");
const matches = require("@controllers/matches");
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware')

router.get('/suggestions', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.getExploreList({ user_id, ...request.body }).then(({ data, message }) => {
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

router.get('/less-matches', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.findLessMatches({ user_id, ...request.body }).then(({ data, message }) => {
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

router.get('/best-matches', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.findBestMatches({ user_id, ...request.body }).then(({ data, message }) => {
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

router.post('/disconnect', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id, id } = request.body

    if (!user_id || !friend_id || !id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id, id"
        })
    }

    return matches.disconnect({ user_id, friend_id, id }).then(({ data, message }) => {
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

router.post('/accept', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id } = request.body

    if (!user_id || !friend_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id"
        })
    }

    return matches.acceptSuggestion({ user_id, friend_id }).then(({ data, message }) => {
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

router.post('/reject', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id } = request.body

    if (!user_id || !friend_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id"
        })
    }

    return matches.rejectSuggestion({ user_id, friend_id }).then(({ data, message }) => {
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

router.get('/matches', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.getMatches({ user_id }).then(({ data, message }) => {
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

router.post('/disconnection', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { matchId } = request.body

    if (!user_id || !matchId) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, matchId"
        })
    }

    return matches.disconnectMatch({ user_id, ...request.body }).then(({ data, message }) => {
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

router.post('/last-message', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { last_message, conversation_id } = request.body

    if (!user_id || !last_message || !conversation_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, last_message, conversation_id"
        })
    }

    return matches.updateLastMessage({ user_id, ...request.body }).then(({ data, message }) => {
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