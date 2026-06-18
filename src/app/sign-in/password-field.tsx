"use client";

import { useState } from "react";
import { IconEye, IconEyeOff, IconLock } from "@/components/icons";

export function PasswordField() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="sign-in-stagger-4">
      <label
        htmlFor="sign-in-password"
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        Password
      </label>
      <div className="relative">
        <IconLock
          width={16}
          height={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          id="sign-in-password"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          required
          placeholder="Enter your password"
          className="block w-full rounded-xl border border-surface-border-strong/80 bg-white px-4 py-3 pl-11 pr-11 text-sm text-zinc-900 shadow-sm transition-all placeholder:text-zinc-400 hover:border-zinc-300 hover:shadow-md focus-ring"
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((value) => !value)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 focus-ring"
        >
          {showPassword ? (
            <IconEyeOff width={16} height={16} />
          ) : (
            <IconEye width={16} height={16} />
          )}
        </button>
      </div>
    </div>
  );
}
