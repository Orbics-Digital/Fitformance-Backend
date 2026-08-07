import Joi from 'joi'
import mongoose from 'mongoose'
import { ENUM_PROFILE_STATUS, ENUM_REHAB_TYPES, ENUM_ROLES, LIBRARY, PROTOCOLS, ROLES } from '../utils/index.js'

const PROTOCOL_IDS = PROTOCOLS.map(item => item.id)
const LIBRARY_IDS = LIBRARY.map(item => item.id)
const ALL_CATEGORY_IDS = [...PROTOCOL_IDS, ...LIBRARY_IDS]

export const SIGNUP_VALIDATOR = Joi.object({

    role: Joi.string()
        .valid(...ENUM_ROLES)
        .default(ROLES.USER),

    name: Joi.string().min(2).max(50)
        .required()
        .messages({
            'any.required': 'Name is required.',
            'string.empty': 'Name cannot be empty.',
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 50 characters.'
        }),

    email: Joi.string().email()
        .required()
        .messages({
            'any.required': 'Email is required.',
            'string.empty': 'Email cannot be empty.',
            'string.email': 'Please enter a valid email.'
        }),

    password: Joi.string().min(6)
        .required()
        .messages({
            'any.required': 'Password is required.',
            'string.empty': 'Password cannot be empty.',
            'string.min': 'Password must be at least 6 characters long.'
        }),

    age: Joi.number()
        .optional()
        .messages({
            'string.empty': 'Age cannot be empty.'
        }),

    injury: Joi.string().when("role", {
        is: ROLES.THERAPIST,
        then: Joi.optional(),
        otherwise: Joi.required().messages({
            "any.required": "Functional Focus is required.",
            "string.empty": "Functional Focus cannot be empty.",
        }),
    }),

    country_code: Joi.string()
        .required()
        .messages({
            'any.required': 'Country code is required.',
            'string.empty': 'Country code cannot be empty.'
        }),

    dialing_code: Joi.string()
        .required()
        .messages({
            'any.required': 'Dialing code is required.',
            'string.empty': 'Dialing code cannot be empty.'
        }),

    phone: Joi.string()
        .required()
        .messages({
            'any.required': 'Phone number is required.',
            'string.empty': 'Phone number cannot be empty.'
        }),
})

export const LOGIN_VALIDATOR = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email',
        'string.empty': 'Email is required',
    }),
    password: Joi.string().required().messages({
        'string.empty': 'Password is required',
    }),
    source: Joi.string()
        .valid(...ENUM_ROLES)
        .optional()
        .messages({
            'any.only': `Source must be one of: ${ENUM_ROLES.join(', ')}`
        }),
    device_id: Joi.string().optional().messages({
        'string.base': 'Device ID must be a string',
    }),
})

export const FORGET_PASSWORD_VALIDATOR = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email',
        'string.empty': 'Email is required',
    })
})

export const VERIFY_OTP_VALIDATOR = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email',
        'string.empty': 'Email is required',
    }),
    otp: Joi.string().length(6).required(),
})

export const SET_PASSWORD_VALIDATOR = Joi.object({
    password: Joi.string().min(6).required().messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters long',
    })
})

export const LOGOUT_VALIDATOR = Joi.object({
    device_id: Joi.string().optional().messages({
        'string.base': 'Device ID must be a string'
    })
})

export const CREATE_BET_VALIDATOR = Joi.object({
    title: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Title is required.',
            'string.empty': 'Title cannot be empty.',
            'string.min': 'Title must be at least 2 characters long.',
            'string.max': 'Title cannot exceed 100 characters.'
        }),

    description: Joi.string()
        .optional()
        .allow('')
        .messages({
            'string.empty': 'Description cannot be empty.'
        }),

    amount: Joi.number().min(1)
        .required()
        .messages({
            'any.required': 'Amount is required.',
            'number.base': 'Amount must be a number.',
            'number.min': 'Amount must be at least 1.'
        }),

    question: Joi.string().required().messages({
        'any.required': 'Question is required.',
        'string.empty': 'Question cannot be empty.'
    }),

    options: Joi.array().items(
        Joi.object({
            text: Joi.string().required().messages({
                'any.required': 'Option text is required.',
                'string.empty': 'Option text cannot be empty.'
            })
        })
    ).min(2).required().messages({
        'any.required': 'Options are required.',
        'array.base': 'Options must be an array of objects.',
        'array.min': 'At least 2 options are required.'
    }),

    invited_participants: Joi.array().items(
        Joi.object({
            user: Joi.string()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.message(`Invalid user ID: ${value}`)
                    }
                    return value
                })
                .required()
                .messages({
                    'any.required': 'Participant user ID is required.'
                })
        })
    )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one participant is required.',
            'any.required': 'Invited participants are required.'
        }),

    date: Joi.string()
        .trim()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
            'any.required': 'Bet date is required.',
            'string.pattern.base': 'Date must be in YYYY-MM-DD format.',
        }),

    start_time: Joi.string()
        .trim()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required()
        .custom((value, helpers) => {

            const { date } = helpers.state.ancestors[0]

            const start_time = new Date(`${date}T${value}:00`)

            if (isNaN(start_time.getTime())) {
                return helpers.message('Start time is invalid.')
            }

            if (start_time <= new Date()) {
                return helpers.message('Start time must be in the future.')
            }

            return value

        })
        .messages({
            'any.required': 'Start time is required.',
            'string.pattern.base': 'Start time must be in HH:mm format (24-hour).',
        }),

    end_time: Joi.string()
        .trim()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required()
        .custom((value, helpers) => {

            let { date, start_time } = helpers.state.ancestors[0]

            start_time = new Date(`${date}T${start_time}:00`)
            const end_time = new Date(`${date}T${value}:00`)

            if (isNaN(end_time.getTime())) {
                return helpers.message('End time is invalid.')
            }

            if (end_time <= start_time) {
                return helpers.message('End time must be after start time.')
            }

            return value

        })
        .messages({
            'any.required': 'End time is required.',
            'string.pattern.base': 'End time must be in HH:mm format (24-hour).',
        }),
})

