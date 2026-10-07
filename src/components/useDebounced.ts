"use client";

import { useEffect, useState } from "react";

// 搜索框输入时稍等一下再请求，避免每敲一个字都查一次
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
