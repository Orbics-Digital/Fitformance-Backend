import express from 'express'
import {
    addCondition,
    addProtocol,
    addWeek,
    getProtocolById,
    getProtocols,
    setWeekExercises,
    toggleStatus,
    updateCondition,
    updateProtocol,
    updateWeek,
} from '../controllers/protocol.controller.js'
import {
    CREATE_PROTOCOL_CONDITION_VALIDATOR,
    CREATE_PROTOCOL_VALIDATOR,
    CREATE_PROTOCOL_WEEK_VALIDATOR,
    SET_PROTOCOL_WEEK_EXERCISES_VALIDATOR,
    UPDATE_PROTOCOL_CONDITION_VALIDATOR,
    UPDATE_PROTOCOL_VALIDATOR,
    UPDATE_PROTOCOL_WEEK_VALIDATOR,
} from '../helpers/validators.js'
import { AuthVerifier } from '../middleware/auth.middleware.js'
import validator from '../middleware/validator.js'

const router = express.Router()

router.get('/get', AuthVerifier, getProtocols)

router.get('/get/:id', AuthVerifier, getProtocolById)

router.post('/create', AuthVerifier, validator(CREATE_PROTOCOL_VALIDATOR), addProtocol)

router.patch('/update/:id', AuthVerifier, validator(UPDATE_PROTOCOL_VALIDATOR), updateProtocol)

router.patch('/toggle-status/:id', AuthVerifier, toggleStatus)

router.post('/condition/create', AuthVerifier, validator(CREATE_PROTOCOL_CONDITION_VALIDATOR), addCondition)

router.patch('/condition/update', AuthVerifier, validator(UPDATE_PROTOCOL_CONDITION_VALIDATOR), updateCondition)

router.post('/week/create', AuthVerifier, validator(CREATE_PROTOCOL_WEEK_VALIDATOR), addWeek)

router.patch('/week/update', AuthVerifier, validator(UPDATE_PROTOCOL_WEEK_VALIDATOR), updateWeek)

router.patch('/week/exercises', AuthVerifier, validator(SET_PROTOCOL_WEEK_EXERCISES_VALIDATOR), setWeekExercises)

export default router
