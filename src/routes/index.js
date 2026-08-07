import express from "express";

const router = express.Router()

import auth_routes from './authentication.route.js';
import category_routes from './category.route.js';
import conversation_routes from './conversation.route.js';
import feedback_routes from './feedback.route.js';
import general_routes from './general.route.js';
import notification_routes from './notification.route.js';
import package_routes from './package.route.js';
import plan_routes from './plan.route.js';
import exercise_routes from './exercise.route.js';
import reminder_routes from './reminder.route.js';
import user_routes from './user.route.js';

router.use('/auth', auth_routes)
router.use('/user', user_routes)
router.use('/rehab', exercise_routes)
router.use('/plan', plan_routes)
router.use('/reminder', reminder_routes)
router.use('/conversation', conversation_routes)
router.use('/package', package_routes)
router.use('/notification', notification_routes)
router.use('/feedback', feedback_routes)
router.use('/general', general_routes)
router.use('/category', category_routes)

export default router