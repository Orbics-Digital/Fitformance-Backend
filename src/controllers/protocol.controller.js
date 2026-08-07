import logger from "../config/logger.js"
import { buildPaginationResponse, getPagination } from "../helpers/pagination.js"
import Exercise from "../models/exercise.model.js"
import Protocol from "../models/protocol.model.js"
import { dateRangeFilter, searchRegex } from "../utils/index.js"

const findCondition = (protocol, condition_id) =>
    protocol.conditions.id(condition_id)

const findWeek = (condition, week_id) =>
    condition.weeks.id(week_id)

const validateExerciseIds = async (exercise_ids) => {
    if (!exercise_ids.length) return true

    const unique_ids = [...new Set(exercise_ids.map(String))]
    const found = await Exercise.find({ _id: { $in: unique_ids } }).select('_id')
    return found.length === unique_ids.length
}

export const getProtocols = async (req, res, next) => {
    try {
        const { query } = req
        const { search, from, to, active } = query
        const { skip, limit, page, page_size } = getPagination(query)

        let filter = {}

        if (search) {
            filter.name = searchRegex(search)
        }

        if (active != null) {
            filter.active = active
        }

        if ((from && from !== "") || (to && to !== "")) {
            filter.createdAt = dateRangeFilter(from, to)
        }

        const protocols = await Protocol.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        const total = await Protocol.countDocuments(filter)

        logger.info(`Protocols listing fetched`)

        return res.status(200).json({
            success: true,
            message: 'Protocols fetched successfully.',
            ...buildPaginationResponse(protocols, total, page, page_size),
        })
    } catch (error) {
        logger.error(`Get Protocols Error: ${error.message}`)
        next(error)
    }
}

export const getProtocolById = async (req, res, next) => {
    try {
        const { id } = req.params

        const protocol = await Protocol.findById(id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        logger.info(`Protocol fetched: ${id}`)

        return res.status(200).json({
            success: true,
            message: 'Protocol fetched successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Get Protocol by ID Error: ${error.message}`)
        next(error)
    }
}

export const addProtocol = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { name } = body

        const exists = await Protocol.findOne({ name })

        if (exists) {
            return res.status(409).json({
                success: false,
                message: 'Protocol with the same name already exists.',
            })
        }

        const protocol = new Protocol({ name })
        await protocol.save()

        logger.info(`Protocol created by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Protocol created successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Add Protocol Error: ${error.message}`)
        next(error)
    }
}

export const updateProtocol = async (req, res, next) => {
    try {
        const { body, decoded, params } = req
        const { id } = params
        const { name } = body

        const protocol = await Protocol.findById(id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        const exists = await Protocol.findOne({ name, _id: { $ne: id } })

        if (exists) {
            return res.status(409).json({
                success: false,
                message: 'Protocol with the same name already exists.',
            })
        }

        protocol.name = name
        await protocol.save()

        logger.info(`Protocol ${id} updated by ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Protocol updated successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Update Protocol Error: ${error.message}`)
        next(error)
    }
}

export const toggleStatus = async (req, res, next) => {
    try {
        const { id } = req.params

        const protocol = await Protocol.findById(id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        protocol.active = !protocol.active
        await protocol.save()

        logger.info(`Protocol status toggled: ${protocol.name} → ${protocol.active ? 'ACTIVE' : 'INACTIVE'}`)

        return res.status(200).json({
            success: true,
            message: `Protocol ${protocol.active ? 'activated' : 'deactivated'} successfully.`,
            data: protocol,
        })
    } catch (error) {
        logger.error(`Toggle Protocol Status Error: ${error.message}`)
        next(error)
    }
}

export const addCondition = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, name, type } = body

        const protocol = await Protocol.findById(region_id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        const duplicate = protocol.conditions.some(
            (condition) => condition.name.toLowerCase() === name.toLowerCase()
        )

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: 'Condition with the same name already exists in this protocol.',
            })
        }

        protocol.conditions.push({ name, type, weeks: [] })
        await protocol.save()

        logger.info(`Condition added to protocol ${region_id} by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Condition created successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Add Condition Error: ${error.message}`)
        next(error)
    }
}

export const updateCondition = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, condition_id, name, type } = body

        const protocol = await Protocol.findById(region_id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        const condition = findCondition(protocol, condition_id)

        if (!condition) {
            return res.status(404).json({
                success: false,
                message: 'Condition not found.',
            })
        }

        if (name != null) {
            const duplicate = protocol.conditions.some(
                (item) =>
                    item._id.toString() !== condition_id &&
                    item.name.toLowerCase() === name.toLowerCase()
            )

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: 'Condition with the same name already exists in this protocol.',
                })
            }

            condition.name = name
        }

        if (type != null) {
            condition.type = type
        }

        await protocol.save()

        logger.info(`Condition ${condition_id} updated by user ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Condition updated successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Update Condition Error: ${error.message}`)
        next(error)
    }
}

export const addWeek = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, condition_id, label, sub } = body

        const protocol = await Protocol.findById(region_id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        const condition = findCondition(protocol, condition_id)

        if (!condition) {
            return res.status(404).json({
                success: false,
                message: 'Condition not found.',
            })
        }

        condition.weeks.push({ label, sub, exercise_ids: [] })
        await protocol.save()

        logger.info(`Week added to condition ${condition_id} by user ${decoded.id}`)

        return res.status(201).json({
            success: true,
            message: 'Week created successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Add Week Error: ${error.message}`)
        next(error)
    }
}

export const updateWeek = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, condition_id, week_id, label, sub } = body

        const protocol = await Protocol.findById(region_id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        const condition = findCondition(protocol, condition_id)

        if (!condition) {
            return res.status(404).json({
                success: false,
                message: 'Condition not found.',
            })
        }

        const week = findWeek(condition, week_id)

        if (!week) {
            return res.status(404).json({
                success: false,
                message: 'Week not found.',
            })
        }

        if (label != null) {
            week.label = label
        }

        if (sub != null) {
            week.sub = sub
        }

        await protocol.save()

        logger.info(`Week ${week_id} updated by user ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Week updated successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Update Week Error: ${error.message}`)
        next(error)
    }
}

export const setWeekExercises = async (req, res, next) => {
    try {
        const { body, decoded } = req
        const { region_id, condition_id, week_id, exercise_ids } = body

        const protocol = await Protocol.findById(region_id)

        if (!protocol) {
            return res.status(404).json({
                success: false,
                message: 'Protocol not found.',
            })
        }

        const condition = findCondition(protocol, condition_id)

        if (!condition) {
            return res.status(404).json({
                success: false,
                message: 'Condition not found.',
            })
        }

        const week = findWeek(condition, week_id)

        if (!week) {
            return res.status(404).json({
                success: false,
                message: 'Week not found.',
            })
        }

        const all_exist = await validateExerciseIds(exercise_ids)

        if (!all_exist) {
            return res.status(400).json({
                success: false,
                message: 'One or more exercise IDs are invalid.',
            })
        }

        week.exercise_ids = exercise_ids
        await protocol.save()

        logger.info(`Week ${week_id} exercises set by user ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: 'Week exercises updated successfully.',
            data: protocol,
        })
    } catch (error) {
        logger.error(`Set Week Exercises Error: ${error.message}`)
        next(error)
    }
}
