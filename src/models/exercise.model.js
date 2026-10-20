import dotenv from 'dotenv'
import mongoose from 'mongoose'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'
import { getFileExtension } from '../utils/index.js'

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
    thumbnail: {
        type: String,
        required: false,
        default: null,
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

    if (this.file.startsWith('http')) {
        return this.file
    }

    return `${process.env.BASE_URL}${this.file}`
})

exercise_schema.virtual('file_type').get(function () {
    if (!this.file) {
        return null
    }

    return getFileExtension(this.file)
})

exercise_schema.virtual('thumbnail_url').get(function () {
    if (!this.thumbnail) {
        return null
    }

    if (this.thumbnail.startsWith('http')) {
        return this.thumbnail
    }

    return `${process.env.BASE_URL}${this.thumbnail}`
})

exercise_schema.plugin(mongooseLeanVirtuals)

export default mongoose.model('Exercise', exercise_schema)
