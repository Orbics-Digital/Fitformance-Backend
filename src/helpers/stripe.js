import dotenv from 'dotenv'
import Stripe from 'stripe'
import User from '../models/user.model.js'
import { sendNotification } from './notification.js'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })

export const webhook = async (req, res) => {

    let event

    try {
        const sig = req.headers["stripe-signature"]
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_KEY)
    } catch (err) {
        console.error("⚠️ Webhook signature verification failed.", err.message)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    if (event.type === 'checkout.session.completed') {

        const session = event.data.object
        const user = await User.findOne({ stripe_customer_id: session.customer })

        if (user) {

            await sendNotification({
                save: true,
                title: 'Payment Successful',
                message: `Your payment of $${(session.amount_total / 100).toFixed(2)} was successful!`,
                user_ids: [user._id],
                metadata: { type: 'payment' },
                push: true
            })

        }

    }

    return res.json({ received: true })

}

export const createPackage = async ({ name, description, amount, interval = 'month', currency = 'usd' }) => {

    const unit_amount = Math.round(amount * 100)

    const product = await stripe.products.create({ name, description })

    const price = await stripe.prices.create({
        unit_amount,
        currency,
        recurring: { interval },
        product: product.id
    })

    const data = {
        name: product.name,
        description: product.description,
        amount: price.unit_amount / 100,
        interval: price.recurring.interval,
        currency: price.currency,
        product_id: product.id,
        id: price.id
    }

    return data

}

export const getAllPackages = async (filters = {}) => {

    let prices = await stripe.prices.list({ limit: 100, expand: ['data.product'], ...filters })

    const packages = prices.data.sort(
        (a, b) => a.created - b.created
    ).map(price => {

        const product = price.product

        return {
            product_id: product.id,
            id: price.id,
            name: product.name,
            description: product.description,
            amount: price.unit_amount / 100,
            interval: price.recurring.interval,
            currency: price.currency
        }

    })

    return packages

}

export const getPackageDetails = async (id) => {

    if (!id) throw new Error('Id is required')

    const price = await stripe.prices.retrieve(id, { expand: ['product'] })

    if (!price || !price.product) {
        return null
    }

    const product = price.product

    return {
        product_id: product.id,
        id: price.id,
        name: product.name,
        description: product.description || '',
        amount: price.unit_amount / 100,
        interval: price.recurring.interval,
        currency: price.currency
    }

}

export const subscribe = async (id, user_id) => {

    const user = await User.findById(user_id)

    if (!user) throw new Error('User not found')

    let customer_id = user.stripe_customer_id

    if (!customer_id) {

        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
            metadata: {
                user_id: user._id.toString()
            }
        })

        customer_id = customer.id
        user.stripe_customer_id = customer_id
        await user.save()

    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: customer_id,
        line_items: [
            {
                price: id,
                quantity: 1
            }
        ],
        success_url: `${process.env.SUBSCRIPTION_REDIRECT_URL || "https://fitformance.app/subscription"}/success`,
        cancel_url: `${process.env.SUBSCRIPTION_REDIRECT_URL || "https://fitformance.app/subscription"}/cancel`,
    })

    return {
        checkout_url: session.url,
        session_id: session.id
    }
}

export const cancelActiveSubscription = async (user_id) => {

    const user = await User.findById(user_id)
    if (!user) throw new Error('User not found')

    if (!user.stripe_customer_id) {
        throw new Error('User does not have a Stripe customer ID')
    }

    const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active',
        limit: 1
    })

    if (!subscriptions.data.length) {
        throw new Error('No active subscription found for user')
    }

    const active_subscription = subscriptions.data[0]

    const subscription = await stripe.subscriptions.del(active_subscription.id)

    return {
        id: subscription.id,
        status: subscription.status,
        canceled_at: subscription.canceled_at
    }

}

export const getUserSubscriptionLogs = async (id) => {

    const user = await User.findById(id)

    if (!user) throw new Error('User not found')
        
    if (!user.stripe_customer_id) return []

    const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all'
    })

    const result = []

    for (const sub of subscriptions.data) {

        const items = await stripe.subscriptionItems.list({
            subscription: sub.id,
            expand: ['data.price.product']
        })

        for (const item of items.data) {

            const price = item.price
            const product = price.product

            result.push({
                subscribed_on: new Date(sub.start_date * 1000),
                expires_on: new Date(sub.current_period_end * 1000),
                interval: price.recurring?.interval || null,
                amount: price.unit_amount / 100,
                name: product?.name || null
            })
        }
    }

    return result.sort((a, b) => b.subscribed_on - a.subscribed_on)

}

export const toggleAutoRenew = async (id) => {

    const active_subscription = await getActiveSubscription(id)

    if (!active_subscription) {
        throw new Error('No active subscription found for user')
    }

    const subscription = await stripe.subscriptions.update(active_subscription.id, {
        cancel_at_period_end: !active_subscription.cancel_at_period_end
    })

    return {
        id: subscription.id,
        auto_renew: !subscription.cancel_at_period_end,
        current_period_end: new Date(subscription.current_period_end * 1000),
        status: subscription.status
    }

}

export const getActiveSubscription = async (id) => {

    const user = await User.findById(id)

    if (!user) throw new Error('User not found')
    if (!user.stripe_customer_id) throw new Error('User does not have a Stripe customer ID')

    const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active',
        limit: 1
    })

    if (!subscriptions.data.length) return null

    const active_subscription = subscriptions.data[0]

    return {
        id: active_subscription.id,
        product_id: active_subscription.items.data[0].price.product,
        price_id: active_subscription.items.data[0].price.id,
        amount: active_subscription.items.data[0].price.unit_amount / 100,
        currency: active_subscription.items.data[0].price.currency,
        interval: active_subscription.items.data[0].price.recurring.interval,
        subscribed_on: new Date(active_subscription.start_date * 1000),
        current_period_end: new Date(active_subscription.current_period_end * 1000),
        cancel_at_period_end: active_subscription.cancel_at_period_end,
        status: active_subscription.status
    }

}