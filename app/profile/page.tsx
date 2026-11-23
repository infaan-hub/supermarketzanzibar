// Current user profile & password page (`/profile`).

"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import {
  deleteProfileImage,
  updateMe,
  uploadProfileImage,
} from "@/lib/api";
import { roleLabel } from "@/lib/auth/roles";
import { formatBusinessDateTime } from "@/lib/format";

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [imageBust, setImageBust] = useState<string>("");
  const [imgFailed, setImgFailed] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name);
    setEmail(user.email);
    setPhone(user.phone);
    setAddress(user.address);
    setImgFailed(false);
  }, [user]);

  const handleUploadPhoto = async (file: File) => {
    setUploadingImage(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      const res = await uploadProfileImage(file);
      setImageBust(res.updatedAt || String(Date.now()));
      setImgFailed(false);
      await refreshUser();
      setProfileMsg("Profile image updated.");
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Unable to upload profile image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    setRemovingImage(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      await deleteProfileImage();
      setImageBust(String(Date.now()));
      await refreshUser();
      setProfileMsg("Profile image removed.");
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Unable to remove profile image.",
      );
    } finally {
      setRemovingImage(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      await updateMe({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      await refreshUser();
      setProfileMsg("Profile saved.");
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Unable to update profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await updateMe({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password updated successfully.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Unable to change password.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  const initials = (user.full_name || user.username).slice(0, 2).toUpperCase();
  const hasPhoto = Boolean(user.profile_image_available || user.profile_image_url) && !imgFailed;
  const photoUrl = user.profile_image_url
    ? `${user.profile_image_url}${imageBust ? `&b=${encodeURIComponent(imageBust)}` : ""}`
    : `/api/auth/me/image?u=${encodeURIComponent(user.id)}&b=${encodeURIComponent(imageBust || "1")}`;

  return (
    <div className="mx-auto max-w-[1040px] space-y-6">
      <PageHeader
        title="My Profile"
        description={`@${user.username}${user.last_login ? ` · Last sign-in ${formatBusinessDateTime(user.last_login)}` : ""}`}
        actions={
          <>
            <Badge variant="default">{roleLabel(user.role)}</Badge>
            <Button size="sm" variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          </>
        }
      />

      {/* Profile Image Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#4CAF50] bg-[#1c1c1e] text-xl font-bold text-white shadow-lg">
                {hasPhoto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoUrl}
                    alt={user.full_name || user.username}
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div>
                <p className="font-display text-base font-bold text-white">
                  {user.full_name || user.username}
                </p>
                <p className="text-xs text-[#4CAF50]">
                  {roleLabel(user.role)} · @{user.username}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Upload a JPG, PNG, WebP, or GIF image (up to 5 MB) for your
                  account avatar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleUploadPhoto(file);
                }}
              />
              <Button
                type="button"
                size="sm"
                isLoading={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasPhoto ? "Change Profile Image" : "+ Add Profile Image"}
              </Button>
              {hasPhoto && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  isLoading={removingImage}
                  onClick={() => void handleRemovePhoto()}
                >
                  Remove Photo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileError && (
                <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                  {profileError}
                </div>
              )}
              {profileMsg && (
                <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">
                  {profileMsg}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Button type="submit" isLoading={savingProfile}>
                Save Details
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                  {passwordError}
                </div>
              )}
              {passwordMsg && (
                <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">
                  {passwordMsg}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Current Password</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                isLoading={savingPassword}
              >
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
