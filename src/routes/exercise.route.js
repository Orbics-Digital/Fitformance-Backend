import express from 'express'
import { addExercise, deleteExercise, getExerciseById, getExercises, updateExercise } from '../controllers/exercise.controller.js'
import { CREATE_REHAB_VALIDATOR, UPDATE_REHAB_VALIDATOR } from '../helpers/validators.js'
import { AuthVerifier } from '../middleware/auth.middleware.js'
import upload from '../middleware/upload.middleware.js'
import validator from '../middleware/validator.js'

const router = express.Router()

const rehabUpload = upload('rehab').fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
])

router.get('/get', AuthVerifier, getExercises)

router.get('/get/:id', AuthVerifier, getExerciseById)

router.post('/create', AuthVerifier, rehabUpload, validator(CREATE_REHAB_VALIDATOR), addExercise)

router.patch('/update/:id', AuthVerifier, rehabUpload, validator(UPDATE_REHAB_VALIDATOR), updateExercise)

router.delete('/delete/:id', AuthVerifier, deleteExercise)

export default router
