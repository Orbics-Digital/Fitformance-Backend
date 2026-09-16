import logger from "../config/logger.js"
import { removeFiles } from "../helpers/folder.js"
import { buildPaginationResponse, getPagination } from "../helpers/pagination.js"
import Exercise from '../models/exercise.model.js'
import Library from '../models/library.model.js'
import Plan from '../models/plan.model.js'
import Protocol from '../models/protocol.model.js'
import { dateRangeFilter, REHAB_TYPES, searchRegex } from "../utils/index.js"

export const getExercises = async (req, res, next) => {
    try {
        const { query } = req
        const { search, from, to } = query
        const { skip, limit, page, page_size } = getPagination(query)

        let filter = {}

        if (search) {
            filter.title = searchRegex(search)
        }

        if ((from && from !== "") || (to && to !== "")) {
            filter.createdAt = dateRangeFilter(from, to)
        }

        const rehabs = await Exercise.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean({ virtuals: true })

        const total = await Exercise.countDocuments(filter)

        logger.info(`Exercises listing fetched`)

        return res.status(200).json({
            success: true,
            message: 'Exercises fetched successfully.',
            ...buildPaginationResponse(rehabs, total, page, page_size),
        })

    } catch (error) {
        logger.error(`Get Exercises Error: ${error.message}`)
        next(error)
    }
}

export const getExerciseById = async (req, res, next) => {
    try {
        const { params } = req
        const { id } = params

        const rehab = await Exercise.findById(id)

        return res.status(200).json({
            success: true,
            message: 'Exercise fetched successfully.',
            data: rehab
        })

    } catch (error) {
        logger.error(`Get Exercise by ID Error: ${error.message}`)
        next(error)
    }
}

export const addExercise = async (req, res, next) => {
    try {

        const { body, decoded, file } = req
        const { title, description } = body

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'File is required.',
            })
        }

        const rehab = new Exercise({
            title,
            description: description.trim(),
            file: file?.path || null,
        })

        await rehab.save()

        logger.info(`Exercise created by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Exercise created successfully.',
            data: rehab,
        })

    } catch (error) {
        next(error)
    }
}

export const deleteExercise = async (req, res, next) => {
    try {
        const { params, decoded } = req
        const { id } = params

        const rehab = await Exercise.findById(id)

        if (!rehab) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found.',
            })
        }

        if (rehab.file) {
            removeFiles(rehab.file)
        }

        await Exercise.findByIdAndDelete(id)

        await Library.updateMany(
            { "muscle_groups.categories.exercise_ids": id },
            { $pull: { "muscle_groups.$[].categories.$[].exercise_ids": id } }
        )

        await Protocol.updateMany(
            { "conditions.weeks.exercise_ids": id },
            { $pull: { "conditions.$[].weeks.$[].exercise_ids": id } }
        )

        await Plan.updateMany(
            { "exercises.rehab": id },
            { $pull: { exercises: { rehab: id } } }
        )

        logger.info(`Exercise ${id} deleted by user ${decoded?.id}`)

        return res.status(200).json({
            success: true,
            message: 'Exercise deleted successfully.',
            data: rehab,
        })

    } catch (error) {
        logger.error(`Delete Exercise Error: ${error.message}`)
        next(error)
    }
}