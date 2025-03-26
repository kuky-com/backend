const express = require("express");
const journeys = require("@controllers/journeys");
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware')

router.get('/categories', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return journeys.getCategories({user_id}).then(({ data, message }) => {
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

router.get('/journeys', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    const { category } = request.query

    if (!category) {
        return response.json({
            success: false,
            message: "Missing required params: category"
        })
    }

    return journeys.getJourneys({category, user_id}).then(({ data, message }) => {
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

router.get('/jpf-general-questions', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return journeys.getGeneralQuestion({user_id, ...request.query}).then(({ data, message }) => {
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

router.get('/jpf-questions', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return journeys.getJPFQuestions({user_id, ...request.query}).then(({ data, message }) => {
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

router.get('/jpf-video-question', authMiddleware, (request, response, next) => {
    return journeys.getVideoQuestion(request.query).then(({ data, message }) => {
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

router.post('/submit-answer', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return journeys.submitAnswer({...request.body, user_id}).then(({ data, message }) => {
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