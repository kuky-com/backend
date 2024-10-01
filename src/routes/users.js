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

    if (!user_id || !friendId) {
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
    const { friendId } = request.body

    if (!user_id || !friendId) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friendId"
        })
    }

    return users.blockUser({ user_id, friendId }).then(({ data, message }) => {
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
    const { friendId } = request.body

    if (!user_id || !friendId) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, friendId"
        })
    }

    return users.unblockUser({ user_id, friendId }).then(({ data, message }) => {
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

module.exports = router;