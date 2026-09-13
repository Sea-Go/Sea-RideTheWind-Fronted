"use client";
import { useEffect, useRef } from "react";

import { recordRecoEvents } from "@/services/reco";
// Exposure is recorded after >=50% visibility continuously for 1 second, never upon candidate delivery.
// This client rule is a proposal to align with D05/D08 before production rollout; existing event DTO retained.
const confirmedExposures = new Set<string>();
export function useExposure(requestId: string | undefined, enabled: boolean) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled || !requestId || !container.current) return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const sent = confirmedExposures;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-story-id");
          const key = `${requestId}:${id}`;
          if (
            entry.intersectionRatio >= 0.5 &&
            !document.hidden &&
            id &&
            !sent.has(key) &&
            !timers.has(entry.target)
          ) {
            timers.set(
              entry.target,
              setTimeout(() => {
                timers.delete(entry.target);
                if (document.hidden) return;
                sent.add(key);
                if (sent.size > 2000) sent.delete(sent.values().next().value!);
                void recordRecoEvents({
                  events: [
                    {
                      event_type: "impression",
                      rec_request_id: requestId,
                      article_id: id,
                      surface: "sea-explore",
                      metadata: {
                        event_id: `exposure:${key}`,
                        exposure_rule: "visible-50pct-1000ms-v1",
                        occurred_at: new Date().toISOString(),
                      },
                    },
                  ],
                })
                  .then((result) => {
                    if (result.accepted < 1) sent.delete(key);
                  })
                  .catch(() => {
                    sent.delete(key);
                  });
              }, 1000),
            );
          } else if (entry.intersectionRatio < 0.5) {
            clearTimeout(timers.get(entry.target));
            timers.delete(entry.target);
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    container.current.querySelectorAll("[data-story-id]").forEach((e) => observer.observe(e));
    const pause = () => {
      if (document.hidden) {
        timers.forEach(clearTimeout);
        timers.clear();
      } else {
        observer.disconnect();
        container.current?.querySelectorAll("[data-story-id]").forEach((e) => observer.observe(e));
      }
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", pause);
    };
  }, [enabled, requestId]);
  return container;
}
