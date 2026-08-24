import express from 'express'
import {
    addLibrary,
    addLibraryCategory,
    addMuscleGroup,
    getLibraries,
    getLibraryById,
    setLibraryCategoryExercises,
    togglePremium,
    toggleStatus,
    updateLibrary,
    updateLibraryCategory,
    updateMuscleGroup,
} from '../controllers/library.controller.js'
import {
    CREATE_LIBRARY_CATEGORY_VALIDATOR,
    CREATE_LIBRARY_VALIDATOR,
    CREATE_MUSCLE_GROUP_VALIDATOR,
    SET_LIBRARY_EXERCISES_VALIDATOR,
    UPDATE_LIBRARY_CATEGORY_VALIDATOR,
    UPDATE_LIBRARY_VALIDATOR,
    UPDATE_MUSCLE_GROUP_VALIDATOR,
} from '../helpers/validators.js'
import { AuthVerifier } from '../middleware/auth.middleware.js'
import validator from '../middleware/validator.js'

const router = express.Router()

router.get('/get', AuthVerifier, getLibraries)

router.get('/get/:id', AuthVerifier, getLibraryById)

router.post('/create', AuthVerifier, validator(CREATE_LIBRARY_VALIDATOR), addLibrary)

router.patch('/update/:id', AuthVerifier, validator(UPDATE_LIBRARY_VALIDATOR), updateLibrary)

router.patch('/toggle-status/:id', AuthVerifier, toggleStatus)

router.patch('/toggle-premium/:id', AuthVerifier, togglePremium)

router.post('/muscle-group/create', AuthVerifier, validator(CREATE_MUSCLE_GROUP_VALIDATOR), addMuscleGroup)

router.patch('/muscle-group/update', AuthVerifier, validator(UPDATE_MUSCLE_GROUP_VALIDATOR), updateMuscleGroup)

router.post('/category/create', AuthVerifier, validator(CREATE_LIBRARY_CATEGORY_VALIDATOR), addLibraryCategory)

router.patch('/category/update', AuthVerifier, validator(UPDATE_LIBRARY_CATEGORY_VALIDATOR), updateLibraryCategory)

router.patch('/category/exercises', AuthVerifier, validator(SET_LIBRARY_EXERCISES_VALIDATOR), setLibraryCategoryExercises)

export default router
