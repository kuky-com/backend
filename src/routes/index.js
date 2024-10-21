const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const usersRoutes = require('./users');
const interestsRoutes = require('./interests');
const matchesRoutes = require('./matches');
const notificationsRoutes = require('./notifications');
const adminRoutes = require('./admin');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/interests', interestsRoutes);
router.use('/matches', matchesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/admin', adminRoutes);

module.exports = router;