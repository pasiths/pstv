"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession, getCurrentUser } from "@/lib/session";
import { canAccessAdmin } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export type AuthResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
};

function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("connection terminated") ||
    message.includes("connect etimedout") ||
    message.includes("getaddrinfo")
  );
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const headersList = await headers();
    const rawIp =
      headersList.get("x-forwarded-for") ??
      headersList.get("x-real-ip") ??
      "unknown";
    const ipAddress = rawIp.split(",")[0].trim();
    const userAgent = headersList.get("user-agent") ?? "unknown";

    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }

    const activeUser = await prisma.user.findFirst({
      where: { email, inactive: false },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!activeUser || !activeUser.password) {
      return { success: false, error: "Invalid email or password." };
    }

    if (activeUser.suspended) {
      return { success: false, error: "This account has been suspended." };
    }

    const isValidPassword = await bcrypt.compare(password, activeUser.password);
    if (!isValidPassword) {
      return { success: false, error: "Invalid email or password." };
    }

    await createSession(activeUser.id, { ipAddress, userAgent });

    const redirectTo = canAccessAdmin(activeUser) ? "/dashboard" : "/";
    return { success: true, redirectTo };
  } catch (error: unknown) {
    console.error("[loginUser]", error);
    if (isDatabaseConnectionError(error)) {
      return {
        success: false,
        error: "Unable to reach the database. Please try again.",
      };
    }
    return { success: false, error: "Failed to login." };
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!name || !email || !password) {
      return { success: false, error: "All fields are required." };
    }
    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters.",
      };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An account with this email exists." };
    }

    const userRole = await prisma.role.findUnique({ where: { slug: "user" } });
    if (!userRole) {
      return { success: false, error: "User role is not configured." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: userRole.id } },
      },
    });

    const headersList = await headers();
    const rawIp =
      headersList.get("x-forwarded-for") ??
      headersList.get("x-real-ip") ??
      "unknown";
    await createSession(user.id, {
      ipAddress: rawIp.split(",")[0].trim(),
      userAgent: headersList.get("user-agent") ?? "unknown",
    });

    return { success: true, redirectTo: "/" };
  } catch (error: unknown) {
    console.error("[registerUser]", error);
    return { success: false, error: "Failed to register." };
  }
}

export async function logoutUser() {
  await clearSession();
  redirect("/login");
}

export async function updateProfile(input: {
  name: string;
  phoneNo?: string;
}): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: input.name.trim(),
      phoneNo: input.phoneNo?.trim() || null,
    },
  });

  return { success: true };
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.password) {
    return { success: false, error: "Password login is not available." };
  }

  const ok = await bcrypt.compare(input.currentPassword, dbUser.password);
  if (!ok) return { success: false, error: "Current password is incorrect." };
  if (input.newPassword.length < 8) {
    return {
      success: false,
      error: "New password must be at least 8 characters.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(input.newPassword, 10) },
  });

  return { success: true };
}
