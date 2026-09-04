"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, passwordsMatch, SESSION_COOKIE } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const next = formData.get("next");
  const expected = process.env.APP_ACCESS_PASSWORD;

  if (!expected) {
    return { error: "No access password is configured on the server." };
  }
  if (typeof password !== "string" || password.length === 0 || !(await passwordsMatch(password, expected))) {
    return { error: "Incorrect password." };
  }

  const token = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(typeof next === "string" && next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
