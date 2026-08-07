import logger from '../config/logger.js'
import { compareData } from '../helpers/encryption.js'
import { removeFiles } from '../helpers/folder.js'
import { sendNotification } from '../helpers/notification.js'
import { buildPaginationResponse, getPagination } from '../helpers/pagination.js'
import Conversation from '../models/conversation.model.js'
import Exercise from '../models/exercise.model.js'
import Plan from '../models/plan.model.js'
import User from '../models/user.model.js'
import { calculateProgress } from '../services/excercise.service.js'
import { fetchDetails, fetchTrending, searchMulti } from '../services/tmdb.service.js'
import { CONVERSATION_TYPES, dateRangeFilter, PLAN_STATUS, ROLES, searchRegex } from '../utils/index.js'

export const getHome = async (req, res, next) => {

    try {

        const { decoded } = req

        const [protocols, library, plans, progress] = await Promise.all([
            Exercise.find().sort({ createdAt: -1 }).limit(4).lean({ virtuals: true }),
            Exercise.find().sort({ createdAt: -1 }).limit(4).lean({ virtuals: true }),
            Plan.find({ user: decoded.id, active: true }).lean({ virtuals: true }),
            calculateProgress(decoded.id)
        ])

        logger.info(`Home listing fetched`)

        return res.status(200).json({
            success: true,
            message: "Home listing fetched successfully.",
            data: { progress, library, protocols }
        })

    } catch (error) {
        logger.error(`Get Home Error: ${error.message}`)
        next(error)
    }

}

export const getUsers = async (req, res, next) => {

    try {

        const { decoded, query } = req
        const { search, from, to, active, role, status } = query
        const { skip, limit, page, page_size } = getPagination(query)

        let filters = {}
        let sort = { createdAt: - 1 }
        let populate = {}

        if (decoded.role === ROLES.ADMIN) {

            filters._id = {
                $ne: decoded.id
            }

            if (role) {
                filters.role = role
            }

            populate = { path: "therapist", select: "name" }

        } else if (decoded.role === ROLES.THERAPIST) {
            filters.therapist = decoded.id
            filters.role = ROLES.USER
        }

        if (search) {
            filters.name = searchRegex(search)
        }

        if ((from && from !== "") || (to && to !== "")) {
            filters.createdAt = dateRangeFilter(from, to)
        }

        if (Object.hasOwn(query, "active") && active !== "") {
            filters.active = active === "true"
        }

        if (status) {
            filters.status = status
        }

        let users = User.find(filters)
            .select("-password")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean({ virtuals: true })

        if (decoded.role === ROLES.ADMIN) {
            users = users.populate(populate)
        }

        users = await users

        const total = await User.countDocuments(filters)

        logger.info(`User listing fetched`)

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully.",
            ...buildPaginationResponse(users, total, page, page_size),
        })

    } catch (error) {
        logger.error(`Get Users Error: ${error.message}`)
        next(error)
    }
}

export const getUserById = async (req, res, next) => {
    try {

        const { params, decoded } = req
        const { id } = params

        let query = User.findById(id).select("-password")

        if (decoded.role === ROLES.ADMIN) {
            query = query.populate({
                path: "therapist",
                select: "name email phone country_code dialing_code image"
            })
        }

        const user = await query.lean({ virtuals: true })

        if ((!user) || (user && (decoded.role === ROLES.THERAPIST) && (!user?.therapist?.map(t => t._id?.toString()).includes(decoded.id.toString())))) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            })
        }

        let payload = { ...user }

        if (decoded.role === ROLES.THERAPIST) {

            const plans = await Plan.find({ therapist: decoded.id, user: user._id, active: true }).select("name notes status createdAt").lean({ virtuals: true })

            const completed_exercises = plans.filter(plan => plan?.status === PLAN_STATUS.COMPLETED).length

            const progress = plans.length > 0
                ? Math.round((completed_exercises / plans.length) * 100)
                : 0

            payload.plans = plans
            payload.progress = progress
            delete payload.therapist

        }

        return res.status(200).json({
            success: true,
            message: 'User fetched successfully.',
            data: payload
        })

    } catch (error) {
        logger.error(`Get User by ID Error: ${error.message}`)
        next(error)
    }
}

export const getMyProfile = async (req, res, next) => {

    try {
        const { decoded } = req

        const user = await User.findById(decoded.id)
            .select("-password")
            .lean({ virtuals: true })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            })
        }

        logger.info(`Profile fetched for user: ${user.email}`)

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully.",
            data: user
        })

    } catch (error) {
        logger.error(`Get Profile Error: ${error.message}`)
        next(error)
    }
}

