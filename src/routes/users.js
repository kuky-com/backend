const express = require("express");
const users = require("@controllers/users");
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware')

router.post('/update', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return users.updateProfile({ user_id, ...request.body }).then(({ data, message }) => {
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

router.post('/update-token', authMiddleware, (request, response, next) => {
    const { user_id, session_id } = request
    const { session_token } = request.body

    if (!user_id || !session_token || !session_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, session_token, session_id"
        })
    }

    return users.updateSessionToken({ user_id, session_id, ...request.body }).then(({ data, message }) => {
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

router.get('/user-info', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return users.getProfile({ user_id }).then(({ data, message }) => {
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

router.post('/friend-info', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id } = request.body

    if (!user_id || !friend_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id"
        })
    }

    return users.getFriendProfile({ user_id, friend_id }).then(({ data, message }) => {
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

router.post('/delete-account', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { reason } = request.body

    if (!user_id || !reason) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, reason"
        })
    }

    return users.deleteAccount({ user_id, reason }).then(({ data, message }) => {
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

router.post('/deactive-account', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { reason } = request.body

    if (!user_id || !reason) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, reason"
        })
    }

    return users.deactiveAccount({ user_id, reason }).then(({ data, message }) => {
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

router.post('/block-user', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id } = request.body

    if (!user_id || !friend_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id"
        })
    }

    return users.blockUser({ user_id, friend_id }).then(({ data, message }) => {
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

router.post('/unblock-user', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id } = request.body

    if (!user_id || !friend_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id"
        })
    }

    return users.unblockUser({ user_id, friend_id }).then(({ data, message }) => {
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

router.get('/blocked-users', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return users.getBlockedUsers({ user_id }).then(({ data, message }) => {
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

router.post('/report-user', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { reason, reported_id } = request.body

    if (!user_id || !reported_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, reason"
        })
    }

    return users.reportUser({ reporter_id: user_id, user_id: reported_id, reason }).then(({ data, message }) => {
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


router.post('/review-user', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { friend_id, rating } = request.body

    if (!user_id || !friend_id || !rating) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friend_id, rating"
        })
    }

    return users.reviewUser({ user_id: friend_id, reviewer_id: user_id, ...request.body }).then(({ data, message }) => {
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

router.get('/latest-version', authMiddleware, (request, response, next) => {
    return users.getLatestVersion().then(({ data, message }) => {
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