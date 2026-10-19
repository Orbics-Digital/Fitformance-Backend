import dotenv from 'dotenv'
import mongoose from 'mongoose'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'

dotenv.config()

const protocol_week_schema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
    },
    sub: {
        type: String,
        required: false,
    },
    exercise_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise',
    }],
})

const protocol_condition_schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    weeks: [protocol_week_schema],
})

const protocol_schema = new mongoose.Schema({
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
    conditions: [protocol_condition_schema],
}, {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
})

protocol_schema.virtual('image_url').get(function () {
    if (!this.image) {
        return null
    }

    if (this.image.startsWith('http')) {
        return this.image
    }

    return `${process.env.BASE_URL}${this.image}`
})

protocol_schema.plugin(mongooseLeanVirtuals)

export default mongoose.model('Protocol', protocol_schema)
