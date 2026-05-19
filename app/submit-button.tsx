"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 active:bg-fuchsia-600 disabled:bg-fuchsia-700 disabled:opacity-70 text-white font-semibold text-lg py-4 transition"
    >
      {pending ? "Locking you in…" : "Lock me in"}
    </button>
  );
}
