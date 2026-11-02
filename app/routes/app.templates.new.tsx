import { useRef, useState } from "react";
import jsBeautify from "js-beautify";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  Link,
  redirect,
  useActionData,
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
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { VariableSidebar } from "../components/variableSidebar";
import { ArrowLeft, Save, Code, Code2, Wand2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const beautifyHtml = (jsBeautify as any).html as (
  html: string,
  opts?: Record<string, unknown>
) => string;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const name = (formData.get("name") as string)?.trim();
  const displayName = (formData.get("displayName") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim();
  const htmlBody = (formData.get("htmlBody") as string)?.trim();

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Required";
  if (!displayName) errors.displayName = "Required";
  if (!subject) errors.subject = "Required";
  if (!htmlBody) errors.htmlBody = "Required";

  if (!/^[a-z0-9-]+$/i.test(name || "")) {
    errors.name =
      "Only letters, numbers, and dashes. e.g. back-in-stock, welcome, win-back";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { name, displayName, subject, htmlBody } };
  }

  const existing = await prisma.template.findUnique({ where: { name } });
  if (existing) {
    return {
      errors: { name: "A template with this name already exists" },
      values: { name, displayName, subject, htmlBody },
    };
  }

  const template = await prisma.template.create({
    data: { name, displayName, subject, htmlBody },
  });

  return redirect(`/app/templates/${template.id}`);
};

export default function NewTemplate() {
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [htmlFormatted, setHtmlFormatted] = useState(false);

  const isSubmitting =
    navigation.state === "submitting" && navigation.formMethod === "POST";

  const initialValues = actionData?.values || {};
  const errors = actionData?.errors || {};

  useState(() => {
    if (initialValues.name) setName(initialValues.name);
    if (initialValues.displayName) setDisplayName(initialValues.displayName);
    if (initialValues.subject) setSubject(initialValues.subject);
    if (initialValues.htmlBody) setHtmlBody(initialValues.htmlBody);
  });

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

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + liquid.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("displayName", displayName);
    formData.set("subject", subject);
    formData.set("htmlBody", htmlBody);
    submit(formData, { method: "post" });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="New template"
        description="Create a reusable email template with Liquid variables"
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link to="/app/templates">
                <ArrowLeft className="size-4" />
                Back to list
              </Link>
            }
          />
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Template details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Create a reusable email template with full HTML + inline styles.
            Use Liquid variables like{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{`{{ customerName }}`}</code>{" "}
            — they will be filled in by Flow&rsquo;s webhook payload.
          </p>

          <div className="space-y-2">
            <Label htmlFor="name">
              Template name (slug) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="back-in-stock"
              className="font-mono"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Used in the API URL:{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                /api/send?template=NAME
              </code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">
              Display name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Back in Stock Notification"
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              Email subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`Good news! {{ productTitle }} is back in stock`}
            />
            {errors.subject && (
              <p className="text-xs text-destructive">{errors.subject}</p>
            )}
          </div>
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
                  Liquid variables are <strong>not</strong> rendered here —
                  save the template and use Test send to see fully rendered
                  output.
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
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {errors.htmlBody && (
                <span className="text-destructive">{errors.htmlBody}</span>
              )}
            </p>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              <Save className="size-4" />
              {isSubmitting ? "Creating..." : "Create template"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form method="post" className="hidden">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="displayName" value={displayName} />
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="htmlBody" value={htmlBody} />
      </Form>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};