"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

// 依赖本地日期、sessionStorage 的内容只在浏览器里渲染，避免和服务端渲染结果不一致
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? children : fallback;
}
