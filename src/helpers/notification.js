import firebase from '../config/firebase.js'
import logger from "../config/logger.js"
import Notification from "../models/notification.model.js"
import User from "../models/user.model.js"
import { ROLES } from "../utils/index.js"

export const sendNotification = async ({ title, message, user_ids = [], metadata = null, admin = false, push = true, save = true }) => {

    if (!title || !message) {
        throw new Error('Invalid parameters for send notification.')
    }

    if (admin) {
        const admins = await User.find({ role: ROLES.ADMIN, active: true }).select('_id')
        user_ids = admins.map(item => item._id)
    }

    const recipients = user_ids.map(item => ({
        user: item,
        read: false
    }))

    if (!recipients.length) {
        logger.warn('No recipients found for notification:', title)
        return null
    }

    let notification = null

    if (save) {

        notification = new Notification({
            title,
            message,
            recipients,
            metadata
        })

        await notification.save()

    }


    if (push) {

        const users = await User.find({ _id: { $in: user_ids }, device_ids: { $exists: true, $ne: [] } }).select('device_ids');

        for (const user of users) {
            for (const token of user.device_ids) {
                try {

                    logger.info(`Sending push notification to user ${user._id} with token ${token}`)
                    logger.info(`Notification payload: title="${title}", message="${message}", metadata=${JSON.stringify(metadata)}`)

                    const data = Object.fromEntries(
                        Object.entries(metadata || {}).map(([key, value]) => [key, String(value)])
                    )

                    const response = await firebase.messaging().send({
                        token,
                        notification: {
                            title,
                            body: message
                        },
                        data
                    })

                    console.log('✅ Notification sent:', response)

                } catch (err) {
                    logger.error(`Error sending push to ${user._id}:`, err)
                }
            }
        }

    }

    logger.info(`Notification sent to ${user_ids.length} user(s)`)

    return notification

}