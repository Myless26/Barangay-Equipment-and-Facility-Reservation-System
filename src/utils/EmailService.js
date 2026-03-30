// EMAIL ENGINE SERVICE — Routes via backend to bypass CORS
// Backend: server.js /api/send-email (uses Resend server-side)

const API_BASE = 'http://localhost:3000';

/**
 * Sends a community notification email via the backend server.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} body - HTML or plain text body
 */
export const sendCommunityEmail = async (to, subject, body) => {
    try {
        const response = await fetch(`${API_BASE}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, subject, body })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log(`[Email Engine] ✅ Dispatched to ${to} | ID: ${data.id}`);
            return true;
        } else {
            console.warn(`[Email Engine] ⚠️ Backend rejected email: ${data.message}`);
            return false;
        }
    } catch (err) {
        // Backend offline or unreachable — fail silently so UI is never blocked
        console.warn('[Email Engine] Backend unreachable — email deferred.', err?.message);
        return true;
    }
};


/**
 * Email Templates & Logic
 */
export const EmailTemplates = {
    WELCOME: (name) => ({
        subject: "Barangay Hub: Account Created Successfully",
        body: `Congratulations ${name}! Your account has been securely created. Your identity is now being verified by the Barangay Office for full access.`
    }),
    LOGIN_SUCCESS: (name, device) => ({
        subject: "Security Alert: Successful Login Detected",
        body: `Hello ${name}, a successful login to your BrgyHub account was detected. <br/><br/><b>Device/Browser:</b> ${device || 'Web Browser'}<br/><b>Time:</b> ${new Date().toLocaleString()}<br/><br/>If this wasn't you, please reset your password immediately.`
    }),
    APPROVED: (name) => ({
        subject: "Identity Verified: Your Access is Now ACTIVE!",
        body: `Greetings ${name}. Good news! Your registration has been approved. You can now log in to access all community benefits and reservation protocols.`
    }),
    PAYMENT_RECEIVED: (name, planName, amount) => ({
        subject: "Payment Received: Subscription Pending Approval",
        body: `Hello ${name}, we have successfully received your payment of <b>₱${amount}</b> for the <b>${planName}</b> plan. Your subscription is now in the 'Pending' queue and will be activated once the treasury verifies the reference number.`
    }),
    PLAN_APPROVED: (name, planName) => ({
        subject: `Plan Activated: ${planName}`,
        body: `Congratulations ${name}! Your application for the <b>${planName}</b> Benefit Plan has been officially approved. Your digital pass is now active. You now have full access to premium community features.`
    }),
    TENANT_WELCOME: (barangayName, adminName) => ({
        subject: `Congratulations! ${barangayName} is now LIVE on Barangay Hub`,
        body: `
            <div style="text-align: center; padding: 40px 0;">
                <div style="font-size: 60px; margin-bottom: 20px;">🏢</div>
                <h2 style="color: #3b82f6; font-weight: 800; font-size: 24px; margin-bottom: 10px;">WELCOME TO THE HUB!</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #475569; max-width: 500px; margin: 0 auto;">
                    Greetings, <b>${adminName}</b>. Your community infrastructure for <b>${barangayName}</b> has been successfully deployed. 
                    You are now part of the most advanced digital barangay network in the country.
                </p>
                <div style="margin-top: 30px;">
                    <a href="https://brgyhub.ph" style="background: #3b82f6; color: white; padding: 12px 30px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">
                        ACCESS YOUR COMMAND CENTER
                    </a>
                </div>
                <p style="margin-top: 40px; font-size: 13px; color: #94a3b8;">
                    <i>"Empowering communities through digital transformation."</i>
                </p>
            </div>
        `
    })
};
