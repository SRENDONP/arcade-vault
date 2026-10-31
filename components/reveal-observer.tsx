"use client";

import { useEffect } from "react";

// Adds `.in` to every `.reveal` on the page as it scrolls into view, then stops
// watching it. Each page mounts its own instance, so only elements present at
// mount time are observed.
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
