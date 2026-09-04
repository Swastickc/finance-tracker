import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  return <LoginForm next={next} />;
}
