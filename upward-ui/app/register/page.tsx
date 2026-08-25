"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GraduationCapIcon } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const clientValidate = () => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 80) errors.name = "Name must be 2–80 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      errors.password = "Min 8 characters with at least 1 uppercase letter and 1 number.";
    }
    return errors;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = clientValidate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.length) {
          const serverErrors: Record<string, string> = {};
          for (const d of err.details) serverErrors[d.field] = d.issue;
          setFieldErrors(serverErrors);
        } else if (err.code === "DUPLICATE_RESOURCE" || err.status === 409) {
          setFieldErrors({ email: "This email is already registered. Try logging in." });
        } else {
          setError(err.message ?? "Registration failed.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="bg-primary text-primary-foreground mx-auto mb-2 flex size-11 items-center justify-center rounded-xl">
            <GraduationCapIcon className="size-6" />
          </span>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Free forever. Enroll in courses instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field data-invalid={fieldErrors.name ? true : undefined}>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <Input
                id="name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rahim Ahmed"
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && (
                <p className="text-destructive text-sm">{fieldErrors.name}</p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-destructive text-sm">{fieldErrors.email}</p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!fieldErrors.password}
              />
              <FieldDescription>Min 8 chars, at least 1 uppercase letter and 1 number.</FieldDescription>
              {fieldErrors.password && (
                <p className="text-destructive text-sm">{fieldErrors.password}</p>
              )}
            </Field>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create free account"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
