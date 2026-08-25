"use client";

import * as React from "react";
import { usersApi, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { AuthGuard } from "@/components/guards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/format";
import { SaveIcon } from "lucide-react";

function SettingsInner() {
  const { user, refreshUser } = useAuth();

  const [name, setName] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [savingPw, setSavingPw] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  const toastRef = React.useRef<typeof import("sonner").toast | null>(null);
  React.useEffect(() => {
    import("sonner").then((m) => (toastRef.current = m.toast));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await usersApi.updateMe({
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });
      await refreshUser();
      toastRef.current?.success("Profile updated");
    } catch (err) {
      toastRef.current?.error(err instanceof ApiError ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPwError("New password must be min 8 chars with 1 uppercase and 1 number.");
      return;
    }
    setSavingPw(true);
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toastRef.current?.success("Password changed. You may need to log in again on other devices.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setPwError("Your current password is incorrect.");
      } else {
        toastRef.current?.error(err instanceof ApiError ? err.message : "Could not change password");
      }
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Member since {formatDate(user?.createdAt)} · Role: <span className="capitalize">{user?.role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={user?.email ?? ""} disabled />
              <FieldDescription>Email cannot be changed.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="avatar">Avatar URL</FieldLabel>
              <Input
                id="avatar"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://cdn.example.com/avatar.png"
              />
            </Field>
            <Button type="submit" disabled={savingProfile}>
              <SaveIcon /> {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="my-10" />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Changing your password signs you out everywhere else.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="current-password">Current password</FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <FieldDescription>Min 8 chars with at least 1 uppercase letter and 1 number.</FieldDescription>
            </Field>
            {pwError && (
              <p className="text-destructive text-sm" role="alert">
                {pwError}
              </p>
            )}
            <Button type="submit" variant="outline" disabled={savingPw}>
              {savingPw ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsInner />
    </AuthGuard>
  );
}
