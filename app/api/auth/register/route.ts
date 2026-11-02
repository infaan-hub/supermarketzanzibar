// POST /api/auth/register - Public customer registration.

import type { NextRequest } from "next/server";
import { json, created, validationError } from "@/lib/http";
import { registerCustomer } from "@/services/auth.service";
import { serializeUser } from "@/lib/serializers";
import { AuthError } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let username = "";
    let email = "";
    let fullName = "";
    let phone = "";
    let address = "";
    let password = "";
    let passwordConfirm = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      username = String(form.get("username") ?? "").trim();
      email = String(form.get("email") ?? "").trim();
      fullName = String(form.get("full_name") ?? form.get("fullName") ?? "").trim();
      phone = String(form.get("phone") ?? "").trim();
      address = String(form.get("address") ?? "").trim();
      password = String(form.get("password") ?? "");
      passwordConfirm = String(
        form.get("password_confirm") ?? form.get("passwordConfirm") ?? "",
      );
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      username = String(body.username ?? "").trim();
      email = String(body.email ?? "").trim();
      fullName = String(body.full_name ?? body.fullName ?? "").trim();
      phone = String(body.phone ?? "").trim();
      address = String(body.address ?? "").trim();
      password = String(body.password ?? "");
      passwordConfirm = String(body.password_confirm ?? body.passwordConfirm ?? "");
    }

    const errors: Record<string, string[]> = {};
    if (!username) errors.username = ["This field is required."];
    if (!email) errors.email = ["This field is required."];
    if (!fullName) errors.full_name = ["This field is required."];
    if (!phone) errors.phone = ["This field is required."];
    if (!password) errors.password = ["This field is required."];
    if (password && password.length < 8)
      errors.password = [...(errors.password ?? []), "Ensure this field has at least 8 characters."];
    if (password !== passwordConfirm)
      errors.password_confirm = ["Passwords do not match."];

    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const user = await registerCustomer({
      username,
      email,
      fullName,
      phone,
      address,
      password,
      passwordConfirm,
    });

    return created(serializeUser(user));
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "bad_request") {
        // Surface as field-level-ish detail.
        return json({ detail: error.message }, { status: 400 });
      }
      return json({ detail: error.message }, { status: error.status });
    }
    console.error("Register failed:", error);
    return json({ detail: "An unexpected error occurred." }, { status: 500 });
  }
}

export async function GET() {
  return json({ detail: "Use POST to register." }, { status: 405 });
}
