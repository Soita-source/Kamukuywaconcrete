//require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 30001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- EMAIL CONFIGURATION ---
// Simple, direct configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Log immediately to check if values are undefined
console.log('Server Startup - Email User:', process.env.EMAIL_USER);


// ... routes ...

app.post('/api/contact', async (req, res) => {
    console.log("Request received at /api/contact");

    // Check if transporter failed to initialize
    if (!transporter) {
        return res.status(500).json({ success: false, message: "Email service is not configured correctly." });
    }

    const { name, email, phone, product, quantity, deliveryDate, message } = req.body;

    const mailOptions = {
        from: `"Kamukuywa Concrete" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: `New Order: ${product || 'Enquiry'}`,
        text: `
            Name: ${name} (${email})
            Phone: ${phone}
            Product: ${product}
            Qty: ${quantity}
            Date: ${deliveryDate}
            Msg: ${message}
        `
    };

    try {
        // Use a timeout promise in case the SMTP server hangs
        await Promise.race([
            transporter.sendMail(mailOptions),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Email timeout")), 10000))
        ]);
        
        console.log("Email sent successfully");
        res.json({ success: true, message: 'Message sent successfully!' });
        
    } catch (error) {
        console.error("Email Send Error:", error.message);
        // Always return JSON so frontend doesn't crash
        res.status(500).json({ 
            success: false, 
            message: `Failed to send email: ${error.message}` 
        });
    }
});

// ... app.listen ...

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ UNHANDLED ERROR:', err.stack);
    res.status(500).json({ success: false, message: 'Unhandled Server Error' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});