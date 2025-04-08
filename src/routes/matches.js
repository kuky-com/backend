const express = require("express");
const matches = require("@controllers/matches");
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware')
const optionAuthMiddleware = require('../milddleware/optionAuthMiddleware')

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

router.post('/best-matches', authMiddleware, (request, response, next) => {
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

router.get('/best-matches', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.findBestMatches({ user_id, page: 1, limit: 20 }).then(({ data, message }) => {
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

router.get('/recent-matches', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.getRecentMatches({ user_id }).then(({ data, message }) => {
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

router.get('/unverified-matches', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.getUnverifiedMatches({ user_id }).then(({ data, message }) => {
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

router.get('/matches-with-preminum', authMiddleware, (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.getMatchesWithPreminum({ user_id }).then(({ data, message }) => {
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

router.get('/find-matches-by-purpose/:purposeId', authMiddleware, async (request, response, next) => {
    console.log({request: request.params.purposeId})
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    console.log({user_id, purpose_id: request.params.purposeId})

	return matches
		.findMatchesByPurpose({ user_id, purpose_id: request.params.purposeId })
		.then(({ data, message }) => {
			return response.json({
				success: true,
				data: data,
				message: message,
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

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

router.post('/conversation', authMiddleware, (request, response, next) => {
    const { user_id } = request
    const { conversation_id } = request.body

    if (!user_id || !conversation_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id, conversation_id"
        })
    }

    return matches.getConversation({ user_id, conversation_id }).then(({ data, message }) => {
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

router.get('/sample-profiles', (request, response, next) => {
    return matches.getSampleProfiles().then(({ data, message }) => {
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

router.get('/sample-explore', (request, response, next) => {
    return matches.getSampleExplore({ ...request.query }).then(({ data, message }) => {
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

router.get('/search-by-journey', async (request, response, next) => {
	return matches
		.searchByJourney({ ...request.query })
		.then(({ data, message }) => {
			return response.json({
				success: true,
				data: data,
				message: message,
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.get('/match-by-journey', optionAuthMiddleware, async (request, response, next) => {
    const { user_id } = request

	return matches
		.getMatchesByJourney({ ...request.query, user_id })
		.then(({ data, message }) => {
			return response.json({
				success: true,
				data: data,
				message: message,
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.get('/next-match', authMiddleware, async (request, response, next) => {
    const { user_id } = request

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

	return matches
		.getNextMatch({ ...request.query, user_id })
		.then(({ data, message }) => {
			return response.json({
				success: true,
				data: data,
				message: message,
			});
		})
		.catch((error) => {
			return response.json({
				success: false,
				message: `${error}`,
			});
		});
});

router.get('/check-matches', (request, response, next) => {
    const { user_id } = request.body

    if (!user_id) {
        return response.json({
            success: false,
            message: "Missing required params: user_id"
        })
    }

    return matches.getMatchesWithPreminum({ user_id }).then(({ data, message }) => {
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