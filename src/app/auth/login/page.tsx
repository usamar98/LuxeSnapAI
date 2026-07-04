import Link from "next/link";
import { ArrowLeftIcon, MailIcon, SparklesIcon } from "lucide-react";

import { signInWithEmail } from "@/app/auth/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost" }), "mb-4")}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to studio
        </Link>
        <Card className="border-border bg-card shadow-2xl shadow-black/30">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SparklesIcon />
            </div>
            <CardTitle>Sign in to LuxeSnap AI</CardTitle>
            <CardDescription>
              Magic-link auth keeps the editing workflow passwordless.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {params.sent ? (
              <Alert>
                <MailIcon />
                <AlertTitle>Check your inbox</AlertTitle>
                <AlertDescription>
                  We sent a sign-in link to {params.email ?? "your email"}.
                </AlertDescription>
              </Alert>
            ) : null}

            {params.error ? (
              <Alert variant="destructive">
                <AlertTitle>Sign in failed</AlertTitle>
                <AlertDescription>{params.error}</AlertDescription>
              </Alert>
            ) : null}

            <form action={signInWithEmail} className="flex flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                  <FieldDescription>
                    Your account, credits, and renders stay attached to this email.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <Button type="submit" size="lg">
                <MailIcon data-icon="inline-start" />
                Send magic link
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
