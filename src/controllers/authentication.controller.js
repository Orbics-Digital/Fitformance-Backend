import dotenv from 'dotenv'
import mongoose from 'mongoose'
import logger from '../config/logger.js'
import { compareData } from '../helpers/encryption.js'
import { sendMail } from '../helpers/mail.js'
import { sendNotification } from '../helpers/notification.js'
import { getActiveSubscription } from '../helpers/stripe.js'
import { generateToken, verifyToken } from '../helpers/token.js'
import Otp from '../models/otp.model.js'
import User from '../models/user.model.js'
import { generateOtp, PROFILE_STATUS, ROLES } from '../utils/index.js'

dotenv.config()

export const signup = async (req, res, next) => {

    const session = await mongoose.startSession()
    session.startTransaction()

    try {

        const { body, file } = req
        const {
            name,
            email,
            password,
            country_code,
            dialing_code,
            phone,
            age,
            injury,
            role
        } = body

        const exists_with_email = await User.findOne({ email }).collation({ locale: 'en', strength: 2 })

        if (exists_with_email) {
            await session.abortTransaction()
            session.endSession()
            return res.status(409).json({
                success: false,
                message: 'User already exists with this email.',
            })
        }

        let payload = {
            name,
            email,
            password,
            country_code,
            dialing_code,
            phone,
            age,
            injury,
            role: role || ROLES.USER,
        }

        if (file && file.path) {
            payload.image = file.path
        }

        const user = new User(payload)
        await user.save({ session })

        logger.info(`User registered successfully: ${email}`)

        const title =
            user?.role === ROLES.USER
                ? 'New Patient Awaiting Review'
                : 'New Practitioner Awaiting Review'

        const message =
            user?.role === ROLES.USER
                ? `A new patient, ${user.name} (${user.email}), has just registered. Please review their profile.`
                : `A new practitioner, ${user.name} (${user.email}), has just registered. Please review their profile.`

        sendNotification({
            title,
            message,
            metadata: {
                id: user._id,
                user_type: user.role,
                type: "new_registration"
            },
            admin: true,
        })

        await session.commitTransaction()
        session.endSession()

        return res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            data: user,
        })

    } catch (error) {
        await session.abortTransaction()
        session.endSession()
        next(error)
    }

}

export const login = async (req, res, next) => {
    try {

        const { email, password, device_id, source } = req.body

        const user = await User.findOne({ email }).collation({ locale: 'en', strength: 2 })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Invalid email or password.',
            })
        }

        if (!user.active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.',
            })
        }

        if (user.status === PROFILE_STATUS.PENDING) {
            return res.status(403).json({
                success: false,
                message: 'Your account is currently pending approval. Please wait for approval from admin.',
            })
        }

        if (user.status === PROFILE_STATUS.REJECTED) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been rejected. Please contact support for more information.',
            })
        }

        let request_source = source || ROLES.USER

        if (request_source !== user.role) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.',
            })
        }

        const matched = await compareData(password, user.password)

        if (!matched) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
            })
        }

        if (device_id && !user.device_ids.includes(device_id)) {
            user.device_ids.push(device_id)
            await user.save()
        }

        const token = await generateToken({
            id: user._id,
            email: user.email,
            role: user.role,
            type: 'login'
        })

        logger.info(`User logged in: ${email}`)

        await user.populate({
            path: "therapist",
            select: "name image",
        })

        let has_subscription = false
        try {
            has_subscription = Boolean(await getActiveSubscription(user._id))
        } catch (error) {
            logger.error(`Active subscription check failed: ${error.message}`)
        }

        const user_payload = typeof user.toObject === 'function'
            ? user.toObject({ virtuals: true })
            : user

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            data: {
                user: {
                    ...user_payload,
                    has_subscription,
                },
                token,
            },
        })

    } catch (error) {
        logger.error(`Login Error: ${error.message}`)
        next(error)
    }
}

export const forgetPassword = async (req, res, next) => {
    try {

        const { email } = req.body

        const user = await User.findOne({ email }).collation({ locale: 'en', strength: 2 })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email.',
            })
        }

        await Otp.deleteMany({ user: user._id })

        const { hashed, otp } = await generateOtp()
        const expiry = new Date(Date.now() + 10 * 60 * 1000)

        await Otp.create({
            user: user._id,
            code: hashed,
            expiry
        })

        logger.info(`OTP generated successfully by ${user.name}`)

        await sendMail({
            to: user.email,
            subject: "Password Reset Request – Fitformance",
            template: "password_reset_code",
            template_vars: {
                name: user.name,
                verification_code: otp,
                app_name: "Fitformance",
                logo_url: "https://fitformance.projectstagingzone.com/uploads/logo.png"
            }
        })

        return res.status(200).json({
            success: true,
            message: `OTP has been sent to email.`,
            data: {
                email
            },
        })

    } catch (error) {
        logger.error(`Forget Password Error: ${error.message}`)
        next(error)
    }
}

export const verifyOtp = async (req, res, next) => {
    try {

        const { email, otp } = req.body

        const user = await User.findOne({ email }).collation({ locale: 'en', strength: 2 })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email.',
            })
        }

        const otp_data = await Otp.findOne({ user: user._id, verified: false })

        if (!otp_data) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP.',
            })
        }

        if (otp_data.expiry < Date.now()) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired.'
            })
        }

        const matched = await compareData(otp, otp_data.code)
        if (!matched) return res.status(400).json({
            success: false,
            message: 'Invalid OTP.'
        })

        otp_data.verified = true
        await otp_data.save()

        const token = await generateToken({ id: user._id, type: 'password_reset' }, '15m')

        logger.info(`OTP verified successfully by ${user.name}`)

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully.',
            data: {
                token
            },
        })

    } catch (error) {
        logger.error(`Verify OTP Error: ${error.message}`)
        next(error)
    }
}

export const setPassword = async (req, res, next) => {
    try {

        const { body, headers } = req
        const { password } = body

        const auth_header = headers.authorization

        if (!auth_header)
            return res.status(401).json({ success: false, message: 'Missing token' })

        if (!auth_header?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Missing token'

            })
        }

        const token = auth_header.split(' ')[1]

        const decoded = await verifyToken(token)

        if (decoded.type !== 'password_reset') {
            return res.status(400).json({
                success: false,
                message: 'Invalid token type'
            })
        }

        const user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            })
        }

        user.password = password
        await user.save()

        await Otp.deleteMany({ user: decoded._id })

        logger.info(`Password set successfully by ${user.name}`)

        return res.status(200).json({
            success: true,
            message: 'Password set successful.'
        })

    } catch (error) {
        logger.error(`Set Password Error: ${error.message}`)
        next(error)
    }
}

export const logout = async (req, res, next) => {
    try {

        const { decoded, body } = req
        let device_id = null

        if (body) {
            device_id = body?.device_id
        }

        const user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        if (device_id && user?.device_ids.includes(device_id)) {
            user.device_ids = user.device_ids.filter(id => id !== device_id)
            await user.save()
        }

        logger.info(`User logged out: ${user.email}`)

        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        })

    } catch (error) {
        logger.error(`Logout Error: ${error.message}`)
        next(error)
    }

}