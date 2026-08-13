"use client";

import { useState, useTransition } from "react";
import { changePassword, updateProfile } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function SettingsForm({
  name,
  email,
  phoneNo,
}: {
  name: string;
  email: string;
  phoneNo?: string | null;
}) {
  const [profile, setProfile] = useState({
    name,
    phoneNo: phoneNo ?? "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await updateProfile(profile);
            if (res.success) toast.success("Profile updated");
            else toast.error(res.error ?? "Failed");
          });
        }}
      >
        <h2 className="font-medium">Profile</h2>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input value={email} disabled />
        </div>
        <div className="space-y-1">
          <Label>Name</Label>
          <Input
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input
            value={profile.phoneNo}
            onChange={(e) =>
              setProfile((p) => ({ ...p, phoneNo: e.target.value }))
            }
          />
        </div>
        <Button type="submit" disabled={pending}>
          Save profile
        </Button>
      </form>

      <form
        className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await changePassword(passwords);
            if (res.success) {
              toast.success("Password changed");
              setPasswords({ currentPassword: "", newPassword: "" });
            } else toast.error(res.error ?? "Failed");
          });
        }}
      >
        <h2 className="font-medium">Change password</h2>
        <div className="space-y-1">
          <Label>Current password</Label>
          <Input
            type="password"
            value={passwords.currentPassword}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, currentPassword: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1">
          <Label>New password</Label>
          <Input
            type="password"
            value={passwords.newPassword}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, newPassword: e.target.value }))
            }
            minLength={8}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
