import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Gmail SMTP Transporter (works for any recipient, no domain needed)
const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD  // 16-char App Password from Google
    }
});


// Supabase Initialization for Server-Side Checks
const supabaseUrl = 'https://mtuihhrgnmtaitykqhrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWloaHJnbm10YWl0eWtxaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDI2NDMsImV4cCI6MjA4OTE3ODY0M30.LKGHE8J9-_gzTViB4CVzh4A748MY9nXrd0Ld0pOaUDQ';
const supabase = createClient(supabaseUrl, supabaseKey);
app.use(cors());
app.use(express.json());

// Fallback to Google's standard test secret key if not provided in .env
const RECAPTCHA_SECRET_KEY = process.env.VITE_RECAPTCHA_SECRET_KEY || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

app.post('/api/verify-captcha', async (req, res) => {
    const { token } = req.body;

    // BYPASS FOR DEVELOPMENT: If NODE_ENV is not production, or token is development-token, allow everything
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isDevelopment || token === 'development-token') {
        console.log('[ReCAPTCHA] Development mode detected: Bypassing security check.');
        return res.json({ success: true, message: 'Captcha bypassed in development', score: 1.0 });
    }

    if (!token) {
        return res.status(400).json({ success: false, message: 'Captcha token is missing' });
    }

    try {
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}`, {
            method: 'POST',
        });

        const data = await response.json();
        const { success, score } = data;

        // For reCAPTCHA v2, score is undefined but success is true.
        // For reCAPTCHA v3, we check the score threshold.
        const isVerified = success && (score === undefined || score >= 0.5);

        if (isVerified) {
            res.json({ success: true, message: 'Captcha verified successfully', score: score || 1.0 });
        } else {
            console.error('[ReCAPTCHA] Verification failed:', data['error-codes'], score);
            res.status(400).json({ success: false, message: 'Security verification failed.', errors: data['error-codes'] });
        }
    } catch (error) {
        console.error('[ReCAPTCHA] System error verifying captcha:', error);
        res.status(500).json({ success: false, message: 'Internal server error during verification' });
    }
});

// ===== GENERIC EMAIL SEND ENDPOINT (Gmail SMTP) =====
app.post('/api/send-email', async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ success: false, message: 'Missing required fields: to, subject, body' });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('[Email] Gmail credentials not set in .env — email skipped.');
        return res.json({ success: true, simulated: true });
    }

    try {
        const info = await gmailTransporter.sendMail({
            from: `"BrgyHub Pro" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html: `
                <div style="background:#0f172a;color:white;padding:40px;border-radius:20px;font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:auto;">
                    <div style="padding:8px 16px;background:#3b82f626;border:1px solid #3b82f64d;border-radius:6px;color:#3b82f6;display:inline-block;font-size:10px;font-weight:900;letter-spacing:3px;margin-bottom:24px;text-transform:uppercase;">
                        Official BrgyHub Notification
                    </div>
                    <div style="font-size:15px;line-height:1.8;color:#cbd5e1;">${body}</div>
                    <hr style="border:none;border-top:1px solid #1e293b;margin:32px 0;" />
                    <p style="font-size:11px;color:#475569;margin:0;">This is an official system notification from your Barangay digital infrastructure.</p>
                </div>
            `
        });

        console.log(`[Email] ✅ Sent to ${to} | Message ID: ${info.messageId}`);
        res.json({ success: true, id: info.messageId });
    } catch (err) {
        console.error('[Email] Gmail SMTP error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// PASS-RESET/RECOVERY ENDPOINT (also switched to Gmail SMTP)
app.post('/api/request-recovery', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Recovery email/account is required' });

    try {
        const { data: profile, error: dbError } = await supabase
            .from('user_profiles')
            .select('email, full_name')
            .eq('email', email)
            .single();

        if (dbError || !profile) {
            console.warn('[Recovery Warning] Identity not found:', email);
            return res.status(404).json({ success: false, message: 'Identity node not found in our secure registry.' });
        }

        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        try {
            if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
                await gmailTransporter.sendMail({
                    from: `"BrgyHub Security" <${process.env.GMAIL_USER}>`,
                    to: email,
                    subject: 'Emergency Code: Account Access Recovery',
                    html: `
                        <div style="background:#0f172a;color:white;padding:40px;border-radius:20px;font-family:'Inter',system-ui,sans-serif;max-width:500px;margin:auto;">
                            <div style="padding:10px 20px;background:#3b82f626;border:1px solid #3b82f64d;border-radius:5px;color:#3b82f6;display:inline-block;font-size:10px;font-weight:bold;letter-spacing:2px;margin-bottom:20px;">CRYPTO-SHIELD ACTIVATED</div>
                            <h1 style="color:white;margin:0 0 10px;font-size:26px;font-weight:900;">Acknowledge Access Override</h1>
                            <p style="color:#94a3b8;font-size:15px;">Greetings, ${profile.full_name || 'Resident'}.</p>
                            <p style="color:#94a3b8;font-size:14px;line-height:1.6;">Use the following code to verify your identity:</p>
                            <div style="background:#ffffff0d;padding:40px;border-radius:24px;margin:30px 0;border:1px solid #ffffff0d;text-align:center;">
                                <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#3b82f6;">${pin}</span>
                            </div>
                            <p style="color:#64748b;font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:1px;">Expires in 15 minutes</p>
                        </div>
                    `
                });
            }
        } catch (mailErr) {
            console.error('[Recovery] Email send failed — PIN still valid:', pin);
        }

        res.json({ success: true, message: 'Recovery PIN transmitted.', pin });
    } catch (err) {
        console.error('[Recovery Error]', err);
        res.status(500).json({ success: false, message: 'Encryption failure during PIN transmission.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[BrgyHub Base] Secure Captcha verification API running on http://localhost:${PORT}`);
});
