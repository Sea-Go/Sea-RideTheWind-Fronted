"use client";

import { useEffect } from "react";

import { getAuthToken, getUserProfile } from "@/services/auth";
import {
  buildGuestRecoUserId,
  buildUserRecoKey,
  fetchRecommendSnapshot,
  getOrCreateRecoSessionId,
} from "@/services/reco-snapshot";

const RECOMMEND_SURFACE = "dashboard_recommend";

type BrowserWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export const RecoPrewarm = () => {
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const win = window as BrowserWindow;

    const prewarmByUser = async (userId: string, userKey: string, sessionId: string) => {
      try {
        await fetchRecommendSnapshot({
          userId,
          userKey,
          sessionId,
          surface: RECOMMEND_SURFACE,
          query: "",
          periodBucket: "d1",
        });
      } catch (error) {
        console.warn("Failed to prewarm recommend snapshot:", error);
      }
    };

    const runPrewarm = async () => {
      const sessionId = getOrCreateRecoSessionId();
      const guestUserId = buildGuestRecoUserId(sessionId);
      const guestUserKey = buildUserRecoKey(guestUserId);

      void prewarmByUser(guestUserId, guestUserKey, sessionId);

      const token = getAuthToken();
      if (!token) {
        return;
      }

      try {
        const profile = await getUserProfile(token);
        const uid = profile.user.uid?.trim();
        if (!uid || cancelled) {
          return;
        }

        const userKey = buildUserRecoKey(uid);
        void prewarmByUser(uid, userKey, sessionId);
      } catch (error) {
        console.warn("Failed to resolve user while prewarming recommend:", error);
      }
    };

    const schedulePrewarm = () => {
      if (typeof win.requestIdleCallback === "function") {
        idleId = win.requestIdleCallback(() => {
          if (!cancelled) {
            void runPrewarm();
          }
        });
        return;
      }

      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          void runPrewarm();
        }
      }, 400);
    };

    schedulePrewarm();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return null;
};