export const changePassword = async (req, res, next) => {
    try {

        const { decoded, body } = req
        const { old_password, password } = body

        const user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            })
        }

        const matched = await compareData(old_password, user.password)

        if (!matched) {
            return res.status(400).json({
                success: false,
                message: "Old password is incorrect.",
            })
        }

        user.password = password
        await user.save()

        logger.info(`Password changed successfully for: ${user.email}`)

        return res.status(200).json({
            success: true,
            message: "Password changed successfully.",
        })

    } catch (error) {
        logger.error(`Change Password Error: ${error.message}`)
        next(error)
    }
}

export const updateProfile = async (req, res, next) => {
    try {

        const { decoded, body, file } = req
        const { name, username, gender, country_code, dialing_code, phone } = body

        let user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            })
        }

        const updated_fields = {}
        if (name) updated_fields.name = name
        if (username) updated_fields.username = username
        if (gender) updated_fields.gender = gender
        if (country_code) updated_fields.country_code = country_code
        if (dialing_code) updated_fields.dialing_code = dialing_code
        if (phone) updated_fields.phone = phone

        if (file && file.path) {
            if (user?.image) removeFiles(user?.image)
            updated_fields.image = file.path
        }

        user = await User.findByIdAndUpdate(
            decoded.id,
            { $set: updated_fields },
            { new: true, runValidators: true }
        )

        logger.info(`Profile updated successfully for: ${user.email}`)

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: { user }
        })

    } catch (error) {
        logger.error(`Update Profile Error: ${error.message}`)
        next(error)
    }
}

export const removeImage = async (req, res, next) => {
    try {

        const { decoded } = req

        let user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            })
        }

        if (user?.image) {
            removeFiles(user?.image)
        }

        user.image = null
        await user.save()

        logger.info(`Image removed successfully for: ${user.email}`)

        return res.status(200).json({
            success: true,
            message: "Image removed successfully.",
            data: { user }
        })

    } catch (error) {
        logger.error(`Remove Image Error: ${error.message}`)
        next(error)
    }
}

export const toggleStatus = async (req, res, next) => {

    try {

        const { params } = req

        let user = await User.findById(params.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            })
        }

        user.active = !user.active

        await user.save()

        logger.info(`User status toggled: ${user.email} → ${user.active ? 'ACTIVE' : 'INACTIVE'}`)

        return res.status(200).json({
            success: true,
            message: `User's account ${user.active ? 'activated' : 'deactivated'} successfully.`,
            data: user
        })

    } catch (error) {
        logger.error(`Toggle User Status Error: ${error.message}`)
        next(error)
    }

}

export const updateStatus = async (req, res, next) => {
    try {

        const { params, body } = req
        const { status } = body

        const user = await User.findById(params.id)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            })
        }

        if (user.status === status) {
            return res.status(400).json({
                success: false,
                message: `User is already ${status}.`,
            })
        }

        user.status = status
        user.active = true

        await user.save()

        logger.info(`User status updated: ${user.email} → ${status}`)

        return res.status(200).json({
            success: true,
            message: `User status updated to ${status} successfully.`,
            data: user,
        })

    } catch (error) {
        logger.error(`Update User Status Error: ${error.message}`)
        next(error)
    }
}

export const handleTherapistAssignment = async (req, res, next) => {

    try {

        const { body } = req

        let therapist = await User.findOne({ _id: body?.therapist, role: ROLES.THERAPIST })

        if (!therapist) {
            return res.status(404).json({
                success: false,
                message: 'Therapist not found.',
            })
        }

        let user = await User.findOne({ _id: body?.user, role: ROLES.USER })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            })
        }

        const therapist_index = user.therapist?.findIndex(t => t.toString() === therapist._id.toString())
        const therapist_exists = therapist_index !== -1

        if (therapist_exists) {

            user.therapist.splice(therapist_index, 1)
            await user.save()

            await sendNotification({
                title: "Therapist Removed",
                message: "A therapist has been removed from your account.",
                user_ids: [user._id],
                metadata: { type: "therapist_removed", therapist: therapist._id },
                push: true
            })

            await sendNotification({
                title: "Client Assignment Removed",
                message: "A client assignment has been removed from your account.",
                user_ids: [therapist._id],
                metadata: { type: "client_assignment_removed", user: user._id },
                push: true
            })

            logger.info(`Therapist removed successfully | User: ${user.email} | Therapist: ${therapist.email}`)

            await Plan.updateMany({ user: user._id, therapist: therapist._id, active: true }, { $set: { active: false } })

            return res.status(200).json({
                success: true,
                message: "Practitioner removed from user successfully.",
            })

        } else {

            user.therapist.push(therapist._id)
            await user.save()

            let conversation = await Conversation.findOne({
                type: CONVERSATION_TYPES.PRIVATE,
                participants: { $all: [user._id, therapist._id] }
            })

            if (!conversation) {
                conversation = new Conversation({
                    participants: [user._id, therapist._id]
                })
                await conversation.save()
            }

            await sendNotification({
                title: "Therapist Assigned",
                message: "A therapist has been assigned to your account. Communication is now available via the application.",
                user_ids: [user._id],
                metadata: { type: "therapist_assigned", therapist: therapist._id },
                push: true
            })

            await sendNotification({
                title: "New Client Assignment",
                message: "You have been assigned a new client. Please review the assignment and proceed according to your workflow.",
                user_ids: [therapist._id],
                metadata: { type: "new_client_assigned", user: user._id },
                push: true
            })

            logger.info(`Therapist assigned successfully | User: ${user.email} | Therapist: ${therapist.email}`)

            await Plan.updateMany({ user: user._id, therapist: therapist._id, active: false }, { $set: { active: true } })

            return res.status(200).json({
                success: true,
                message: "Practitioner assigned to user successfully.",
            })
        }

    } catch (error) {
        logger.error(`Handle Therapist Assignment Error: ${error.message}`)
        next(error)
    }

}

