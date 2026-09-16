import logger from "../config/logger.js"
import { buildPaginationResponse, getPagination } from "../helpers/pagination.js"
import Exercise from "../models/exercise.model.js"
import Library from "../models/library.model.js"
import { dateRangeFilter, ROLES, searchRegex } from "../utils/index.js"

const findMuscleGroup = (library, muscle_group_id) =>
    library.muscle_groups.id(muscle_group_id)

const findCategory = (muscle_group, category_id) =>
    muscle_group.categories.id(category_id)

const validateExerciseIds = async (exercise_ids) => {
    if (!exercise_ids.length) return true

    const unique_ids = [...new Set(exercise_ids.map(String))]
    const found = await Exercise.find({ _id: { $in: unique_ids } }).select('_id')
    return found.length === unique_ids.length
}

export const getLibraries = async (req, res, next) => {
    try {
        const { query, decoded } = req
        const { search, from, to, active } = query
        const { skip, limit, page, page_size } = getPagination(query)

        let filter = {}

        if (search) {
            filter.name = searchRegex(search)
        }

        if (decoded?.role === ROLES.THERAPIST) {
            filter.active = { $ne: false }
        } else if (active != null) {
            filter.active = active
        }

        if ((from && from !== "") || (to && to !== "")) {
            filter.createdAt = dateRangeFilter(from, to)
        }

        const libraries = await Library.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        const total = await Library.countDocuments(filter)

        logger.info(`Libraries listing fetched`)

        return res.status(200).json({
            success: true,
            message: 'Libraries fetched successfully.',
            ...buildPaginationResponse(libraries, total, page, page_size),
        })
    } catch (error) {
        logger.error(`Get Libraries Error: ${error.message}`)
        next(error)
    }
}

export const getLibraryById = async (req, res, next) => {
    try {
        const { id } = req.params
        const { decoded } = req

        const library = await Library.findById(id)

        if (!library || (decoded?.role === ROLES.THERAPIST && library.active === false)) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        logger.info(`Library fetched: ${id}`)

        return res.status(200).json({
            success: true,
            message: 'Library fetched successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Get Library by ID Error: ${error.message}`)
        next(error)
    }
}

export const addLibrary = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { name } = body

        const exists = await Library.findOne({ name })

        if (exists) {
            return res.status(409).json({
                success: false,
                message: 'Library with the same name already exists.',
            })
        }

        const library = new Library({ name })
        await library.save()

        logger.info(`Library created by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Library created successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Add Library Error: ${error.message}`)
        next(error)
    }
}

export const updateLibrary = async (req, res, next) => {
    try {
        const { body, decoded, params } = req
        const { id } = params
        const { name } = body

        const library = await Library.findById(id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        const exists = await Library.findOne({ name, _id: { $ne: id } })

        if (exists) {
            return res.status(409).json({
                success: false,
                message: 'Library with the same name already exists.',
            })
        }

        library.name = name
        await library.save()

        logger.info(`Library ${id} updated by ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Library updated successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Update Library Error: ${error.message}`)
        next(error)
    }
}

export const toggleStatus = async (req, res, next) => {
    try {
        const { id } = req.params

        const library = await Library.findById(id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        library.active = !library.active
        await library.save()

        logger.info(`Library status toggled: ${library.name} → ${library.active ? 'ACTIVE' : 'INACTIVE'}`)

        return res.status(200).json({
            success: true,
            message: `Library ${library.active ? 'activated' : 'deactivated'} successfully.`,
            data: library,
        })
    } catch (error) {
        logger.error(`Toggle Library Status Error: ${error.message}`)
        next(error)
    }
}

export const togglePremium = async (req, res, next) => {
    try {
        const { id } = req.params

        const library = await Library.findById(id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        library.premium = !library.premium
        await library.save()

        logger.info(`Library premium toggled: ${library.name} → ${library.premium ? 'PREMIUM' : 'STANDARD'}`)

        return res.status(200).json({
            success: true,
            message: `Library ${library.premium ? 'marked as premium' : 'removed from premium'} successfully.`,
            data: library,
        })
    } catch (error) {
        logger.error(`Toggle Library Premium Error: ${error.message}`)
        next(error)
    }
}

export const addMuscleGroup = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, name } = body

        const library = await Library.findById(region_id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        const duplicate = library.muscle_groups.some(
            (group) => group.name.toLowerCase() === name.toLowerCase()
        )

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: 'Muscle group with the same name already exists in this library.',
            })
        }

        library.muscle_groups.push({ name, categories: [] })
        await library.save()

        logger.info(`Muscle group added to library ${region_id} by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Muscle group created successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Add Muscle Group Error: ${error.message}`)
        next(error)
    }
}

