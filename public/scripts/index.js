   let selectedProducts = {};
    let orderData = {};

    // ===== MOBILE MENU =====
    function toggleMobileMenu() {
        const menu = document.getElementById('mobileMenu');
        menu.classList.toggle('hidden');
    }

    // ===== PRODUCT SELECTION (from catalog) =====
    function toggleProduct(card) {
        const key = card.dataset.product;
        const isSelected = card.classList.contains('selected');
        
        if (isSelected) {
            card.classList.remove('selected');
            card.querySelector('.product-check .iconify').style.opacity = '0';
            delete selectedProducts[key];
        } else {
            card.classList.add('selected');
            card.querySelector('.product-check .iconify').style.opacity = '1';
            selectedProducts[key] = {
                name: card.querySelector('h4').textContent,
                price: parseInt(card.dataset.price),
                unit: card.dataset.unit,
                qty: 1
            };
        }
        renderOrderItems();
    }

    // ===== RENDER ORDER ITEMS =====
    function renderOrderItems() {
        const container = document.getElementById('orderItems');
        const noMsg = document.getElementById('noItemsMsg');
        const summary = document.getElementById('orderSummary');
        const nextBtn = document.getElementById('step1Next');
        const keys = Object.keys(selectedProducts);

        if (keys.length === 0) {
            container.innerHTML = '';
            noMsg.classList.remove('hidden');
            summary.classList.add('hidden');
            nextBtn.classList.add('hidden');
            return;
        }

        noMsg.classList.add('hidden');
        summary.classList.remove('hidden');
        nextBtn.classList.remove('hidden');

        container.innerHTML = keys.map(key => {
            const p = selectedProducts[key];
            return `
                <div class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div class="flex-1">
                        <div class="text-xs font-medium text-white">${p.name}</div>
                        <div class="text-xs text-stone-500">KES ${p.price.toLocaleString()} / ${p.unit}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="qty-btn" onclick="changeQty('${key}', -1)">−</div>
                        <span class="text-sm font-medium text-white w-8 text-center">${p.qty}</span>
                        <div class="qty-btn" onclick="changeQty('${key}', 1)">+</div>
                    </div>
                    <div class="text-sm font-medium text-white w-24 text-right">KES ${(p.price * p.qty).toLocaleString()}</div>
                    <button onclick="removeItem('${key}')" class="ml-2 text-stone-600 hover:text-red-400 transition-colors">
                        <span class="iconify" data-icon="mdi:close" data-width="14"></span>
                    </button>
                </div>
            `;
        }).join('');

        updateTotals();
    }

    function changeQty(key, delta) {
        const p = selectedProducts[key];
        p.qty = Math.max(1, p.qty + delta);
        renderOrderItems();
    }

    function removeItem(key) {
        delete selectedProducts[key];
        // Deselect in catalog
        const card = document.querySelector(`.product-card[data-product="${key}"]`);
        if (card) {
            card.classList.remove('selected');
            card.querySelector('.product-check .iconify').style.opacity = '0';
        }
        renderOrderItems();
    }

    function updateTotals() {
        document.getElementById('totalAmount').textContent = `KES ${getTotal().toLocaleString()}`;
    }

    function getTotal() {
        let total = 0;
        Object.values(selectedProducts).forEach(p => total += p.price * p.qty);
        return total;
    }

    function normalizeKenyanPhoneInput(phone = '') {
        const digits = String(phone).replace(/\D/g, '');

        if (digits.startsWith('254') && digits.length === 12) {
            return {
                local: digits.slice(3),
                international: `+${digits}`
            };
        }

        if (digits.startsWith('0') && digits.length === 10) {
            return {
                local: digits,
                international: `+254${digits.slice(1)}`
            };
        }

        if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
            return {
                local: digits,
                international: `+254${digits}`
            };
        }

        return null;
    }

    // ===== ORDER MODAL NAVIGATION =====
    function openOrderModal() {
        document.getElementById('orderModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        renderOrderItems();
    }

    function closeOrderModal() {
        document.getElementById('orderModal').classList.add('hidden');
        document.body.style.overflow = '';
        resetOrderSteps();
    }

    function resetOrderSteps() {
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`orderStep${i}`).classList.add('hidden');
        }
        document.getElementById('orderStep1').classList.remove('hidden');
    }

    function goToStep1() {
        document.getElementById('orderStep2').classList.add('hidden');
        document.getElementById('orderStep1').classList.remove('hidden');
    }

    function goToStep2() {
        const keys = Object.keys(selectedProducts);
        if (keys.length === 0) {
            showToast('Please select at least one product', 'error');
            return;
        }
        document.getElementById('orderStep1').classList.add('hidden');
        document.getElementById('orderStep2').classList.remove('hidden');
    }

    function goToStep3() {
        const name = document.getElementById('custName').value.trim();
        const phone = document.getElementById('custPhone').value.trim();
        const location = document.getElementById('custLocation').value.trim();
        const county = document.getElementById('custCounty').value;
        const normalizedPhone = normalizeKenyanPhoneInput(phone);

        if (!name) { showToast('Please enter your full name', 'error'); return; }
        if (!normalizedPhone) { showToast('Please enter a valid phone number', 'error'); return; }
        if (!location) { showToast('Please enter delivery location', 'error'); return; }
        if (!county) { showToast('Please select a county', 'error'); return; }

        orderData = {
            name,
            phone: normalizedPhone.international,
            location,
            county,
            notes: document.getElementById('custNotes').value.trim(),
            items: { ...selectedProducts },
            total: getTotal()
        };

        const orderId = 'JNG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        orderData.orderId = orderId;

        document.getElementById('mpesaAmount').textContent = `KES ${orderData.total.toLocaleString()}`;
        document.getElementById('mpesaAccount').textContent = orderId;
        
        // Pre-fill M-Pesa phone
        document.getElementById('mpesaPhone').value = normalizedPhone.local;

        document.getElementById('orderStep2').classList.add('hidden');
        document.getElementById('orderStep3').classList.remove('hidden');
    }

    window.goToStep4 = function goToStep4() {
        document.getElementById('orderStep3').classList.add('hidden');
        document.getElementById('orderStep4').classList.remove('hidden');
        resetMpesaStepFeedback();
        startCountdown();
    };

    window.goToStep5 = function goToStep5() {
        paymentSuccessful();
    };

    function setMpesaStatusNote(message, tone = 'neutral') {
        const note = document.getElementById('mpesaStatusNote');
        const toneClasses = {
            neutral: 'text-stone-600',
            pending: 'text-stone-500',
            success: 'text-green-400',
            error: 'text-red-400'
        };

        note.textContent = message;
        note.className = `text-xs mb-4 ${toneClasses[tone] || toneClasses.neutral}`;
    }

    function setMpesaWaitingState(message, state = 'pending') {
        const waitingRow = document.getElementById('mpesaWaiting');
        const waitingIcon = document.getElementById('mpesaWaitingIcon');
        const waitingText = document.getElementById('mpesaWaitingText');
        const iconByState = {
            pending: 'mdi:circle-outline',
            processing: 'mdi:progress-clock',
            success: 'mdi:check-circle',
            error: 'mdi:alert-circle-outline'
        };
        const iconClassByState = {
            pending: 'iconify text-stone-600 animate-pulse',
            processing: 'iconify text-orange-400 animate-pulse',
            success: 'iconify text-green-500',
            error: 'iconify text-red-400'
        };
        const textClassByState = {
            pending: 'text-xs text-stone-500',
            processing: 'text-xs text-orange-300',
            success: 'text-xs text-green-400',
            error: 'text-xs text-red-400'
        };

        waitingRow.classList.remove('hidden');
        waitingIcon.setAttribute('data-icon', iconByState[state] || iconByState.pending);
        waitingIcon.className = iconClassByState[state] || iconClassByState.pending;
        waitingText.textContent = message;
        waitingText.className = textClassByState[state] || textClassByState.pending;

        if (window.Iconify && typeof window.Iconify.scan === 'function') {
            window.Iconify.scan(waitingRow);
        }
    }

    function resetMpesaStepFeedback() {
        document.getElementById('mpesaWaiting').classList.remove('hidden');
        document.getElementById('mpesaConfirmed').classList.add('hidden');
        setMpesaWaitingState('Waiting for PIN entry on your phone...', 'pending');
        setMpesaStatusNote('We will update this screen automatically as soon as M-Pesa responds.', 'neutral');
        document.getElementById('mpesaTimer').innerHTML = `Waiting... <span id="countdown">${MPESA_WAIT_TIMEOUT_SECONDS}</span>s remaining`;
    }

    function getPendingMpesaMessage(result) {
        const rawMessage = String(result?.ResultDesc || result?.error || '').toLowerCase();

        if (rawMessage.includes('processing')) {
            return 'M-Pesa is still processing your payment request.';
        }

        if (rawMessage.includes('waiting for customer')) {
            return 'Approve the STK prompt on your phone to continue.';
        }

        if (rawMessage.includes('accepted successfully')) {
            return 'Safaricom accepted the request and is preparing the phone prompt.';
        }

        return 'We are still waiting for a final response from M-Pesa.';
    }

    function getFriendlyMpesaMessage(result) {
        const rawMessage = typeof result === 'string'
            ? result
            : (result?.ResultDesc || result?.error || result?.message || 'Payment did not complete.');
        const resultCode = String(result?.ResultCode || '');
        const normalized = rawMessage.toLowerCase();

        if (resultCode === '1037') {
            return 'Payment failed: your phone could not be reached in time. Please confirm network signal and try again.';
        }

        if (resultCode === '1' || normalized.includes('insufficient')) {
            return 'Payment failed: this M-Pesa number has insufficient funds.';
        }

        if (normalized.includes('cancel') || normalized.includes('declined')) {
            return 'Payment was cancelled on the phone before completion.';
        }

        if (normalized.includes('timeout')) {
            return 'Payment timed out before it was confirmed on the phone.';
        }

        if (normalized.includes('wrong credentials')) {
            return 'Payment setup error: the server M-Pesa credentials are invalid.';
        }

        return `Payment failed: ${rawMessage}`;
    }

    function handleMpesaFailure(result) {
        const friendlyMessage = getFriendlyMpesaMessage(result);

        stopMpesaPolling();
        clearInterval(countdownInterval);
        document.getElementById('mpesaConfirmed').classList.add('hidden');
        setMpesaWaitingState(friendlyMessage, 'error');
        setMpesaStatusNote('Returning you to the payment step so you can try again.', 'error');
        document.getElementById('mpesaTimer').innerHTML = `<span class="text-red-400">${friendlyMessage}</span>`;
        showToast(friendlyMessage, 'error');

        setTimeout(() => {
            cancelPayment();
        }, 2200);
    }

    // ===== M-PESA PAYMENT FLOW =====
    /*
     * ============================================================
     * 🔧 TO CONNECT REAL M-PESA (Safaricom Daraja API):
     * ============================================================
     * 
     * 1. Register at developer.safaricom.co.ke
     * 2. Create a Lipa Na M-Pesa Online (C2B) API
     * 3. Get: Consumer Key, Consumer Secret, Passkey, Business Shortcode (174379 for sandbox)
     * 4. Replace the initiateMpesa() function below with a fetch() to YOUR backend:
     * 
     *    fetch('/api/mpesa/stk-push', {
     *        method: 'POST',
     *        headers: { 'Content-Type': 'application/json' },
     *        body: JSON.stringify({
     *            phone: '254' + phone,
     *            amount: total,
     *            orderId: orderId,
     *            description: 'Order ' + orderId
     *        })
     *    })
     *    .then(res => res.json())
     *    .then(data => {
     *        if (data.ResponseCode === '0') {
     *            // STK sent successfully
     *            // data.CheckoutRequestID — use this to poll status
     *            pollMpesaStatus(data.CheckoutRequestID);
     *        } else {
     *            showToast('Failed to initiate. Try again.', 'error');
     *        }
     *    });
     *
     * 5. Your backend (Node.js example):
     * 
     *    // Generate password: base64(Shortcode + Passkey + Timestamp)
     *    // POST to https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
     *    //   (with Basic auth of base64(key:secret))
     *    // Then POST to https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
     *    //   Body: { BusinessShortCode, Password, Timestamp, TransactionType:"CustomerPayBillOnline",
     *    //           Amount, PartyA:phone, PartyB:shortcode, PhoneNumber:phone,
     *    //           CallBackURL:"https://yourdomain.com/api/mpesa/callback",
     *    //           AccountReference:orderId, TransactionDesc:"Order payment" }
     *
     * 6. Set up callback URL to receive payment confirmation
     * 7. Use the sandbox first, then go live with production credentials
     * ============================================================
     */

    let countdownInterval;
    let mpesaPollTimeout = null;
    let mpesaPollingActive = false;
    const MPESA_POLL_MAX_ATTEMPTS = 12;
    const MPESA_POLL_DEFAULT_DELAY_MS = 6000;
    const MPESA_WAIT_TIMEOUT_SECONDS = 90;

    function stopMpesaPolling() {
        mpesaPollingActive = false;
        if (mpesaPollTimeout) {
            clearTimeout(mpesaPollTimeout);
            mpesaPollTimeout = null;
        }
    }


       // --- THIS IS THE MISSING POLLING FUNCTION ---
       
    /*function pollMpesaStatus(checkoutId) {
        let attempts = 0;
        const maxAttempts = 20; // Check for 1 minute (20 * 3 seconds)

        const interval = setInterval(() => {
            attempts++;

            fetch('/api/mpesa/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CheckoutRequestID: checkoutId })
            })
            .then(res => res.json())
            .then(data => {
                // If ResultCode is 0, the user paid!
                if (data.ResultCode === '0') {
                    clearInterval(interval);
                    console.log("Payment Confirmed!");
                    goToStep5(); // Show Success Screen
                    // You can add the receipt number here: data.MpesaReceiptNumber
                }
                // If ResultCode exists but isn't 0, check if it's a failure
                else if (data.ResultCode) {
                    // 1032 = Cancelled by user, 2001 = Request cancelled by system
                    if (data.ResultCode === '1032' || data.ResultCode === '2001') {
                        clearInterval(interval);
                        alert("Payment was cancelled.");
                        goToStep1(); // Go back to start
                    }
                }
            })
            .catch(err => console.error("Polling error:", err));

            // Stop polling after max attempts
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                alert("Request timed out. Please check your phone and try again.");
                goToStep1();
            }

        }, 3000); // Check every 3 seconds
    }*/
   
    async function initiateMpesa() {
        const phoneInput = document.getElementById('mpesaPhone').value;
        const amountText = document.getElementById('mpesaAmount').innerText;
        const amount = parseInt(amountText.replace(/[^0-9]/g, ''), 10);
        const normalizedPhone = normalizeKenyanPhoneInput(phoneInput);
        
        const orderId = orderData.orderId || ('ORD-' + Math.floor(Math.random() * 1000000));
        const btn = document.getElementById('payBtn');

        if (!normalizedPhone) {
            alert("Please enter a valid M-Pesa phone number");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = 'Processing...';

        try {
            const response = await fetch('/api/mpesa/stk-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: normalizedPhone.local, 
                    amount: amount,
                    orderId: orderId
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log("STK Push Sent. ID:", data.CheckoutRequestID);
                window.goToStep4();
                pollMpesaStatus(data.CheckoutRequestID);
            } else {
                throw new Error(data.message || "Failed to initiate payment");
            }

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'Send M-Pesa STK Push';
        }
    }

    function pollMpesaStatus(checkoutId) {
        stopMpesaPolling();
        mpesaPollingActive = true;
        let attempts = 0;

        const runPoll = () => {
            if (!mpesaPollingActive) return;
            attempts++;

            fetch('/api/mpesa/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CheckoutRequestID: checkoutId })
            })
            .then(res => res.json())
            .then(data => {
                if (!mpesaPollingActive) return;

                if (data.ResultCode === '0') {
                    stopMpesaPolling();
                    console.log("Payment Confirmed!");
                    setMpesaWaitingState('Payment confirmed by M-Pesa.', 'success');
                    setMpesaStatusNote('Payment received. Finalizing your order now.', 'success');
                    window.goToStep5();
                } else if (data.pending || data.ResultCode === '4999') {
                    console.log("M-Pesa status still pending:", data.error || data);
                    setMpesaWaitingState('STK request sent. Complete the prompt on your phone.', 'processing');
                    setMpesaStatusNote(getPendingMpesaMessage(data), 'pending');
                    if (attempts >= MPESA_POLL_MAX_ATTEMPTS) {
                        stopMpesaPolling();
                        handleMpesaFailure('Request timed out. Safaricom accepted the request, but no final confirmation was received.');
                        return;
                    }
                    const nextDelay = Number(data.retryAfterMs) || MPESA_POLL_DEFAULT_DELAY_MS;
                    mpesaPollTimeout = setTimeout(runPoll, nextDelay);
                } else if (data.ResultCode === '1032' || data.ResultCode === '2001') {
                    stopMpesaPolling();
                    handleMpesaFailure(data);
                } else if (data.ResultCode) {
                    stopMpesaPolling();
                    console.error("M-Pesa status failure:", data);
                    handleMpesaFailure(data);
                } else {
                    console.log("M-Pesa status pending:", data);
                    if (attempts >= MPESA_POLL_MAX_ATTEMPTS) {
                        stopMpesaPolling();
                        handleMpesaFailure('Request timed out. Safaricom accepted the request, but no final confirmation was received.');
                        return;
                    }
                    mpesaPollTimeout = setTimeout(runPoll, MPESA_POLL_DEFAULT_DELAY_MS);
                }
            })
            .catch(err => {
                stopMpesaPolling();
                console.error("Polling error:", err);
                handleMpesaFailure('Could not verify payment status. Please try again.');
            });
        };

        runPoll();
    }

    function startCountdown() {
        let seconds = MPESA_WAIT_TIMEOUT_SECONDS;
        document.getElementById('countdown').textContent = seconds;
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            seconds--;
            document.getElementById('countdown').textContent = seconds;
            if (seconds <= 0) {
                clearInterval(countdownInterval);
                stopMpesaPolling();
                cancelPayment();
                showToast('Payment timed out. Please try again.', 'error');
            }
        }, 1000);
    }

    function paymentSuccessful() {
        stopMpesaPolling();
        clearInterval(countdownInterval);
        
        document.getElementById('mpesaWaiting').classList.add('hidden');
        document.getElementById('mpesaConfirmed').classList.remove('hidden');
        setMpesaStatusNote('Your payment has been confirmed and your order is being finalized.', 'success');
        document.getElementById('mpesaTimer').innerHTML = '<span class="text-green-500">Payment successful!</span>';

        const ref = 'QJK' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        setTimeout(() => {
            document.getElementById('orderStep4').classList.add('hidden');
            document.getElementById('orderStep5').classList.remove('hidden');
            
            document.getElementById('orderId').textContent = orderData.orderId;
            document.getElementById('mpesaRef').textContent = ref;
            document.getElementById('paidAmount').textContent = `KES ${orderData.total.toLocaleString()}`;
            
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const timeStr = tomorrow.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
            const dayStr = tomorrow.toLocaleDateString('en-KE', { weekday: 'long' });
            document.getElementById('estDelivery').textContent = `${dayStr}, ${timeStr}`;

            showToast('Payment confirmed! Order placed successfully.', 'success');
        }, 1500);
    }

    function cancelPayment() {
        stopMpesaPolling();
        clearInterval(countdownInterval);
        document.getElementById('orderStep4').classList.add('hidden');
        document.getElementById('orderStep3').classList.remove('hidden');
        
        const payBtn = document.getElementById('payBtn');
        payBtn.disabled = false;
        payBtn.innerHTML = '<span class="iconify" data-icon="mdi:cellphone" data-width="18"></span> Send M-Pesa STK Push';
    }

    // ===== FAQ TOGGLE =====
    function toggleFaq(btn) {
        const answer = btn.nextElementSibling;
        const icon = btn.querySelector('.faq-icon');
        const isOpen = !answer.classList.contains('hidden');

        // Close all
        document.querySelectorAll('.faq-answer').forEach(a => a.classList.add('hidden'));
        document.querySelectorAll('.faq-icon').forEach(i => i.style.transform = 'rotate(0deg)');

        if (!isOpen) {
            answer.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        }
    }

    // ===== TOAST NOTIFICATIONS =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const colors = {
            success: 'border-green-500/30 bg-green-500/10',
            error: 'border-red-500/30 bg-red-500/10',
            info: 'border-orange-500/30 bg-orange-500/10'
        };
        const icons = {
            success: '<span class="iconify text-green-500" data-icon="mdi:check-circle" data-width="16"></span>',
            error: '<span class="iconify text-red-500" data-icon="mdi:alert-circle" data-width="16"></span>',
            info: '<span class="iconify text-orange-500" data-icon="mdi:information" data-width="16"></span>'
        };

        toast.className = `toast flex items-center gap-2 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-sm`;
        toast.innerHTML = `${icons[type]}<span class="text-xs text-white font-medium">${message}</span>`;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== PHONE INPUT FORMATTING =====
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    });

    // ===== SCROLL ANIMATIONS =====
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.glass-card, .faq-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
