"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/auth/actions";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <p className="text-[17px] font-semibold">Finance</p>
        <p className="mt-1 text-sm text-muted">Enter the access password to continue.</p>

        <form action={formAction} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input type="password" name="password" placeholder="Password" autoFocus required aria-label="Access password" />
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
