"use client";

import { useActionState } from "react";
import { createOwner, type SetupState } from "./actions";
import { ActionForm } from "@/components/action-form";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(createOwner, {});
  return (
    <ActionForm action={action} className="mt-5 space-y-4">
      <label className="block">
        <span className="label">Your name</span>
        <input name="name" required maxLength={200} autoComplete="name" className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="email" className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Confirm password</span>
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input mt-1" />
      </label>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Setting up…" : "Create owner account"}</button>
    </ActionForm>
  );
}
