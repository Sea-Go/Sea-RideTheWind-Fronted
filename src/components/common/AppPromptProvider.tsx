"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PromptContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export type ConfirmState = ConfirmOptions & {
  open: boolean;
};

const AppPromptDialog = dynamic(
  () =>
    import("@/components/common/AppPromptDialog").then((module) => module.AppPromptDialog),
  { ssr: false },
);
const AppToaster = dynamic(
  () => import("@/components/common/AppToaster").then((module) => module.AppToaster),
  { ssr: false },
);

const PromptContext = createContext<PromptContextValue | null>(null);

const defaultConfirmState: ConfirmState = {
  open: false,
  title: "",
  description: "",
  confirmText: "确认",
  cancelText: "取消",
  destructive: false,
};

export function AppPromptProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState>(defaultConfirmState);
  const [resolver, setResolver] = useState<((result: boolean) => void) | null>(null);
  const [showToaster, setShowToaster] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const requestIdle = window.requestIdleCallback;
    if (requestIdle) {
      const idleId = requestIdle(() => setShowToaster(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(() => setShowToaster(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const resetDialog = useCallback(() => {
    setConfirmState(defaultConfirmState);
    setResolver(null);
  }, []);

  const closeDialog = useCallback(
    (result: boolean) => {
      if (resolver) {
        resolver(result);
      }
      resetDialog();
    },
    [resetDialog, resolver],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      open: true,
      title: options.title,
      description: options.description,
      confirmText: options.confirmText ?? "确认",
      cancelText: options.cancelText ?? "取消",
      destructive: options.destructive ?? false,
    });

    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const contextValue = useMemo<PromptContextValue>(
    () => ({
      confirm,
    }),
    [confirm],
  );

  return (
    <PromptContext.Provider value={contextValue}>
      {children}
      {showToaster ? <AppToaster /> : null}
      {confirmState.open ? (
        <AppPromptDialog confirmState={confirmState} onClose={closeDialog} />
      ) : null}
    </PromptContext.Provider>
  );
}

export function useAppPrompt() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("useAppPrompt 必须在 AppPromptProvider 内部使用");
  }
  return context;
}
