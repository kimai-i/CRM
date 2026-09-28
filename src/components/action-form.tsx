"use client";

import { startTransition, type ComponentProps, type FormEvent } from "react";

/**
 * A <form> for useActionState actions that keeps what the user typed.
 *
 * React 19 resets a form's fields after a `<form action={...}>` submission — even when the server
 * returned a validation error — which wipes the user's input. Submitting through onSubmit avoids
 * that reset; forms that should clear on success do it themselves (formRef.reset()).
 */
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (formData: FormData) => void }) {
  return (
    <form
      {...props}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Include the clicked button's name/value (e.g. intent=submit).
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const formData = new FormData(e.currentTarget, submitter);
        startTransition(() => action(formData));
      }}
    />
  );
}
