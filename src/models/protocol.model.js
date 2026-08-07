import mongoose from 'mongoose'

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
    active: {
        type: Boolean,
        default: true,
    },
    conditions: [protocol_condition_schema],
}, {
    timestamps: true,
    id: false,
})

export default mongoose.model('Protocol', protocol_schema)
