import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "fluxtv_session";

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const secureCookie =
    process.env.COOKIE_SECURE === "true"
      ? true
      : process.env.COOKIE_SECURE === "false"
        ? false
        : appUrl.startsWith("https://");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return session;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          emailVerified: true,
          image: true,
          inactive: true,
          suspended: true,
          roles: {
            select: {
              role: {
                select: {
                  name: true,
                  slug: true,
                  permissions: {
                    select: {
                      permission: {
                        select: {
                          name: true,
                          slug: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  if (session.user.inactive || session.user.suspended) {
    return null;
  }

  return session.user;
}
