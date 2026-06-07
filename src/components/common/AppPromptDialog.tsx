"use client";

import type { ConfirmState } from "@/components/common/AppPromptProvider";
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

interface AppPromptDialogProps {
  confirmState: ConfirmState;
  onClose: (result: boolean) => void;
}

export function AppPromptDialog({ confirmState, onClose }: AppPromptDialogProps) {
  return (
    <AlertDialog
      open={confirmState.open}
      onOpenChange={(open) => {
        if (!open) {
          onClose(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose(false)}>
            {confirmState.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            className={confirmState.destructive ? "bg-destructive text-destructive-foreground" : ""}
            onClick={() => onClose(true)}
          >
            {confirmState.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
