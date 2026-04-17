  document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');

    // 1. Pre-fill Subject if coming from Product Page
    const urlParams = new URLSearchParams(window.location.search);
    const subjectParam = urlParams.get('subject');
    if (subjectParam) {
        const subjectSelect = document.getElementById('subject');
        // Simple check to see if the value exists, otherwise keep default
        for (let i = 0; i < subjectSelect.options.length; i++) {
            if (subjectSelect.options[i].value === subjectParam) {
                subjectSelect.selectedIndex = i;
                break;
            }
        }
    }

    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = {
                        name: document.getElementById('name').value,
                        email: document.getElementById('email').value,
                        phone: document.getElementById('phone').value,
                        product: document.getElementById('product').value,
                        quantity: document.getElementById('quantity').value,
                        deliveryDate: document.getElementById('deliveryDate').value,
                        message: document.getElementById('message').value
            };

            if (!formData.name || !formData.email || !formData.message) {
                showFeedback('Please fill in all required fields.', 'error');
                return;
            }

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="iconify animate-spin" data-icon="mdi:loading" data-width="20"></span> Sending...';
            hideFeedback();

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                // Handle empty responses safely
                let result = {};
                const text = await response.text();
                if (text) {
                    try {
                        result = JSON.parse(text);
                    } catch (parseError) {
                        // Server sent a non-JSON response
                        result = { message: text };
                    }
                }

                if (response.ok) {
                    showFeedback('Message sent successfully! We will contact you shortly.', 'success');
                    contactForm.reset();
                } else {
                    const errorMsg = result.message || `Server Error (${response.status})`;
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Error:', error);
                showFeedback('Error: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

    function showFeedback(message, type) {
        formMessage.textContent = message;
        formMessage.classList.remove('hidden');
        formMessage.className = 'text-center text-sm font-medium mt-2 p-3 rounded-md ';
        
        if (type === 'success') {
            formMessage.classList.add('bg-green-50', 'text-green-700', 'border', 'border-green-200');
        } else {
            formMessage.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
        }
    }

    function hideFeedback() {
        formMessage.classList.add('hidden');
    }
  });
