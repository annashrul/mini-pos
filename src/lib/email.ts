import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@resend.dev";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "POS App";

export async function sendVerificationEmail(email: string, otp: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?email=${encodeURIComponent(email)}`;

  if (!resend) {
    // Dev fallback: log to console
    console.log(`\n========== EMAIL VERIFICATION ==========`);
    console.log(`To: ${email}`);
    console.log(`OTP: ${otp}`);
    console.log(`Verify Page: ${verifyUrl}`);
    console.log(`=========================================\n`);
    return;
  }

  const emailHtml = `
    <div style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
        <div style="text-align:center;padding:8px 0 20px;">
          <div style="display:inline-block;padding:8px 14px;background:#e7f8fa;border:1px solid #c9eef2;border-radius:999px;color:#0f6f79;font-size:12px;font-weight:700;letter-spacing:0.3px;">
            ${APP_NAME}
          </div>
        </div>
        <div style="background:#ffffff;border:1px solid #e8edf3;border-radius:20px;box-shadow:0 10px 30px rgba(15,23,42,0.08);padding:28px;">
          <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.25;font-weight:800;">
            Verifikasi email akun Anda
          </h1>
          <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:1.7;">
            Terima kasih sudah mendaftar di <strong style="color:#0f172a;">${APP_NAME}</strong>.
            Masukkan kode OTP berikut di halaman verifikasi untuk mengaktifkan akun Anda.
          </p>
          <div style="margin:26px 0 20px;text-align:center;">
            <div style="display:inline-block;padding:14px 18px;background:#0f172a;color:#ffffff;border-radius:14px;font-size:28px;font-weight:800;letter-spacing:8px;">
              ${otp}
            </div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;">
            <p style="margin:0 0 6px;color:#334155;font-size:12px;font-weight:700;">
              Buka halaman verifikasi
            </p>
            <a href="${verifyUrl}" style="color:#0f766e;font-size:12px;line-height:1.6;word-break:break-all;text-decoration:none;">
              ${verifyUrl}
            </a>
          </div>
          <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.7;">
            Link berlaku selama 24 jam. Jika Anda tidak melakukan pendaftaran, abaikan email ini.
          </p>
        </div>
        <p style="margin:14px 0 0;text-align:center;color:#94a3b8;font-size:11px;line-height:1.6;">
          Email ini dikirim otomatis oleh ${APP_NAME}. Mohon tidak membalas email ini.
        </p>
      </div>
    </div>
  `;
  const emailText = `Verifikasi email akun Anda di ${APP_NAME}\n\nOTP Anda: ${otp}\n\nBuka halaman verifikasi:\n${verifyUrl}\n\nOTP berlaku selama 15 menit. Jika Anda tidak mendaftar, abaikan email ini.`;

  try {
    const result = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Aktivasi Akun ${APP_NAME}`,
      html: emailHtml,
      text: emailText,
    });

    if (result.error) {
      console.error("[Email] Resend error:", result.error.message);
      // Fallback: log verification link
      console.log(`\n========== EMAIL VERIFICATION (Resend failed) ==========`);
      console.log(`To: ${email}`);
      console.log(`Link: ${verifyUrl}`);
      console.log(`========================================================\n`);
    }
  } catch (err) {
    console.error("[Email] Send failed:", err);
    console.log(`\n========== EMAIL VERIFICATION (fallback) ==========`);
    console.log(`To: ${email}`);
    console.log(`Link: ${verifyUrl}`);
    console.log(`====================================================\n`);
  }
}
