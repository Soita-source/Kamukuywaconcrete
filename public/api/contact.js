import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { name, email, phone, product, quantity, deliveryDate, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'soitabrian00@gmail.com',
        subject: `New Order: ${product || 'Enquiry'}`,
        text: `
You have received a new message.

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Product: ${product || 'Not specified'}
Quantity: ${quantity || 'Not specified'}
Delivery Date: ${deliveryDate || 'Not specified'}

Message:
${message}
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'Message sent successfully!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to send message.' });
    }
}