export const PARTICIPATE_BET_VALIDATOR = Joi.object({
    option_id: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid option ID: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': 'Option ID is required.',
            'string.empty': 'Option ID cannot be empty.'
        })
})

export const SET_WINNER_VALIDATOR = Joi.object({
    correct_option: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid correct option ID: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': 'Correct option ID is required.',
            'string.empty': 'Correct option ID cannot be empty.'
        })
})

export const CREATE_FEEDBACK_VALIDATOR = Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
        'any.required': 'Name is required.',
        'string.empty': 'Name cannot be empty.'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email',
        'any.required': 'Email is required.'
    }),
    subject: Joi.string().min(3).max(150).required().messages({
        'any.required': 'Subject is required.',
        'string.empty': 'Subject cannot be empty.'
    }),
    message: Joi.string().min(5).max(1000).required().messages({
        'any.required': 'Message is required.',
        'string.empty': 'Message cannot be empty.'
    })
})

export const CHANGE_PASSWORD_VALIDATOR = Joi.object({
    old_password: Joi.string().min(6).required().messages({
        "any.required": "Old password is required."
    }),
    password: Joi.string().min(6).required().messages({
        'string.empty': 'New password is required',
        'string.min': 'Password must be at least 6 characters long',
    })
})

export const UPDATE_PROFILE_VALIDATOR = Joi.object({
    name: Joi.string()
        .min(2)
        .max(50)
        .messages({
            "string.empty": "Name cannot be empty.",
            "string.min": "Name must be at least 2 characters long.",
            "string.max": "Name cannot exceed 50 characters.",
        })
        .optional(),

    country_code: Joi.string()
        .messages({ "string.empty": "Country code cannot be empty." })
        .optional(),

    dialing_code: Joi.string()
        .messages({ "string.empty": "Dialing code cannot be empty." })
        .optional(),

    phone: Joi.string()
        .messages({ "string.empty": "Phone number cannot be empty." })
        .optional(),

    age: Joi.number().optional(),

    role: Joi.string().default("user"),

    injury: Joi.string()
        .when("role", {
            is: "user",
            then: Joi.required().messages({
                "string.empty": "Functional Focus cannot be empty.",
                "any.required": "Functional Focus is required for users.",
            }),
            otherwise: Joi.optional(),
        }),
})

export const CREATE_REHAB_VALIDATOR = Joi.object({
    title: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Title is required.',
            'string.empty': 'Title cannot be empty.',
            'string.min': 'Title must be at least 2 characters long.',
            'string.max': 'Title cannot exceed 100 characters.'
        }),

    description: Joi.string()
        .trim()
        .min(5)
        .max(1000)
        .required()
        .messages({
            'any.required': 'Description is required.',
            'string.empty': 'Description cannot be empty.',
            'string.min': 'Description must be at least 5 characters long.',
            'string.max': 'Description cannot exceed 1000 characters.',
        }),
})

