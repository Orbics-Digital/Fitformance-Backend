import dotenv from 'dotenv'
import mongoose from 'mongoose'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'
import { ENUM_REHAB_TYPES, getFileExtension, LIBRARY, PROTOCOLS, REHAB_TYPES } from '../utils/index.js'

dotenv.config()

const exercise_schema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    file: {
        type: String,
        required: false,
    },
    active: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
})

exercise_schema.virtual('file_url').get(function () {

    if (!this.file) {
        return null
    }

    if (this.file && this.file.startsWith('http')) {
        return this.file
    }

    return `${process.env.BASE_URL}${this.file}`

})

exercise_schema.virtual('file_type').get(function () {

    if (!this.file) {
        return null
    }

    const file_extension = getFileExtension(this.file)

    return file_extension

})

exercise_schema.plugin(mongooseLeanVirtuals)

export default mongoose.model('Exercise', exercise_schema)