export const updateMuscleGroup = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, muscle_group_id, name } = body

        const library = await Library.findById(region_id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        const muscle_group = findMuscleGroup(library, muscle_group_id)

        if (!muscle_group) {
            return res.status(404).json({
                success: false,
                message: 'Muscle group not found.',
            })
        }

        const duplicate = library.muscle_groups.some(
            (group) =>
                group._id.toString() !== muscle_group_id &&
                group.name.toLowerCase() === name.toLowerCase()
        )

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: 'Muscle group with the same name already exists in this library.',
            })
        }

        muscle_group.name = name
        await library.save()

        logger.info(`Muscle group ${muscle_group_id} updated by user ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Muscle group updated successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Update Muscle Group Error: ${error.message}`)
        next(error)
    }
}

export const addLibraryCategory = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, muscle_group_id, name } = body

        const library = await Library.findById(region_id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        const muscle_group = findMuscleGroup(library, muscle_group_id)

        if (!muscle_group) {
            return res.status(404).json({
                success: false,
                message: 'Muscle group not found.',
            })
        }

        const duplicate = muscle_group.categories.some(
            (category) => category.name.toLowerCase() === name.toLowerCase()
        )

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: 'Category with the same name already exists in this muscle group.',
            })
        }

        muscle_group.categories.push({ name, exercise_ids: [] })
        await library.save()

        logger.info(`Library category added to muscle group ${muscle_group_id} by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Library category created successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Add Library Category Error: ${error.message}`)
        next(error)
    }
}

export const updateLibraryCategory = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, muscle_group_id, category_id, name } = body

        const library = await Library.findById(region_id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        const muscle_group = findMuscleGroup(library, muscle_group_id)

        if (!muscle_group) {
            return res.status(404).json({
                success: false,
                message: 'Muscle group not found.',
            })
        }

        const category = findCategory(muscle_group, category_id)

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Library category not found.',
            })
        }

        const duplicate = muscle_group.categories.some(
            (item) =>
                item._id.toString() !== category_id &&
                item.name.toLowerCase() === name.toLowerCase()
        )

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: 'Category with the same name already exists in this muscle group.',
            })
        }

        category.name = name
        await library.save()

        logger.info(`Library category ${category_id} updated by user ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Library category updated successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Update Library Category Error: ${error.message}`)
        next(error)
    }
}

export const setLibraryCategoryExercises = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, muscle_group_id, category_id, exercise_ids } = body

        const library = await Library.findById(region_id)

        if (!library) {
            return res.status(404).json({
                success: false,
                message: 'Library not found.',
            })
        }

        const muscle_group = findMuscleGroup(library, muscle_group_id)

        if (!muscle_group) {
            return res.status(404).json({
                success: false,
                message: 'Muscle group not found.',
            })
        }

        const category = findCategory(muscle_group, category_id)

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Library category not found.',
            })
        }

        const all_exist = await validateExerciseIds(exercise_ids)

        if (!all_exist) {
            return res.status(400).json({
                success: false,
                message: 'One or more exercise IDs are invalid.',
            })
        }

        category.exercise_ids = exercise_ids
        await library.save()

        logger.info(`Library category ${category_id} exercises set by user ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Library category exercises updated successfully.',
            data: library,
        })
    } catch (error) {
        logger.error(`Set Library Category Exercises Error: ${error.message}`)
        next(error)
    }
}
