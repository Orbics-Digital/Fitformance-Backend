import fs from 'fs'
import path from 'path'
import logger from '../config/logger.js'

export const makeFolders = () => {

    const base_path = path.resolve('uploads')
    const sub_folders = ['user', 'rehab', 'user_documents']

    if (!fs.existsSync(base_path)) {
        fs.mkdirSync(base_path, { recursive: true })
    }

    sub_folders.forEach(folder => {
        const dirPath = path.join(base_path, folder)
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }
    })

}

export const removeFiles = (files) => {
    try {

        if (!files) return

        const fileArray = Array.isArray(files) ? files : [files]

        for (const file of fileArray) {

            if (!file || typeof file !== "string") continue

            if (!file.includes("uploads/")) {
                logger.warn(`Skipped deleting file outside uploads folder: ${file}`)
                continue
            }

            const file_path = path.resolve(file)

            if (fs.existsSync(file_path)) {
                fs.unlinkSync(file_path)
            }
        }

    } catch (error) {
        logger.error(`File deletion error: ${error.message}`)
    }
}