export const CREATE_PLAN_VALIDATOR = Joi.object({
    user: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid User ID: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': 'User ID is required.',
            'string.empty': 'User ID cannot be empty.'
        }),

    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'any.required': 'Exercise name is required.',
            'string.empty': 'Exercise name cannot be empty.',
            'string.min': 'Exercise name must be at least 2 characters long.',
            'string.max': 'Exercise name cannot exceed 100 characters.'
        }),

    notes: Joi.string()
        .trim()
        .min(5)
        .max(1000)
        .required()
        .messages({
            'any.required': 'Notes are required.',
            'string.empty': 'Notes cannot be empty.',
            'string.min': 'Notes must be at least 5 characters long.',
            'string.max': 'Notes cannot exceed 1000 characters.'
        }),

    exercises: Joi.array()
        .items(
            Joi.object({
                rehab: Joi.string()
                    .required()
                    .custom((value, helpers) => {
                        if (!mongoose.Types.ObjectId.isValid(value)) {
                            return helpers.message(`Invalid Rehab ID: ${value}`)
                        }
                        return value
                    })
                    .messages({
                        'any.required': 'Rehab ID is required.',
                        'string.empty': 'Rehab ID cannot be empty.'
                    }),
                notes: Joi.string()
                    .trim()
                    .min(5)
                    .max(1000)
                    .required()
                    .messages({
                        'any.required': 'Exercise notes are required.',
                        'string.empty': 'Exercise notes cannot be empty.',
                        'string.min': 'Exercise notes must be at least 5 characters long.',
                        'string.max': 'Exercise notes cannot exceed 1000 characters.'
                    })
            })
        )
        .min(1)
        .required()
        .messages({
            'any.required': 'Exercises are required.',
            'array.min': 'At least one exercise must be added to the plan.',
            'array.base': 'Exercises must be an array.'
        }),

})

export const CREATE_PACKAGE_VALIDATOR = Joi.object({
    name: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Name is required.',
            'string.empty': 'Name cannot be empty.',
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 100 characters.'
        }),

    description: Joi.string()
        .trim()
        .min(5)
        .max(1000)
        .required()
        .messages({
            'any.required': 'Description is required.',
            'string.empty': 'Description cannot be empty.',
            'string.min': 'Description must be at least 5 characters long.',
            'string.max': 'Description cannot exceed 1000 characters.',
        }),

    amount: Joi.number().positive()
        .required()
        .messages({
            'any.required': 'Amount is required',
            'number.base': 'Amount must be a number',
            'number.positive': 'Amount must be greater than 0'
        }),

    interval: Joi.string()
        .valid('month', 'year')
        .required()
        .messages({
            'any.required': 'Interval is required.',
            'string.empty': 'Interval cannot be empty.',
            'any.only': 'Interval must be one of: month, year.'
        }),
    protocols: Joi.array()
        .items(
            Joi.string()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid')
                    }
                    return value
                })
                .messages({
                    'any.invalid': 'Invalid protocol ID'
                })
        )
        .min(1)
        .required()
        .messages({
            'array.base': 'Protocols must be an array.',
            'array.min': 'At least one protocol is required.',
            'any.required': 'Protocols are required.'
        }),

    library: Joi.array()
        .items(
            Joi.string()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid')
                    }
                    return value
                })
                .messages({
                    'any.invalid': 'Invalid library ID'
                })
        )
        .min(1)
        .required()
        .messages({
            'array.base': 'Library must be an array.',
            'array.min': 'At least one library item is required.',
            'any.required': 'Library is required.'
        }),

})

export const CREATE_REMINDER_VALIDATOR = Joi.object({
    title: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Title is required.',
            'string.empty': 'Title cannot be empty.',
            'string.min': 'Title must be at least 2 characters long.',
            'string.max': 'Title cannot exceed 100 characters.'
        }),

    message: Joi.string()
        .trim()
        .min(5)
        .max(1000)
        .required()
        .messages({
            'any.required': 'Message is required.',
            'string.empty': 'Message cannot be empty.',
            'string.min': 'Message must be at least 5 characters long.',
            'string.max': 'Message cannot exceed 1000 characters.',
        }),

    user: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid user ID: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': 'suer ID is required.',
            'string.empty': 'suer ID cannot be empty.'
        })

})

export const ASSIGN_THERAPIST_VALIDATOR = Joi.object({
    therapist: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid Therapist ID: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': 'Therapist ID is required.',
            'string.empty': 'Therapist ID cannot be empty.'
        }),
    user: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid user ID: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': 'User ID is required.',
            'string.empty': 'User ID cannot be empty.'
        })

})

export const UPDATE_STATUS_VALIDATOR = Joi.object({
    status: Joi.string()
        .valid(...ENUM_PROFILE_STATUS)
        .required()
        .messages({
            'any.only': `Invalid status. Allowed values: ${ENUM_PROFILE_STATUS.join(', ')}`,
            'any.required': 'Status is required.',
        })
})

