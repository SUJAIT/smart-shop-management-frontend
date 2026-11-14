/** Direct support contact. WhatsApp wants the number with the country code and no + or leading 0: 01720929666 -> 8801720929666. */
export const SUPPORT_PHONE = '01720929666';
export const SUPPORT_WHATSAPP = '88' + SUPPORT_PHONE;

/** Link that opens WhatsApp straight to a chat with support (the app on a phone, WhatsApp Web on a computer). */
export const whatsappLink = (message?: string) => `https://wa.me/${SUPPORT_WHATSAPP}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
