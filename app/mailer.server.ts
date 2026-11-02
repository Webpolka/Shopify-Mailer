import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;
let etherealCreds: { user: string; pass: string; web: string } | null = null;
let isEthereal = false;

async function ensureEtherealAccount() {
  if (etherealCreds) return etherealCreds;

  console.warn(
    "⚠️  No SMTP credentials found in env. Auto-creating Ethereal Email test account."
  );
  console.warn(
    "   Emails will be captured (NOT actually sent). Preview URL will be returned."
  );
  console.warn(
    "   For production, set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env\n"
  );

  const testAccount = await nodemailer.createTestAccount();
  etherealCreds = {
    user: testAccount.user,
    pass: testAccount.pass,
    web: "https://ethereal.email/login",
  };
  isEthereal = true;

  console.log("📧 Ethereal Email account (saved for this session):");
  console.log("   User:", etherealCreds.user);
  console.log("   Pass:", etherealCreds.pass);
  console.log("   Web UI:", etherealCreds.web);

  return etherealCreds;
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    const creds = await ensureEtherealAccount();
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: creds.user, pass: creds.pass },
    });
  } else {
    console.log(`📧 Using SMTP: ${host}:${port ?? 587} (user: ${user})`);
    cachedTransporter = nodemailer.createTransport({
      host,
      port: port ?? 587,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return cachedTransporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  previewUrl?: string;
  provider: "ethereal" | "smtp";
}

export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const transporter = await getTransporter();
  const fromAddress =
    params.from ||
    process.env.DEFAULT_FROM ||
    "BIS Mailer <hello@example.com>";

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });

    let previewUrl: string | undefined;
    if (isEthereal) {
      previewUrl = nodemailer.getTestMessageUrl(info) ?? undefined;
      console.log(`\n📧 ✅ Email captured (Ethereal)`);
      console.log(`   To: ${params.to}`);
      console.log(`   Subject: ${params.subject}`);
      console.log(`   Preview: ${previewUrl}\n`);
    } else {
      console.log(`\n📧 ✅ Email sent via SMTP`);
      console.log(`   To: ${params.to}`);
      console.log(`   Subject: ${params.subject}`);
      console.log(`   Message ID: ${info.messageId}\n`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      provider: isEthereal ? "ethereal" : "smtp",
    };
  } catch (err) {
    const error = err as Error;
    console.error(`\n📧 ❌ Email send failed:`);
    console.error(`   To: ${params.to}`);
    console.error(`   Error: ${error.message}\n`);
    throw error;
  }
}

export function isUsingEthereal(): boolean {
  return isEthereal;
}