"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { addTeamMember, changePassword, resetTeamMemberPassword, updateTeamMember, type SettingsState } from "./actions";
import { ActionForm } from "@/components/action-form";

function Message({ state, success }: { state: SettingsState; success: string }) {
  if (state.error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.ok) return <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>;
  return null;
}

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<SettingsState, FormData>(async (prev, fd) => {
    const res = await changePassword(prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});
  return (
    <ActionForm ref={formRef} action={action} className="space-y-3">
      <label className="block">
        <span className="label">Current password</span>
        <input name="current" type="password" required autoComplete="current-password" className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">New password</span>
        <input name="next" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Confirm new password</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
      </label>
      <Message state={state} success="Password changed." />
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Change password"}</button>
    </ActionForm>
  );
}

export function AddTeamMemberForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<SettingsState, FormData>(async (prev, fd) => {
    const res = await addTeamMember(prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});
  return (
    <ActionForm ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
      <label>
        <span className="label">Name</span>
        <input name="name" required className="input mt-1" />
      </label>
      <label>
        <span className="label">Email</span>
        <input name="email" type="email" required className="input mt-1" />
      </label>
      <label>
        <span className="label">Role</span>
        <select name="role" defaultValue="team" className="input mt-1">
          <option value="team">Team member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label>
        <span className="label">Temporary password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
      </label>
      <div className="sm:col-span-2 space-y-3">
        <Message state={state} success="Team member added. Share their temporary password privately." />
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Adding…" : "Add team member"}</button>
      </div>
    </ActionForm>
  );
}

export function TeamMemberControls({
  userId,
  role,
  isActive,
  editable,
}: {
  userId: string;
  role: "owner" | "admin" | "team";
  isActive: boolean;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState<SettingsState, FormData>(
    resetTeamMemberPassword.bind(null, userId),
    {},
  );

  const run = (change: { role?: "admin" | "team"; isActive?: boolean }) =>
    startTransition(async () => {
      const res = await updateTeamMember(userId, change);
      setError(res.error ?? null);
    });

  if (!editable) return <span className="text-xs text-slate-400">{role === "owner" ? "Owner" : "You"}</span>;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <select
          defaultValue={role}
          disabled={pending}
          onChange={(e) => run({ role: e.target.value as "admin" | "team" })}
          className="input w-auto py-1 text-xs"
        >
          <option value="team">Team member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="button" onClick={() => setResetting((v) => !v)} className="btn-ghost text-xs">Reset password</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ isActive: !isActive })}
          className={`btn-ghost text-xs ${isActive ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50"}`}
        >
          {isActive ? "Turn off access" : "Turn on access"}
        </button>
      </div>
      {resetting && (
        <ActionForm action={resetAction} className="flex items-center gap-2">
          <input name="password" type="password" minLength={8} required placeholder="New temporary password" autoComplete="new-password" className="input w-56 py-1 text-xs" />
          <button type="submit" disabled={resetPending} className="btn-secondary py-1 text-xs">Save</button>
        </ActionForm>
      )}
      {resetState.ok && <p className="text-xs text-green-700">Password reset.</p>}
      {(error || resetState.error) && <p className="text-xs text-red-600">{error ?? resetState.error}</p>}
    </div>
  );
}
