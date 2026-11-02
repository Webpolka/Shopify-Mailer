import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, AlertTriangle, CheckCircle2, Webhook } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const templates = await prisma.template.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const flowSecretSet = Boolean(
    process.env.FLOW_SECRET &&
      process.env.FLOW_SECRET !== "dev-secret-change-me-in-production"
  );
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  );

  return {
    templates,
    flowSecretSet,
    smtpConfigured,
    appUrl: process.env.SHOPIFY_APP_URL || "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const id = formData.get("id");

  if (action === "delete" && typeof id === "string") {
    await prisma.template.delete({ where: { id } });
    return { deleted: true };
  }

  return null;
};

export default function Dashboard() {
  const { templates, flowSecretSet, smtpConfigured, appUrl } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const webhookUrl = `${appUrl}/api/send`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="BIS Mailer Dashboard"
        description="Custom email templates for Shopify Flow webhooks"
        actions={
          <Button nativeButton={false} render={
            <Link to="/app/templates/new">
              <Plus className="size-4" />
              New template
            </Link>
          }/>
        }
      />

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {smtpConfigured ? (
                <CheckCircle2 className="size-4 text-green-600" />
              ) : (
                <AlertTriangle className="size-4 text-yellow-600" />
              )}
              SMTP
            </CardTitle>
          </CardHeader>
          <CardContent>
            {smtpConfigured ? (
              <p className="text-sm text-muted-foreground">
                Connected to <code className="text-foreground">{process.env.SMTP_HOST}</code>.
                Emails will be sent via real SMTP.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not configured. Emails go to <strong>Ethereal Email</strong>{" "}
                (test inbox, nothing actually sent). Set <code>SMTP_HOST</code>,{" "}
                <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code> in{" "}
                <code>.env</code> to switch to real SMTP.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {flowSecretSet ? (
                <CheckCircle2 className="size-4 text-green-600" />
              ) : (
                <AlertTriangle className="size-4 text-yellow-600" />
              )}
              Flow webhook secret
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flowSecretSet ? (
              <p className="text-sm text-muted-foreground">
                <code className="text-foreground">FLOW_SECRET</code> is set.
                Webhook endpoint is protected.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                <code className="text-foreground">FLOW_SECRET</code> not set or
                default. Set a random value in <code>.env</code> (e.g.{" "}
                <code>openssl rand -hex 32</code>).
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook endpoint */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="size-4" />
            Flow webhook endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use this URL in your Shopify Flow&rsquo;s{" "}
            <strong>Send HTTP request</strong> action:
          </p>
          <div className="bg-muted rounded-md p-3 font-mono text-xs break-all">
            {webhookUrl}
          </div>
          <div className="text-sm">
            <p className="font-medium mb-1">Headers:</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
              <code>{`Content-Type: application/json
x-flow-secret: <your FLOW_SECRET value>`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Templates list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Templates ({templates.length})
        </h2>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No templates yet. Create your first template to start sending
              emails from Shopify Flow.
            </p>
            <Button nativeButton={false} render={
              <Link to="/app/templates/new">
                <Plus className="size-4" />
                Create template
              </Link>
            }/>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/app/templates/${t.id}`}
                      className="text-base font-semibold hover:text-primary truncate block"
                    >
                      {t.displayName}
                    </Link>
                    <Badge variant="outline" className="mt-1 font-mono text-xs">
                      {t.name}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  Subject: {t.subject}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {new Date(t.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/app/templates/${t.id}`}
                      className="text-primary hover:underline"
                    >
                      Edit →
                    </Link>
                    <Form method="post" className="inline">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </Form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {actionData?.deleted && (
        <div className="mt-4 text-sm text-muted-foreground">
          Template deleted.
        </div>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
