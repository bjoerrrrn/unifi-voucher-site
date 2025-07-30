/**
 * Import vendor modules
 */
const fs = require('fs');
const ejs = require('ejs');
const nodemailer = require('nodemailer');

/**
 * Import own modules
 */
const variables = require('./variables');
const log = require('./log');
const translation = require('./translation');
const qr = require('./qr');

/**
 * Import own utils
 */
const time = require('../utils/time');
const bytes = require('../utils/bytes');

/**
 * Create nodemailer transport
 */
const transport = nodemailer.createTransport({
    host: variables.smtpHost,
    port: parseInt(variables.smtpPort),
    secure: variables.smtpSecure,
    tls: {
        rejectUnauthorized: false // Skip TLS Certificate checks for Self-Hosted systems
    },
    auth: {
        user: variables.smtpUsername,
        pass: variables.smtpPassword
    }
});

/**
 * Mail module functions
 */
module.exports = {
    /**
     * Sends an email via the nodemailer transport
     *
     * @param to
     * @param voucher
     * @param language
     * @return {Promise<unknown>}
     */
    send: (to, voucher, language = 'en') => {
        return new Promise(async (resolve, reject) => {
            // Create new translator
            const t = translation('email', language);

            // Logo-URL bestimmen
            const logoUrl = process.env.EMAIL_LOGO_URL || 'https://github.com/glenndehaan/unifi-voucher-site/blob/master/public/images/icon/logo_192x192.png?raw=true';

            // QR-Code als Buffer erzeugen
            const qrBuffer = await qr(voucher.code, true); // true: Buffer statt Data-URL

            // Attempt to send mail via SMTP transport
            const result = await transport.sendMail({
                from: variables.smtpFrom,
                to: to,
                subject: t('title'),
                text: `${t('greeting')},\n\n${t('intro')}:\n\n${voucher.code.slice(0, 5)}-${voucher.code.slice(5)}`,
                html: ejs.render(fs.readFileSync(`${__dirname}/../template/email/voucher.ejs`, 'utf-8'), {
                    language,
                    t,
                    voucher,
                    unifiSsid: variables.unifiSsid,
                    unifiSsidPassword: variables.unifiSsidPassword,
                    logoUrl,
                    timeConvert: time,
                    bytesConvert: bytes
                }),
                attachments: [
                    {
                        filename: 'qr.png',
                        content: qrBuffer,
                        cid: 'qr-code'
                    }
                ]
            }).catch((e) => {
                log.error(`[Mail] Error when sending mail`);
                log.error(e);
                reject(`[Mail] ${e.message}`);
            });

            // Check if the email was sent successfully
            if(result) {
                log.info(`[Mail] Sent to: ${to}`);
                resolve(true);
            }
        });
    }
};
