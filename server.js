require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const SHORTCODE = process.env.SHORTCODE;
const PASSKEY = process.env.PASSKEY;
const CALLBACK_URL = process.env.CALLBACK_URL;
const BASE_URL = 'https://sandbox.safaricom.co.ke';

function normalizeKenyanPhone(phone = '') {
    const digits = String(phone).replace(/\D/g, '');

    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
    if (digits.startsWith('7') && digits.length === 9) return '254' + digits;

    throw new Error('Use a valid Safaricom number in the format 07XXXXXXXX or 7XXXXXXXX.');
}

function getTimestamp() {
    return new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

function getPassword(timestamp) {
    return Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');
}

function getAxiosErrorMessage(err) {
    return (
        err.response?.data?.errorMessage ||
        err.response?.data?.ResponseDescription ||
        err.response?.data?.errorCode ||
        err.message
    );
}

async function getAccessToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const res = await axios.get(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return res.data.access_token;
}

app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        const { phone, amount, orderId } = req.body;
        const msisdn = normalizeKenyanPhone(phone);
        const token = await getAccessToken();
        const timestamp = getTimestamp();
        const password = getPassword(timestamp);

        const stkRes = await axios.post(
            `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(Number(amount)),
                PartyA: msisdn,
                PartyB: SHORTCODE,
                PhoneNumber: msisdn,
                CallBackURL: CALLBACK_URL,
                AccountReference: String(orderId || 'ORDER').slice(0, 12),
                TransactionDesc: 'JengaMaterials'
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('STK Response:', JSON.stringify(stkRes.data, null, 2));

        if (stkRes.data.ResponseCode === '0') {
            return res.json({
                success: true,
                CheckoutRequestID: stkRes.data.CheckoutRequestID,
                message: 'STK Push sent'
            });
        }

        return res.json({
            success: false,
            message: stkRes.data.ResponseDescription || 'Failed to send STK push'
        });
    } catch (err) {
        const errorMessage = getAxiosErrorMessage(err);
        console.error('STK Error:', err.response?.data || err.message);
        return res.status(500).json({ success: false, message: errorMessage });
    }
});

function handleMpesaCallback(req, res) {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    console.log('\nM-Pesa callback:', JSON.stringify(req.body, null, 2));
    const cb = req.body.Body?.stkCallback;

    if (cb?.ResultCode === 0) {
        const items = cb.CallbackMetadata?.Item || [];
        const data = {};
        items.forEach((item) => {
            data[item.Name] = item.Value;
        });
        console.log('Payment success - Receipt:', data.MpesaReceiptNo, 'Amount:', data.Amount);
        return;
    }

    console.log('Payment failed:', cb?.ResultDesc);
}

app.post('/api/mpesa/callback', handleMpesaCallback);
app.post('/mpesa/callback', handleMpesaCallback);

app.post('/api/mpesa/status', async (req, res) => {
    try {
        const { CheckoutRequestID } = req.body;
        const token = await getAccessToken();
        const timestamp = getTimestamp();
        const password = getPassword(timestamp);

        const queryRes = await axios.post(
            `${BASE_URL}/mpesa/stkpushquery/v1/query`,
            {
                BusinessShortCode: SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return res.json(queryRes.data);
    } catch (err) {
        return res.status(500).json({ error: getAxiosErrorMessage(err) });
    }
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');

    if (!CALLBACK_URL) {
        console.warn('CALLBACK_URL is missing. STK push callbacks will fail.');
    } else if (/localhost|127\.0\.0\.1/i.test(CALLBACK_URL)) {
        console.warn('CALLBACK_URL points to localhost. Safaricom cannot reach your machine from the internet.');
    }
});
