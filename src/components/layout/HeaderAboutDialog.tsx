"use client";

import { XIcon } from "lucide-react";
import type { CSSProperties } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const aboutContentLines = [
  "欢迎加入识海社区。",
  "QQ群：750807478",
  "开源推荐系统：https://github.com/Sea-Go/Sea-BreakTheWaves",
  "开源后端：https://github.com/Sea-Go/Sea-BreakTheWaves",
  "开源前端：https://github.com/Sea-Go/Sea-RideTheWind-Fronted",
];

interface HeaderAboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeStyle?: CSSProperties;
}

export const HeaderAboutDialog = ({ open, onOpenChange, themeStyle }: HeaderAboutDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent
      className="border-border bg-card text-card-foreground max-w-xl rounded-3xl p-0 shadow-2xl shadow-black/15"
      style={themeStyle}
    >
      <div className="relative overflow-hidden rounded-3xl p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80"
          style={{ backgroundImage: "var(--app-page-overlay)" }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 rounded-full"
          onClick={() => onOpenChange(false)}
          aria-label="关闭关于弹窗"
        >
          <XIcon className="size-4" />
        </Button>

        <div className="relative space-y-4 pr-10">
          <div className="space-y-2">
            <AlertDialogTitle className="text-foreground text-2xl font-semibold tracking-tight">
              关于识海社区
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm leading-7 whitespace-pre-line">
              {aboutContentLines.join("\n")}
            </AlertDialogDescription>
          </div>
        </div>
      </div>
    </AlertDialogContent>
  </AlertDialog>
);
