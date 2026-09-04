import express from 'express'
import { addExercise, deleteExercise, getExerciseById, getExercises } from '../controllers/exercise.controller.js'
import { CREATE_REHAB_VALIDATOR } from '../helpers/validators.js'
import { AuthVerifier } from '../middleware/auth.middleware.js'
import upload from '../middleware/upload.middleware.js'
import validator from '../middleware/validator.js'

const router = express.Router()

router.get('/get', AuthVerifier, getExercises)

router.get('/get/:id', AuthVerifier, getExerciseById)

router.post('/create', AuthVerifier, upload('rehab').single('file'), validator(CREATE_REHAB_VALIDATOR), addExercise)

router.delete('/delete/:id', AuthVerifier, deleteExercise)

export default router