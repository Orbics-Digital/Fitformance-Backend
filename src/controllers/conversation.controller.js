import logger from "../config/logger.js"
import Conversation from "../models/conversation.model.js"
import Message from "../models//message.model.js"
import User from "../models/user.model.js"
import { sendNotification } from "../helpers/notification.js"
import { getIO } from "../helpers/socket.js"

const notifyParticipants = async (conversation, message, sender_id) => {

    const recipients = conversation.participants
        .map(id => id.toString())
        .filter(id => id !== sender_id.toString())

    if (!recipients.length) return

    const sender = await User.findById(sender_id).select("_id name image")
    const conversation_id = conversation._id.toString()

    // Live update for anyone who has the app or portal open.
    try {
        const io = getIO()
        const payload = {
            conversation: conversation_id,
            message: { ...message.toObject(), sender: sender?.toObject() || { _id: sender_id } }
        }
        recipients.forEach(id => io.to(id).emit("new_message", payload))
    } catch (error) {
        logger.warn(`Socket emit skipped: ${error.message}`)
    }

    const preview = (message.content || "").trim()

    // Push only: saving every chat message would flood the notifications list.
    await sendNotification({
        title: `New message from ${sender?.name || "your contact"}`,
        message: preview.length > 120 ? `${preview.slice(0, 117)}...` : (preview || "You have a new message."),
        metadata: { type: "message", id: conversation_id, title: sender?.name || "" },
        user_ids: recipients,
        save: false
    })

}

export const getConversations = async (req, res, next) => {
    try {

        const { decoded } = req

        let filter = {
            participants: { $in: [decoded.id] }
        }

        let conversations = await Conversation.find(filter)
            .populate("participants", "name image")
            .populate({
                path: "last_message",
                select: "content type createdAt sender",
                populate: {
                    path: "sender",
                    select: "_id"
                }
            })
            .sort({ updatedAt: -1 })

        conversations = conversations.map(item => ({
            ...item.toObject(),
            participants: item.participants.filter(item => item._id.toString() !== decoded.id)
        }))

        logger.info(`Conversations fetched | User: ${decoded.id}`)

        return res.status(200).json({
            success: true,
            message: "Conversations fetched successfully.",
            data: conversations
        })
    } catch (error) {
        logger.error(`Get Conversations Error: ${error.message}`)
        next(error)
    }
}

export const getConversationById = async (req, res, next) => {
    try {

        const { decoded } = req
        const { id } = req.params

        let conversation = await Conversation.findOne({
            _id: id,
            participants: { $in: [decoded.id] }
        })
            .populate("participants", "name image")
            .lean()

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found."
            })
        }

        const messages = await Message.find({ conversation: id }).populate("sender", "_id name image").sort({ createdAt: 1 })

        logger.info(`Conversation with messages fetched | User: ${decoded.id} | Conversation: ${id}`)

        return res.status(200).json({
            success: true,
            message: "Conversation and messages fetched successfully.",
            data: {
                ...conversation,
                messages
            }
        })

    } catch (error) {
        logger.error(`Get Conversation By ID Error: ${error.message}`)
        next(error)
    }
}

export const sendMessage = async (req, res, next) => {
    try {

        const { body, decoded, params } = req
        const { content, type } = body

        const conversation = await Conversation.findOne({ _id: params.id, participants: { $in: [decoded.id] } })

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found."
            })
        }

        const message = await Message.create({
            conversation: conversation._id,
            sender: decoded.id,
            content,
            type,
            read_by: [decoded.id]
        })

        conversation.last_message = message._id
        await conversation.save()

        logger.info(
            `Message sent | Conversation: ${conversation._id} | Sender: ${decoded.id}`
        )

        // Tell the other participants. A failed notification must not fail the request.
        notifyParticipants(conversation, message, decoded.id)
            .catch(error => logger.error(`Message notification error: ${error.message}`))

        return res.status(201).json({
            success: true,
            message: "Message sent successfully.",
            data: message
        })

    } catch (error) {
        logger.error(`Send Message Error: ${error.message}`)
        next(error)
    }
}
