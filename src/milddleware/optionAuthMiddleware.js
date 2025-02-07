const authMiddleware = require("./authMiddleware");

const optionAuthMiddleware = (req, res, next) => {
    if (req.headers.authorization) {
        return authMiddleware(req, res, next);
    }
    next();
};

module.exports = optionAuthMiddleware;