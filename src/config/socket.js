import { verifyToken } from '../helpers/token.js'
import logger from './logger.js'

const connectSocket = async (io) => {
    try {

        io.on('connection', async (socket) => {
            try {

                const raw = socket.handshake.query?.token || ''
                const token = String(raw).split(' ').pop()
                const decoded = token ? await verifyToken(token) : null

                if (!decoded?.id) {
                    socket.disconnect(true)
                    return
                }

                socket.user_id = decoded.id

                // Each user joins a room named after their id so the server can reach all of their open sessions.
                socket.join(String(decoded.id))

                logger.info(`Socket connected | Socket: ${socket.id} | User: ${socket.user_id}`)

            } catch (error) {
                logger.warn(`Socket auth failed | Socket: ${socket.id} | ${error.message}`)
                socket.disconnect(true)
            }
        })

    } catch (e) {
        logger.error("Error while connecting to Sockets", e)
    }
}

export default connectSocket
