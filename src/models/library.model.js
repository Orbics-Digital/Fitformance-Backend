import dotenv from 'dotenv'
import mongoose from 'mongoose'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'

dotenv.config()

const library_category_schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    exercise_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise',
    }],
})

const muscle_group_schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    categories: [library_category_schema],
})

const library_schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: false,
        default: null,
    },
    active: {
        type: Boolean,
        default: true,
    },
    premium: {
        type: Boolean,
        default: false,
    },
    muscle_groups: [muscle_group_schema],
}, {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
})

library_schema.virtual('image_url').get(function () {
    if (!this.image) {
        return null
    }

    if (this.image.startsWith('http')) {
        return this.image
    }

    return `${process.env.BASE_URL}${this.image}`
})

library_schema.plugin(mongooseLeanVirtuals)

export default mongoose.model('Library', library_schema)
