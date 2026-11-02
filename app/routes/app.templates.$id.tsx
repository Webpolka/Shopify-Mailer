import { useEffect, useRef, useState } from "react";
import jsBeautify from "js-beautify";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { VariableSidebar } from "../components/variableSidebar";
import {
  ArrowLeft,
  Save,
  Send,
  Code,
  Webhook,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  Wand2,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const beautifyHtml = (jsBeautify as any).html as (
  html: string,
  opts?: Record<string, unknown>
) => string;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const template = await prisma.template.findUnique({
    where: { id: params.id },
  });

  if (!template) {
    throw new Response("Not found", { status: 404 });
  }

  return {
    template,
    appUrl: process.env.SHOPIFY_APP_URL || "",
    flowSecret: process.env.FLOW_SECRET || "",
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save") {
    const displayName = (formData.get("displayName") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const htmlBody = (formData.get("htmlBody") as string)?.trim();

    const errors: Record<string, string> = {};
    if (!displayName) errors.displayName = "Required";
    if (!subject) errors.subject = "Required";
    if (!htmlBody) errors.htmlBody = "Required";

    if (Object.keys(errors).length > 0) {
      return { errors, values: { displayName, subject, htmlBody } };
    }

    await prisma.template.update({
      where: { id: params.id },
      data: { displayName, subject, htmlBody },
    });

    return { saved: true };
  }

  if (intent === "test-send") {
    const testEmail = (formData.get("testEmail") as string)?.trim();
    if (!testEmail) {
      return { testError: "Email is required" };
    }

    const { sendEmail } = await import("../mailer.server");
    const { renderLiquid } = await import("../liquid.server");

    const template = await prisma.template.findUnique({
      where: { id: params.id },
    });
    if (!template) return { testError: "Template not found" };

    const sampleVars = {
      customerEmail: testEmail,
      customerName: "Test Customer",
      customerId: "12345",
      productTitle: "Sample Product Name",
      productUrl: "https://example.com/products/sample",
      productImage: "https://via.placeholder.com/300x200",
      productPrice: "$29.99",
      productHandle: "sample",
      shopName: "Test Shop",
      shopUrl: "https://example.com",
    };

    try {
      const subject = await renderLiquid(template.subject, sampleVars);
      const html = await renderLiquid(template.htmlBody, sampleVars);

      const result = await sendEmail({
        to: testEmail,
        subject,
        html,
      });

      return {
        testResult: {
          success: result.success,
          previewUrl: result.previewUrl,
          provider: result.provider,
          messageId: result.messageId,
        },
      };
    } catch (err) {
      const error = err as Error;
      return { testError: error.message };
    }
  }

  return null;
};

export default function EditTemplate() {
  const { template, appUrl, flowSecret } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const [htmlBody, setHtmlBody] = useState(template.htmlBody);
  const [displayName, setDisplayName] = useState(template.displayName);
  const [subject, setSubject] = useState(template.subject);
  const [testEmail, setTestEmail] = useState("");
  const [htmlFormatted, setHtmlFormatted] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";

  const isTesting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "test-send";

  useEffect(() => {
    setHtmlBody(template.htmlBody);
    setDisplayName(template.displayName);
    setSubject(template.subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.updatedAt]);

  const formatHtml = (html: string): string => {
    try {
      return beautifyHtml(html, {
        indent_size: 2,
        wrap_line_length: 0,
        preserve_newlines: false,
        end_with_newline: false,
      });
    } catch {
      return html;
    }
  };

  const minifyHtml = (html: string): string => {
    return html
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .replace(/^\s+|\s+$/g, "")
      .trim();
  };

  const getDisplayedHtml = (): string => {
    if (htmlFormatted) {
      return formatHtml(htmlBody);
    }
    return minifyHtml(htmlBody);
  };

  const toggleFormat = () => {
    setHtmlFormatted((prev) => !prev);
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHtmlBody(e.target.value);
  };

  // Insert Liquid variable at cursor position in textarea
  const handleInsertVariable = (liquid: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setHtmlBody((prev) => prev + liquid);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText =
      htmlBody.substring(0, start) + liquid + htmlBody.substring(end);
    setHtmlBody(newText);

    // Restore cursor after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + liquid.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.set("intent", "save");
    formData.set("displayName", displayName);
    formData.set("subject", subject);
    formData.set("htmlBody", htmlBody);
    submit(formData, { method: "post" });
  };

  const handleTestSend = () => {
    const formData = new FormData();
    formData.set("intent", "test-send");
    formData.set("testEmail", testEmail);
    submit(formData, { method: "post" });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={`Edit: ${template.displayName}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link to="/app">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            }
          />
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Template details
            {actionData?.saved && (
              <Badge variant="success" className="ml-2">
                <CheckCircle2 className="size-3 mr-1" />
                Saved
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {template.name}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {actionData?.errors?.displayName && (
              <p className="text-xs text-destructive">
                {actionData.errors.displayName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            {actionData?.errors?.subject && (
              <p className="text-xs text-destructive">
                {actionData.errors.subject}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Liquid variables supported, e.g.{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{`{{ productTitle }}`}</code>
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Email body</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="html" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="html">
                <Code2 className="size-4 mr-1" />
                HTML
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Code className="size-4 mr-1" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="api">
                <Webhook className="size-4 mr-1" />
                Flow integration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="min-h-[600px]">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 h-full">
                <div className="flex flex-col gap-2">
                  <div className="bg-muted border rounded-md p-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      Paste full HTML with inline styles. Liquid variables
                      supported:{" "}
                      <code className="bg-background px-1 py-0.5 rounded">{`{{ customerName }}`}</code>
                    </p>
                    <Button
                      variant={htmlFormatted ? "default" : "outline"}
                      size="sm"
                      onClick={toggleFormat}
                      title={
                        htmlFormatted
                          ? "Currently formatted. Click to minify."
                          : "Currently minified. Click to format."
                      }
                    >
                      <Wand2 className="size-4" />
                      {htmlFormatted ? "Minify" : "Format"}
                    </Button>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    value={getDisplayedHtml()}
                    onChange={handleHtmlChange}
                    className="font-mono text-xs min-h-[540px]"
                    placeholder="<!DOCTYPE html>..."
                  />
                </div>
                <VariableSidebar onInsert={handleInsertVariable} />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="min-h-[600px]">
              <div className="bg-muted border rounded-md p-3 mb-2">
                <p className="text-xs text-muted-foreground">
                  Preview shows the email as it will appear in Gmail/Outlook.
                  Liquid variables are <strong>not</strong> rendered here — use
                  Test send to see fully rendered output.
                </p>
              </div>
              <div className="border rounded-md overflow-hidden bg-white min-h-[540px]">
                <iframe
                  title="email-preview"
                  srcDoc={htmlBody}
                  className="w-full h-[540px] border-0"
                />
              </div>
            </TabsContent>

            <TabsContent value="api" className="min-h-[600px]">
              <FlowIntegration
                templateName={template.name}
                appUrl={appUrl}
                flowSecret={flowSecret}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Send a test email to yourself. Uses sample variables and renders
            Liquid through the same pipeline that Shopify Flow will use.
          </p>

          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="testEmail">Test recipient email</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleTestSend}
              disabled={isTesting || !testEmail}
            >
              <Send className="size-4" />
              {isTesting ? "Sending..." : "Send test"}
            </Button>
          </div>

          {actionData?.testResult && (
            <div
              className={`rounded-md border p-4 ${
                actionData.testResult.success
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {actionData.testResult.success ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4" />
                    Test email sent via{" "}
                    <Badge variant="secondary">
                      {actionData.testResult.provider}
                    </Badge>
                  </p>
                  {actionData.testResult.previewUrl && (
                    <p className="text-sm">
                      📧 Preview URL (Ethereal — opens in browser):
                      <br />
                      <a
                        href={actionData.testResult.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all inline-flex items-center gap-1"
                      >
                        {actionData.testResult.previewUrl}
                        <ExternalLink className="size-3 inline" />
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <p>Failed to send</p>
              )}
            </div>
          )}

          {actionData?.testError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-900 flex items-start gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <p className="text-sm">{actionData.testError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Form method="post" className="hidden">
        <input type="hidden" name="intent" value="save" />
        <input type="hidden" name="displayName" value={displayName} />
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="htmlBody" value={htmlBody} />
      </Form>
    </div>
  );
}

function FlowIntegration({
  templateName,
  appUrl,
  flowSecret,
}: {
  templateName: string;
  appUrl: string;
  flowSecret: string;
}) {
  const webhookUrl = `${appUrl}/api/send`;
  const bodyJson = `{
  "template": "${templateName}",
  "customerEmail": "{{ getCustomerDataForeachitem.email }}",
  "customerName": "{{ getCustomerDataForeachitem.firstName }}",
  "variables": {
    "productTitle": "{{ productVariant.product.title }}",
    "productUrl": "https://your-store.com/products/{{ productVariant.product.handle }}",
    "productImage": "{{ productVariant.product.featuredImage.url }}",
    "productPrice": "{{ productVariant.price }}",
    "productHandle": "{{ productVariant.product.handle }}"
  }
}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure this in your Shopify Flow&rsquo;s{" "}
        <strong>Send HTTP request</strong> action:
      </p>

      <div className="space-y-2">
        <Label>Method</Label>
        <div className="bg-muted rounded-md p-2 font-mono text-sm w-fit">
          POST
        </div>
      </div>

      <div className="space-y-2">
        <Label>URL</Label>
        <div className="bg-muted rounded-md p-2 font-mono text-xs break-all">
          {webhookUrl}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Headers</Label>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
          <code>{`Content-Type: application/json
x-flow-secret: ${flowSecret || "<your FLOW_SECRET value>"}`}</code>
        </pre>
      </div>

      <div className="space-y-2">
        <Label>Body (JSON, with Flow Liquid inside)</Label>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
          <code>{bodyJson}</code>
        </pre>
        <p className="text-xs text-muted-foreground">
          Note: Flow renders the Liquid inside JSON before sending, so your
          backend receives actual values (not the Liquid syntax).
        </p>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};