export const assignDocuments = async (req, res, next) => {

    try {

        const { body, decoded, files } = req

        let therapist = await User.findOne({ _id: decoded.id, role: ROLES.THERAPIST })

        if (!therapist) {
            return res.status(404).json({
                success: false,
                message: 'Therapist not found.',
            })
        }

        let user = await User.findOne({ _id: body?.user, therapist: decoded.id, role: ROLES.USER })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            })
        }

        const existing_count = user.documents?.length || 0
        const incoming_count = files?.length || 0

        if (existing_count >= 3) {
            return res.status(400).json({
                success: false,
                message: 'Document limit reached. Maximum 3 documents allowed per user.',
            })
        }

        if (existing_count + incoming_count > 3) {
            return res.status(400).json({
                success: false,
                message: `Only ${3 - existing_count} document slot(s) remaining.`,
            })
        }

        const new_paths = files?.map(item => item.path) || []
        user.documents = [...(user.documents || []), ...new_paths]
        await user.save()

        logger.info(`Documents assigned successfully | User: ${user.email} | Therapist: ${therapist.email}`)

        await sendNotification({
            title: "You’ve Got New Documents 📄",
            message: "Your therapist just shared some documents with you. Please review them.",
            user_ids: [user._id],
            metadata: {
                type: "document_assignment",
                id: user._id.toString()
            }
        })

        return res.status(200).json({
            success: true,
            message: "Documents assigned to user successfully.",
        })

    } catch (error) {
        logger.error(`Assign Documents Error: ${error.message}`)
        next(error)
    }

}

export const deleteAssignedDocument = async (req, res, next) => {

    try {

        const { body, decoded } = req
        let { path, user } = body

        let therapist = await User.findOne({ _id: decoded.id, role: ROLES.THERAPIST })

        if (!therapist) {
            return res.status(404).json({
                success: false,
                message: 'Therapist not found.',
            })
        }

        user = await User.findOne({ _id: user, therapist: decoded.id, role: ROLES.USER })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            })
        }

        if (!path) {
            return res.status(400).json({
                success: false,
                message: 'Document URL is required.',
            })
        }

        console.log(user.documents);
        console.log(path);


        const exists = user.documents?.some(item => item === path)

        if (!exists) {
            return res.status(404).json({
                success: false,
                message: 'Document not found.',
            })
        }

        user.documents = user.documents.filter(item => item !== path)
        await user.save()

        removeFiles(path)

        logger.info(`Document deleted successfully | User: ${user.email} | Therapist: ${therapist.email}`)

        return res.status(200).json({
            success: true,
            message: "Document deleted successfully.",
        })

    } catch (error) {
        logger.error(`Delete Document Error: ${error.message}`)
        next(error)
    }

}

// new controllers

export const getTrending = async (req, res, next) => {
    try {

        const trending = await fetchTrending()

        return res.status(200).json({
            success: true,
            message: "Trending fetched successfully.",
            data: trending
        })

    } catch (error) {
        logger.error(`Get Trending Error: ${error.message}`)
        next(error)
    }
}

export const getMediaById = async (req, res, next) => {
    try {

        const { params } = req
        const { id, media_type } = params

        const media = await fetchDetails(id, media_type)

        return res.status(200).json({
            success: true,
            message: "Media details fetched successfully.",
            data: media
        })

    } catch (error) {
        logger.error(`Get Media Details Error: ${error.message}`)
        next(error)
    }
}

export const search = async (req, res, next) => {
    try {

        const { query } = req.params

        const search = await searchMulti(query)

        return res.status(200).json({
            success: true,
            message: "Search results fetched successfully.",
            data: search
        })

    } catch (error) {
        logger.error(`Get Search Results Error: ${error.message}`)
        next(error)
    }
}