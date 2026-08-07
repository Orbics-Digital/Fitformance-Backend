import logger from "../config/logger.js"
import { buildPaginationResponse, getPagination } from "../helpers/pagination.js"
import Exercise from '../models/exercise.model.js'
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