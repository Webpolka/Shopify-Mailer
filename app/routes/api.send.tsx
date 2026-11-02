import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import prisma from "../db.server";
import { sendEmail } from "../mailer.server";
import { renderLiquid } from "../liquid.server";

/**
 * Public webhook endpoint for Shopify Flow.
 *
 * URL: /api/send
 * Method: POST
 * Headers required:
 *   Content-Type: application/json
 *   x-flow-secret: <your FLOW_SECRET value>
 *
 * Body (JSON):
 * {
 *   "template": "back-in-stock",
 *   "customerEmail": "user@example.com",
 *   "variables": {
 *     "customerName": "John",
 *     "productTitle": "Wheat Grass Powder",
 *     "productUrl": "https://...",
 *     "productImage": "https://...",
 *     ...
 *   }
 * }
 */

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // Auth: secret header check
  const secret = request.headers.get("x-flow-secret");
  const expected = process.env.FLOW_SECRET;

  if (!expected || expected === "dev-secret-change-me-in-production") {
    console.warn(
      "⚠️  FLOW_SECRET not set or using default. Refusing to process webhook."
    );
    return data(
      {
        error:
          "Server is not configured. Set FLOW_SECRET in .env to a random value.",
      },
      { status: 500 }
    );
  }

  if (secret !== expected) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: {
    template?: string;
    customerEmail?: string;
    variables?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { template: templateName, customerEmail, variables } = body;

  if (!templateName || typeof templateName !== "string") {
    return data(
      { error: "Missing or invalid 'template' field" },
      { status: 400 }
    );
  }
  if (!customerEmail || typeof customerEmail !== "string") {
    return data(
      { error: "Missing or invalid 'customerEmail' field" },
      { status: 400 }
    );
  }

  const vars = variables || {};

  // Load template
  const template = await prisma.template.findUnique({
    where: { name: templateName },
  });

  if (!template) {
    return data(
      { error: `Template '${templateName}' not found` },
      { status: 404 }
    );
  }

  // Render Liquid in subject and body
  const subject = await renderLiquid(template.subject, vars);
  const html = await renderLiquid(template.htmlBody, vars);

  // Send via SMTP
  try {
    const result = await sendEmail({
      to: customerEmail,
      subject,
      html,
    });

    return data({
      success: true,
      messageId: result.messageId,
      provider: result.provider,
    });
  } catch (err) {
    const error = err as Error;
    return data(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET returns endpoint info (for sanity checks)
export function loader({}: LoaderFunctionArgs) {
  return data(
    {
      endpoint: "/api/send",
      method: "POST",
      requiredHeaders: ["Content-Type: application/json", "x-flow-secret"],
      docs: "Shopify Flow webhook endpoint. See /app for full docs.",
    },
    { status: 200 }
  );
}