import mongoose from "mongoose"
import logger from "../config/logger.js"
import { buildPaginationResponse, getPagination } from "../helpers/pagination.js"
import { sendNotification } from "../helpers/notification.js"
import Plan from "../models/plan.model.js"
import User from "../models/user.model.js"
import { calculateProgress } from "../services/excercise.service.js"
import { dateRangeFilter, PLAN_STATUS, ROLES, searchRegex } from "../utils/index.js"

export const getPlans = async (req, res, next) => {
    try {

        const { query, decoded } = req
        const { search, from, to } = query
        const { skip, limit, page, page_size } = getPagination(query)

        let filter = {}

        if (decoded.role === ROLES.USER) {

            const user = await User.findById(decoded.id)

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                })
            }

            filter.user = decoded.id
            filter.therapist = user.therapist
            filter.active = true

        } else if (decoded.role === ROLES.THERAPIST) {
            const clients = await User.find({ therapist: decoded.id }).select("_id")
            filter.user = { $in: clients.map((client) => client._id) }
            filter.active = true
        }

        if (search) {
            filter.name = searchRegex(search)
        }

        if ((from && from !== "") || (to && to !== "")) {
            filter.createdAt = dateRangeFilter(from, to)
        }

        const plans = await Plan.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        const total = await Plan.countDocuments(filter)

        logger.info(`Plans listing fetched`)

        return res.status(200).json({
            success: true,
            message: 'Plans fetched successfully.',
            ...buildPaginationResponse(plans, total, page, page_size),
        })

    } catch (error) {
        logger.error(`Get Plans Error: ${error.message}`)
        next(error)
    }
}

export const getPlanById = async (req, res, next) => {
    try {

        const { params, decoded } = req
        const { id } = params

        const plan = await Plan.findById(id)
            .populate({
                path: "exercises.rehab",
                select: "title file description thumbnail"
            })
            .populate({ path: "therapist", select: "name" })
            .populate({ path: "user", select: "name therapist" })
            .lean({ virtuals: true })

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Plan not found"
            })
        }

        if (decoded.role === ROLES.THERAPIST) {
            const therapistId = decoded.id.toString()
            const ownerId = (plan.therapist?._id || plan.therapist)?.toString()
            const assignedIds = (plan.user?.therapist || []).map((item) => (item?._id || item)?.toString())
            const canView = ownerId === therapistId || assignedIds.includes(therapistId)

            if (!canView) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to view this plan"
                })
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Plan fetched successfully.',
            data: plan
        })

    } catch (error) {
        logger.error(`Get Plan by ID Error: ${error.message}`)
        next(error)
    }
}

export const addPlan = async (req, res, next) => {

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const { body, decoded } = req
        const { user: user_id, name, notes, exercises } = body
        const therapist = decoded.id

        const user = await User.findById(user_id).session(session)
        if (!user) {
            await session.abortTransaction()
            session.endSession()
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        if (!user.therapist?.map(t => t.toString()).includes(therapist)) {
            await session.abortTransaction()
            session.endSession()
            return res.status(403).json({
                success: false,
                message: "You are not allowed to create a plan for this user"
            })
        }

        const plan = new Plan({
            user: user._id,
            therapist,
            name,
            notes,
            exercises
        })
        await plan.save({ session })

        await session.commitTransaction()
        session.endSession()

        logger.info(`Plan created by therapist ${therapist} for user ${user._id}`)

        // Let the patient know a new plan is ready. A failed push must not fail the request.
        const practitioner = await User.findById(therapist).select("name")
        sendNotification({
            title: "New Plan Assigned",
            message: `${practitioner?.name || "Your practitioner"} has assigned you a new plan: ${name}.`,
            metadata: { type: "plan", id: plan._id.toString() },
            user_ids: [user._id]
        }).catch(error => logger.error(`Plan notification error: ${error.message}`))

        return res.status(201).json({
            success: true,
            message: "Plan created successfully"
        })

    } catch (error) {
        await session.abortTransaction()
        session.endSession()
        logger.error(`Add Plan Error: ${error.message}`)
        next(error)
    }
}

export const updatePlan = async (req, res, next) => {
    try {

        const { params, body, decoded } = req
        const { id } = params
        const { name, notes, exercises } = body

        if (decoded.role !== ROLES.THERAPIST) {
            return res.status(403).json({
                success: false,
                message: "Only practitioners can update plans"
            })
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan ID"
            })
        }

        const plan = await Plan.findById(id)

        if (!plan || !plan.active) {
            return res.status(404).json({
                success: false,
                message: "Plan not found"
            })
        }

        if (plan.therapist.toString() !== decoded.id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only update plans you created"
            })
        }

        if (plan.status === PLAN_STATUS.COMPLETED) {
            return res.status(400).json({
                success: false,
                message: "Completed plans cannot be edited"
            })
        }

        plan.name = name
        plan.notes = notes
        plan.exercises = exercises
        await plan.save()

        logger.info(`Plan ${plan._id} updated by therapist ${decoded.id}`)

        // Let the patient know their plan changed. A failed push must not fail the request.
        const practitioner = await User.findById(decoded.id).select("name")
        sendNotification({
            title: "Plan Updated",
            message: `${practitioner?.name || "Your practitioner"} has updated your plan: ${name}.`,
            metadata: { type: "plan", id: plan._id.toString() },
            user_ids: [plan.user]
        }).catch(error => logger.error(`Plan notification error: ${error.message}`))

        return res.status(200).json({
            success: true,
            message: "Plan updated successfully",
            data: plan
        })

    } catch (error) {
        logger.error(`Update Plan Error: ${error.message}`)
        next(error)
    }
}

export const completePlan = async (req, res, next) => {
    try {

        const { params, decoded } = req
        const { id } = params

        const plan = await Plan.findById(id)

        if (!plan) {
            return res.status(404).json({ success: false, message: "Exercise not found" })
        }

        if (plan.user.toString() !== decoded.id) {
            return res.status(403).json({ success: false, message: "Not authorized" })
        }

        if (plan.status === PLAN_STATUS.COMPLETED) {
            return res.status(400).json({ success: false, message: "Exercise already completed" })
        }

        plan.status = PLAN_STATUS.COMPLETED
        await plan.save()

        const progress = await calculateProgress(decoded.id)

        return res.status(200).json({
            success: true,
            message: "Exercise marked as complete",
            data: {
                progress
            }
        })

    } catch (error) {
        console.error("Mark Plan Complete Error:", error)
        next(error)
    }
}