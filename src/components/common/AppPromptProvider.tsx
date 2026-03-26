"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PromptContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

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
      <Toaster richColors closeButton position="top-center" />
      <AlertDialog
        open={confirmState.open}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeDialog(false)}>
              {confirmState.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmState.destructive ? "bg-destructive text-destructive-foreground" : ""
              }
              onClick={() => closeDialog(true)}
            >
              {confirmState.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
