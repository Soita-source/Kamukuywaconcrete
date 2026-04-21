 document.addEventListener('DOMContentLoaded', function () {
            const whatsappNumber = '254706706034';

            function formatKes(amount) {
                return 'KES ' + Math.round(amount).toLocaleString('en-KE');
            }

            function buildOrderWhatsAppMessage(productName) {
                return "Hi Kamukuywa Concrete, I'd like to order " + productName +
                    ". Quantity: ___, Delivery location: ___";
            }

            function buildQuoteWhatsAppMessage(productName, quantity, unitLabel, location, subtotalText) {
                return "Hi Kamukuywa Concrete, I'd like a quote for " + productName +
                    ". Quantity: " + quantity + " " + unitLabel +
                    ", Delivery location: " + location +
                    ", Subtotal: " + subtotalText + ".";
            }

            document.querySelectorAll('.product-card').forEach(function (card) {
                const productNameElement = card.querySelector('h4');
                if (!productNameElement) return;

                const productName = productNameElement.textContent.trim();
                const unitPrice = Number(card.dataset.unitPrice || '0');
                const unitLabel = String(card.dataset.unitLabel || 'units').trim();
                const orderButton = card.querySelector('.whatsapp-order-btn');
                const quoteButton = card.querySelector('.quote-toggle-btn');
                const quoteForm = card.querySelector('.quote-inline-form');
                const quantityInput = quoteForm ? quoteForm.querySelector('input[name="quantity"]') : null;
                const locationSelect = quoteForm ? quoteForm.querySelector('select[name="location"]') : null;
                const subtotalElement = quoteForm ? quoteForm.querySelector('.quote-subtotal') : null;
                const unitLabelElement = quoteForm ? quoteForm.querySelector('.quote-unit-label') : null;

                function calculateSubtotal() {
                    const parsedQuantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
                    const safeQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
                    const subtotal = safeQuantity * unitPrice;
                    return { quantity: safeQuantity, subtotal };
                }

                function updateSubtotal() {
                    if (!subtotalElement) return;
                    const values = calculateSubtotal();
                    subtotalElement.textContent = formatKes(values.subtotal);
                }

                if (orderButton) {
                    const baseMessage = buildOrderWhatsAppMessage(productName);
                    orderButton.href = "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(baseMessage);
                    orderButton.target = '_blank';
                    orderButton.rel = 'noopener noreferrer';
                }

                if (quoteButton && quoteForm) {
                    quoteButton.addEventListener('click', function () {
                        const willOpen = quoteForm.classList.contains('hidden');

                        document.querySelectorAll('.quote-inline-form').forEach(function (formElement) {
                            if (formElement !== quoteForm) {
                                formElement.classList.add('hidden');
                            }
                        });
                        document.querySelectorAll('.quote-toggle-btn').forEach(function (buttonElement) {
                            if (buttonElement !== quoteButton) {
                                buttonElement.textContent = 'Get Quote';
                                buttonElement.setAttribute('aria-expanded', 'false');
                            }
                        });

                        if (willOpen) {
                            quoteForm.classList.remove('hidden');
                            quoteButton.textContent = 'Hide Quote';
                            quoteButton.setAttribute('aria-expanded', 'true');
                            updateSubtotal();
                            if (quantityInput) {
                                quantityInput.focus();
                                quantityInput.select();
                            }
                        } else {
                            quoteForm.classList.add('hidden');
                            quoteButton.textContent = 'Get Quote';
                            quoteButton.setAttribute('aria-expanded', 'false');
                        }
                    });
                }

                if (unitLabelElement) {
                    unitLabelElement.textContent = unitLabel;
                }
                if (quantityInput) {
                    quantityInput.addEventListener('input', updateSubtotal);
                    quantityInput.addEventListener('change', updateSubtotal);
                }
                updateSubtotal();

                if (quoteForm) {
                    quoteForm.addEventListener('submit', function (event) {
                        event.preventDefault();

                        const values = calculateSubtotal();
                        const subtotalText = formatKes(values.subtotal);
                        const locationValue = locationSelect && locationSelect.value
                            ? locationSelect.value
                            : 'Other';

                        const message = buildQuoteWhatsAppMessage(
                            productName,
                            values.quantity,
                            unitLabel,
                            String(locationValue).trim(),
                            subtotalText
                        );

                        const url = "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message);
                        window.open(url, '_blank', 'noopener,noreferrer');
                    });
                }
            });

            const deliveryLightbox = document.getElementById('deliveryLightbox');
            const deliveryLightboxClose = document.getElementById('deliveryLightboxClose');
            const deliveryLightboxImage = document.getElementById('deliveryLightboxImage');
            const deliveryLightboxCaption = document.getElementById('deliveryLightboxCaption');

            function closeDeliveryLightbox() {
                if (!deliveryLightbox) return;
                deliveryLightbox.classList.add('hidden');
                document.body.style.overflow = '';
            }

            function openDeliveryLightbox(imageUrl, captionText) {
                if (!deliveryLightbox || !deliveryLightboxImage || !deliveryLightboxCaption) return;
                deliveryLightboxImage.src = imageUrl;
                deliveryLightboxCaption.textContent = captionText || '';
                deliveryLightbox.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }

            document.querySelectorAll('.delivery-lightbox-trigger').forEach(function (trigger) {
                trigger.addEventListener('click', function (event) {
                    event.preventDefault();
                    const imageUrl = trigger.getAttribute('href') || '';
                    const captionText = trigger.dataset.caption || '';
                    openDeliveryLightbox(imageUrl, captionText);
                });
            });

            if (deliveryLightboxClose) {
                deliveryLightboxClose.addEventListener('click', closeDeliveryLightbox);
            }

            if (deliveryLightbox) {
                deliveryLightbox.addEventListener('click', function (event) {
                    if (event.target === deliveryLightbox) {
                        closeDeliveryLightbox();
                    }
                });
            }

            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') {
                    closeDeliveryLightbox();
                }
            });
        });