export const CREATE_CATEGORY_VALIDATOR = Joi.object({
    name: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Name is required.',
            'string.empty': 'Name cannot be empty.',
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 100 characters.'
        }),

    type: Joi.string()
        .valid(...ENUM_REHAB_TYPES)
        .required()
        .messages({
            'any.required': 'Type is required.',
            'string.empty': 'Type cannot be empty.',
            'any.only': `Type must be one of: ${ENUM_REHAB_TYPES.join(', ')}`
        }),

})

export const UPDATE_CATEGORY_VALIDATOR = Joi.object({
    name: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Name is required.',
            'string.empty': 'Name cannot be empty.',
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 100 characters.'
        }),
})

const objectId = (label) =>
    Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.message(`Invalid ${label}: ${value}`)
            }
            return value
        })
        .messages({
            'any.required': `${label} is required.`,
            'string.empty': `${label} cannot be empty.`,
        })

const nameField = Joi.string().min(2).max(100)
    .required()
    .messages({
        'any.required': 'Name is required.',
        'string.empty': 'Name cannot be empty.',
        'string.min': 'Name must be at least 2 characters long.',
        'string.max': 'Name cannot exceed 100 characters.',
    })

const optionalNameField = Joi.string().min(2).max(100)
    .optional()
    .messages({
        'string.empty': 'Name cannot be empty.',
        'string.min': 'Name must be at least 2 characters long.',
        'string.max': 'Name cannot exceed 100 characters.',
    })

const exerciseIdsField = Joi.array()
    .items(
        Joi.string()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.message(`Invalid exercise ID: ${value}`)
                }
                return value
            })
    )
    .required()
    .messages({
        'any.required': 'Exercise IDs are required.',
        'array.base': 'Exercise IDs must be an array.',
    })

// Library
export const CREATE_LIBRARY_VALIDATOR = Joi.object({
    name: nameField,
})

export const UPDATE_LIBRARY_VALIDATOR = Joi.object({
    name: nameField,
})

export const CREATE_MUSCLE_GROUP_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    name: nameField,
})

export const UPDATE_MUSCLE_GROUP_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    muscle_group_id: objectId('Muscle group ID'),
    name: nameField,
})

export const CREATE_LIBRARY_CATEGORY_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    muscle_group_id: objectId('Muscle group ID'),
    name: nameField,
})

export const UPDATE_LIBRARY_CATEGORY_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    muscle_group_id: objectId('Muscle group ID'),
    category_id: objectId('Category ID'),
    name: nameField,
})

export const SET_LIBRARY_EXERCISES_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    muscle_group_id: objectId('Muscle group ID'),
    category_id: objectId('Category ID'),
    exercise_ids: exerciseIdsField,
})

// Protocol
export const CREATE_PROTOCOL_VALIDATOR = Joi.object({
    name: nameField,
})

export const UPDATE_PROTOCOL_VALIDATOR = Joi.object({
    name: nameField,
})

export const CREATE_PROTOCOL_CONDITION_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    name: nameField,
    type: Joi.string().min(2).max(100)
        .required()
        .messages({
            'any.required': 'Type is required.',
            'string.empty': 'Type cannot be empty.',
            'string.min': 'Type must be at least 2 characters long.',
            'string.max': 'Type cannot exceed 100 characters.',
        }),
})

export const UPDATE_PROTOCOL_CONDITION_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    condition_id: objectId('Condition ID'),
    name: optionalNameField,
    type: Joi.string().min(2).max(100)
        .optional()
        .messages({
            'string.empty': 'Type cannot be empty.',
            'string.min': 'Type must be at least 2 characters long.',
            'string.max': 'Type cannot exceed 100 characters.',
        }),
}).or('name', 'type')

export const CREATE_PROTOCOL_WEEK_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    condition_id: objectId('Condition ID'),
    label: Joi.string().min(1).max(100)
        .required()
        .messages({
            'any.required': 'Label is required.',
            'string.empty': 'Label cannot be empty.',
            'string.min': 'Label must be at least 1 character long.',
            'string.max': 'Label cannot exceed 100 characters.',
        }),
    sub: Joi.string().max(200)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Sub cannot exceed 200 characters.',
        }),
})

export const UPDATE_PROTOCOL_WEEK_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    condition_id: objectId('Condition ID'),
    week_id: objectId('Week ID'),
    label: Joi.string().min(1).max(100)
        .optional()
        .messages({
            'string.empty': 'Label cannot be empty.',
            'string.min': 'Label must be at least 1 character long.',
            'string.max': 'Label cannot exceed 100 characters.',
        }),
    sub: Joi.string().max(200)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Sub cannot exceed 200 characters.',
        }),
}).or('label', 'sub')

export const SET_PROTOCOL_WEEK_EXERCISES_VALIDATOR = Joi.object({
    region_id: objectId('Region ID'),
    condition_id: objectId('Condition ID'),
    week_id: objectId('Week ID'),
    exercise_ids: exerciseIdsField,
})