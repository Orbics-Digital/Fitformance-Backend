import mongoose from 'mongoose'

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
})

export default mongoose.model('Library', library_schema)
