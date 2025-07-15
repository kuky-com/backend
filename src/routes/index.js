const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const usersRoutes = require('./users');
const interestsRoutes = require('./interests');
const matchesRoutes = require('./matches');
const journeysRoutes = require('./journeys');
const notificationsRoutes = require('./notifications');
const adminRoutes = require('./admin');
const geolocationRoutes = require('./geolocation');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/interests', interestsRoutes);
router.use('/matches', matchesRoutes);
router.use('/journeys', journeysRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/admin', adminRoutes);
router.use('/geolocation', geolocationRoutes);

module.exports = router;
