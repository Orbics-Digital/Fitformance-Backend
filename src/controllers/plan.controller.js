import mongoose from "mongoose"
import logger from "../config/logger.js"
import { buildPaginationResponse, getPagination } from "../helpers/pagination.js"
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
            filter.therapist = decoded.id
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

        const { params } = req
        const { id } = params

        const plan = await Plan.findById(id).populate("exercises.rehab").lean({ virtuals: true })

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