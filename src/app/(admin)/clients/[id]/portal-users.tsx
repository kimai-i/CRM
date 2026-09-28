"use client";

import { useActionState, useRef, useTransition } from "react";
import { addPortalUser, setPortalUserActive, type PortalUserState } from "../actions";
import { ActionForm } from "@/components/action-form";

export function AddPortalUserForm({ clientId }: { clientId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<PortalUserState, FormData>(async (prev, formData) => {
    const res = await addPortalUser(clientId, prev, formData);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});

  return (
    <ActionForm ref={formRef} action={action} className="space-y-3">
      <label className="block">
        <span className="label">Name</span>
        <input name="name" required className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Temporary password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
      </label>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Login created.</p>}
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Creating…" : "Create login"}</button>
    </ActionForm>
  );
}

export function PortalUserToggle({ clientId, userId, isActive }: { clientId: string; userId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setPortalUserActive(clientId, userId, !isActive))}
      className={isActive ? "btn-ghost text-red-600 hover:bg-red-50" : "btn-ghost text-green-700 hover:bg-green-50"}
    >
      {isActive ? "Turn off access" : "Turn on access"}
    </button>
  );
}
