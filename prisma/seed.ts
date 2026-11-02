import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Создаём back-in-stock шаблон если его нет
  const existing = await prisma.template.findUnique({
    where: { name: "back-in-stock" },
  });

  if (!existing) {
    await prisma.template.create({
      data: {
        name: "back-in-stock",
        displayName: "Back in Stock Notification",
        subject: "Good news! {{ productTitle }} is back in stock",
        htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#0b0c0e;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Your Store</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px 0;color:#0b0c0e;font-size:24px;font-weight:600;">
                Hi {{ customerName }}, 👋
              </h2>
              <p style="margin:0 0 16px 0;color:#4b5563;font-size:16px;line-height:1.5;">
                Great news! The item you asked us to track is back in stock.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f9fafb;border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <h3 style="margin:0 0 8px 0;color:#0b0c0e;font-size:18px;font-weight:600;">
                      {{ productTitle }}
                    </h3>
                    <a href="{{ productUrl }}"
                       style="display:inline-block;background:#008060;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">
                      Shop now →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;color:#6b7280;font-size:14px;line-height:1.5;">
                Hurry — popular items sell out fast!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;line-height:1.5;">
                You received this email because you asked to be notified when this product returns to stock.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:11px;">
                {{ shopName }} · <a href="{{ shopUrl }}" style="color:#9ca3af;">Visit store</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      },
    });
    console.log("✅ Created default template: back-in-stock");
  } else {
    console.log("ℹ️  back-in-stock template already exists, skipping seed.");
  }

  // Создаём welcome шаблон
  const welcomeExisting = await prisma.template.findUnique({
    where: { name: "welcome" },
  });
  if (!welcomeExisting) {
    await prisma.template.create({
      data: {
        name: "welcome",
        displayName: "Welcome Email",
        subject: "Welcome to {{ shopName }}!",
        htmlBody: `<h1>Hi {{ customerName }},</h1><p>Thanks for subscribing to {{ shopName }}!</p>`,
      },
    });
    console.log("✅ Created default template: welcome");
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });