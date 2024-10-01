const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const usersRoutes = require('./users');
const interestsRoutes = require('./interests');
const matchesRoutes = require('./matches');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/interests', interestsRoutes);
router.use('/matches', matchesRoutes);

module.exports = router;