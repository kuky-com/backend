"use strict";

const express = require("express");
const admin = require("@controllers/admin");
const router = express.Router();
const authMiddleware = require('../milddleware/authMiddleware');
const multer = require("multer");
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const uploadDir = path.join(process.cwd(), 'uploads');
const upload = multer({ dest: uploadDir });

router.post('/check-suggestion', (request, response, next) => {
    const { to_email, suggest_email } = request.body

    if (!to_email || !suggest_email) {
        return response.json({
            success: false,
            message: "Missing required params: to_email, suggest_email"
        })
    }

    return admin.checkSuggestion({ ...request.body }).then(({data, message}) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})


router.post('/send-suggestion', (request, response, next) => {
    const { to_email, suggest_email } = request.body

    if (!to_email || !suggest_email) {
        return response.json({
            success: false,
            message: "Missing required params: to_email, suggest_email"
        })
    }

    return admin.sendSuggestion({ ...request.body }).then(({data, message}) => {
        return response.json({
            success: true,
            data: data,
            message: message
        })
    })
        .catch((error) => {
            return response.json({
                success: false,
                message: `${error}`
            })
        })
})

router.post('/add-users', upload.single('file'), (request, response, next) => {
    if (!request.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        
        const filePath = request.file.path
        const workbook = XLSX.readFile(filePath);

        const sheetNames = workbook.SheetNames;

        const usersData = []

        sheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const rawUsers = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            for(let index = 1; index < rawUsers.length; index++) {
                const item = rawUsers[index]
                usersData.push({platform: item[11], email: item[13], gender: item[16], location: item[15], purpose: item[12], full_name: item[14]})
            }
        });

        fs.unlinkSync(filePath);

        return admin.createLeadUsers(usersData).then(({data, message}) => {
            return response.json({
                success: true,
                data: data,
                message: message
            })
        })
            .catch((error) => {
                return response.json({
                    success: false,
                    message: `${error}`
                })
            })
    } catch (error) {
        return response.json({
            success: false,
            message: `${error}`
        })
    }
})

module.exports = router;