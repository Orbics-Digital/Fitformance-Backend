// Short-lived cache of whether a user has an active subscription.
// Subscription checks call Stripe, so this keeps list requests fast.
const SUBSCRIPTION_CACHE_MS = 60 * 1000
const cache = new Map()

export const getCachedSubscription = (user_id) => {
    const entry = cache.get(String(user_id))
    return entry && entry.expires > Date.now() ? entry.value : undefined
}

// Store a status that was just read from Stripe (login, profile, premium checks).
export const rememberSubscription = (user_id, value) => {
    cache.set(String(user_id), { value: Boolean(value), expires: Date.now() + SUBSCRIPTION_CACHE_MS })
}

// Call after a payment or cancellation so the change applies straight away.
export const clearSubscriptionCache = (user_id) => {
    cache.delete(String(user_id))
}
