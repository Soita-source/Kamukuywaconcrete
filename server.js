require('dotenv').config();


const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== PASTE YOUR CREDENTIALS HERE =====
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const SHORTCODE = process.env.SHORTCODE;
const PASSKEY = process.env.PASSKEY;
// =======================================

let CALLBACK_URL = 'process.env.CALLBACK_URL';
const BASE_URL = 'https://sandbox.safaricom.co.ke';

async function getAccessToken() {
    const auth = Buffer.from(CONSUMER_KEY + ':' + CONSUMER_SECRET).toString('base64');
    const res = await axios.get(
        BASE_URL + '/oauth/v1/generate?grant_type=client_credentials',
        { headers: { Authorization: 'Basic ' + auth } }
    );
    return res.data.access_token;
}

app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        const { phone, amount, orderId } = req.body;
        let msisdn = phone.replace(/[^0-9]/g, '');
        if (!msisdn.startsWith('254')) msisdn = '254' + msisdn;

        const token = await getAccessToken();
        const timestamp = new Date().toISOString().replace(/[-T:.\Z]/g, '').slice(0, 14);
        const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

        const stkRes = await axios.post(
            BASE_URL + '/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount),
                PartyA: msisdn,
                PartyB: SHORTCODE,
                PhoneNumber: msisdn,
                CallBackURL: CALLBACK_URL,
                AccountReference: orderId.substring(0, 12),
                TransactionDesc: 'JengaMaterials'
            },
            { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
        );

        console.log('STK Response:', JSON.stringify(stkRes.data, null, 2));

        if (stkRes.data.ResponseCode === '0') {
            res.json({ success: true, CheckoutRequestID: stkRes.data.CheckoutRequestID, message: 'STK Push sent' });
        } else {
            res.json({ success: false, message: stkRes.data.ResponseDescription });
        }
    } catch (err) {
        console.error('STK Error:', err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/mpesa/callback', (req, res) => {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    console.log('\n🔔 CALLBACK:', JSON.stringify(req.body, null, 2));
    const cb = req.body.Body?.stkCallback;
    if (cb?.ResultCode === 0) {
        const items = cb.CallbackMetadata?.Item || [];
        const data = {};
        items.forEach(i => { data[i.Name] = i.Value; });
        console.log('✅ SUCCESS - Receipt:', data.MpesaReceiptNo, 'Amount:', data.Amount);
    } else {
        console.log('❌ FAILED:', cb?.ResultDesc);
    }
});

app.post('/api/mpesa/status', async (req, res) => {
    try {
        const { CheckoutRequestID } = req.body;
        const token = await getAccessToken();
        const timestamp = new Date().toISOString().replace(/[-T:.\Z]/g, '').slice(0, 14);
        const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');
        const queryRes = await axios.post(
            BASE_URL + '/mpesa/stkpushquery/v1/query',
            { BusinessShortCode: SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID },
            { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
        );
        res.json(queryRes.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('✅ Server running at http://localhost:3000'));

