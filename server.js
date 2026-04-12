require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 30001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve files from 'public' folder

// --- EMAIL CONFIGURATION ---
// IMPORTANT: For Gmail, you must use an App Password, not your login password.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // e.g., 'yourname@gmail.com'
        pass: process.env.EMAIL_PASS  // e.g., '16-char App Password'
    }
});

// --- ROUTES ---

// 1. Serve Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Contact Form API (Receives data from Frontend)
app.post('/api/contact', async (req, res) => {
    // 1. Extract data from the request body
    const { name, email, phone, product, quantity, deliveryDate, message } = req.body;

    console.log(`[New Enquiry] From: ${name} | Product: ${product}`);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'soitabrian00@gmail.com',
        subject: `New Order: ${product || 'Enquiry'}`,
        text: `
            You have received a new message from the Kamukuywa Concrete Website.

            Name: ${name}
            Email: ${email}
            Phone: ${phone || 'Not provided'}

            --- Order Details ---
            Product: ${product || 'Not specified'}
            Quantity: ${quantity || 'Not specified'}
            Delivery Date: ${deliveryDate || 'Not specified'}

            Message:
            ${message}
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('[Success] Email sent to client.');
        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('[Error] Email failed to send:', error);
        res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
});
// 3. Health Check (Good for Vercel monitoring)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});


