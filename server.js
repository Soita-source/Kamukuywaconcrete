require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const publicDir = path.join(__dirname, 'public');
const imagesDir = path.join(publicDir, 'images');

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const SHORTCODE = process.env.SHORTCODE;
const PASSKEY = process.env.PASSKEY;
const CALLBACK_URL = process.env.CALLBACK_URL;
const BASE_URL = 'https://sandbox.safaricom.co.ke';
const PORT = Number(process.env.PORT) || 3000;
const mpesaTransactions = new Map();
let latestMpesaCallback = null;
const MPESA_STATUS_POLL_WINDOW_MS = 15000;

function normalizeKenyanPhone(phone = '') {
    const digits = String(phone).replace(/\D/g, '');

    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
    if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits;

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

function getRetryDelayMs(statusCode) {
    if (statusCode === 429) return 10000;
    if (statusCode === 403) return 12000;
    return 6000;
}

function extractCallbackMetadata(items = []) {
    const data = {};
    items.forEach((item) => {
        data[item.Name] = item.Value;
    });
    return data;
}

function getCachedTransactionStatus(checkoutRequestId) {
    if (!checkoutRequestId) return null;
    return mpesaTransactions.get(checkoutRequestId) || null;
}

function buildPendingTransaction(checkoutRequestId, overrides = {}) {
    return {
        source: 'status-cache',
        pending: true,
        CheckoutRequestID: checkoutRequestId,
        ResultCode: '4999',
        ResultDesc: 'STK push accepted and waiting for customer action.',
        nextAllowedStatusCheckAt: 0,
        ...overrides
    };
}

async function getAccessToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const res = await axios.get(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return res.data.access_token;
}

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'mpesa-stk-server',
        callbackUrl: CALLBACK_URL || null,
        callbackPathReachable: true
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(imagesDir, 'logo.jpeg'));
});

function callbackVerificationResponse() {
    return {
        ok: true,
        message: 'Callback route is reachable',
        expectedMethod: 'POST',
        callbackUrl: CALLBACK_URL || null
    };
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
            mpesaTransactions.set(stkRes.data.CheckoutRequestID, {
                MerchantRequestID: stkRes.data.MerchantRequestID,
                ...buildPendingTransaction(stkRes.data.CheckoutRequestID, {
                    source: 'initiation'
                })
            });

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
    const callbackData = {
        source: 'callback',
        pending: false,
        MerchantRequestID: cb?.MerchantRequestID,
        CheckoutRequestID: cb?.CheckoutRequestID,
        ResultCode: String(cb?.ResultCode ?? ''),
        ResultDesc: cb?.ResultDesc || 'No callback description received'
    };
    latestMpesaCallback = {
        receivedAt: new Date().toISOString(),
        ...callbackData
    };

    if (cb?.ResultCode === 0) {
        const data = extractCallbackMetadata(cb.CallbackMetadata?.Item || []);
        callbackData.CallbackMetadata = data;
        mpesaTransactions.set(cb.CheckoutRequestID, callbackData);
        console.log('Payment success - Receipt:', data.MpesaReceiptNo, 'Amount:', data.Amount);
        return;
    }

    mpesaTransactions.set(cb?.CheckoutRequestID, callbackData);
    console.log('Payment failed:', cb?.ResultDesc);
}

app.get('/api/mpesa/callback', (req, res) => {
    res.json(callbackVerificationResponse());
});
app.get('/mpesa/callback', (req, res) => {
    res.json(callbackVerificationResponse());
});
app.head('/api/mpesa/callback', (req, res) => {
    res.status(200).end();
});
app.head('/mpesa/callback', (req, res) => {
    res.status(200).end();
});
app.post('/api/mpesa/callback', handleMpesaCallback);
app.post('/mpesa/callback', handleMpesaCallback);
app.get('/api/mpesa/callback/latest', (req, res) => {
    res.json({
        ok: true,
        latestCallback: latestMpesaCallback
    });
});
app.get('/api/mpesa/transaction/:checkoutRequestId', (req, res) => {
    const transaction = getCachedTransactionStatus(req.params.checkoutRequestId);
    res.json({
        ok: true,
        transaction: transaction || null
    });
});

app.post('/api/mpesa/status', async (req, res) => {
    try {
        const { CheckoutRequestID } = req.body;
        const cachedStatus = getCachedTransactionStatus(CheckoutRequestID);

        if (cachedStatus && cachedStatus.pending === false) {
            return res.json(cachedStatus);
        }

        const now = Date.now();
        if (
            cachedStatus &&
            cachedStatus.pending === true &&
            cachedStatus.nextAllowedStatusCheckAt &&
            now < cachedStatus.nextAllowedStatusCheckAt
        ) {
            return res.json({
                ...cachedStatus,
                retryAfterMs: cachedStatus.nextAllowedStatusCheckAt - now
            });
        }

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

        if (queryRes.data.ResultCode === '0' || (queryRes.data.ResultCode && queryRes.data.ResultCode !== '4999')) {
            mpesaTransactions.set(CheckoutRequestID, {
                ...queryRes.data,
                source: 'status-query',
                pending: false
            });
        } else {
            mpesaTransactions.set(CheckoutRequestID, buildPendingTransaction(CheckoutRequestID, {
                source: 'status-query',
                MerchantRequestID: queryRes.data.MerchantRequestID || cachedStatus?.MerchantRequestID,
                ResultDesc: queryRes.data.ResultDesc || queryRes.data.ResponseDescription || 'Waiting for customer action.',
                nextAllowedStatusCheckAt: now + MPESA_STATUS_POLL_WINDOW_MS
            }));
        }

        return res.json(queryRes.data);
    } catch (err) {
        const statusCode = err.response?.status;
        const errorMessage = getAxiosErrorMessage(err);
        const { CheckoutRequestID } = req.body;
        const retryAfterMs = getRetryDelayMs(statusCode);
        console.error('Status Error:', err.response?.data || err.message);
        if (CheckoutRequestID) {
            const previousStatus = getCachedTransactionStatus(CheckoutRequestID);
            mpesaTransactions.set(CheckoutRequestID, buildPendingTransaction(CheckoutRequestID, {
                source: previousStatus?.source || 'status-error',
                MerchantRequestID: previousStatus?.MerchantRequestID,
                ResultDesc: previousStatus?.ResultDesc || 'Waiting for M-Pesa confirmation.',
                nextAllowedStatusCheckAt: Date.now() + retryAfterMs
            }));
        }
        return res.json({
            success: false,
            pending: true,
            error: errorMessage,
            statusCode,
            retryAfterMs
        });
    }
});

function logStartup() {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Local callback check: http://localhost:${PORT}/mpesa/callback`);

    if (!CALLBACK_URL) {
        console.warn('CALLBACK_URL is missing. STK push callbacks will fail.');
    } else if (/localhost|127\.0\.0\.1/i.test(CALLBACK_URL)) {
        console.warn('CALLBACK_URL points to localhost. Safaricom cannot reach your machine from the internet.');
    } else {
        console.log(`Configured callback URL: ${CALLBACK_URL}`);
    }
}

if (require.main === module) {
    app.listen(PORT, logStartup);
}

module.exports = app;
