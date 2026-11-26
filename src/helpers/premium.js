import logger from "../config/logger.js"
import Library from "../models/library.model.js"
import Plan from "../models/plan.model.js"
import Protocol from "../models/protocol.model.js"
import { ROLES } from "../utils/index.js"
import { getActiveSubscription } from "./stripe.js"
import { getCachedSubscription, rememberSubscription } from "./subscriptionCache.js"

export const hasActiveSubscription = async (user_id) => {

    const cached = getCachedSubscription(user_id)
    if (cached !== undefined) return cached

    let value = false
    try {
        value = Boolean(await getActiveSubscription(user_id))
    } catch (error) {
        // Same as login and profile: if Stripe can't be reached, treat the user as not subscribed.
        logger.error(`Active subscription check failed: ${error.message}`)
    }

    rememberSubscription(user_id, value)
    return value

}

const collectIds = (target, ids = []) => ids.forEach(id => target.add(String(id)))

const libraryExerciseIds = (library, target) =>
    (library.muscle_groups || []).forEach(group =>
        (group.categories || []).forEach(category => collectIds(target, category.exercise_ids)))

const protocolExerciseIds = (protocol, target) =>
    (protocol.conditions || []).forEach(condition =>
        (condition.weeks || []).forEach(week => collectIds(target, week.exercise_ids)))

// Exercise ids a patient may not open: those in an active premium library or protocol,
// unless the patient is subscribed, the exercise is also in a free program,
// or a practitioner put it in one of the patient's plans.
// Practitioners and admins are never restricted.
export const getLockedExerciseIds = async (decoded) => {

    const locked = new Set()

    if (decoded?.role !== ROLES.USER) return locked
    if (await hasActiveSubscription(decoded.id)) return locked

    const [libraries, protocols, plans] = await Promise.all([
        Library.find({ active: { $ne: false } }).select("premium muscle_groups.categories.exercise_ids").lean(),
        Protocol.find({ active: { $ne: false } }).select("premium conditions.weeks.exercise_ids").lean(),
        Plan.find({ user: decoded.id }).select("exercises.rehab").lean(),
    ])

    const free = new Set()

    libraries.forEach(library => libraryExerciseIds(library, library.premium ? locked : free))
    protocols.forEach(protocol => protocolExerciseIds(protocol, protocol.premium ? locked : free))
    plans.forEach(plan => collectIds(free, (plan.exercises || []).map(item => item.rehab)))

    free.forEach(id => locked.delete(id))

    return locked

}
