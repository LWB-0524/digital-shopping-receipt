export function money(n: number): string {
  return `¥${(Math.round(n * 100) / 100).toFixed(2)}`;
}

export function trimNumber(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDateTime(d = new Date()): string {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function firstDayOfMonth(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// "2026-10-05" → "10月5日 周日"
export function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  const thisYear = new Date().getFullYear();
  return `${y === thisYear ? "" : `${y}年`}${m}月${d}日 周${WEEKDAYS[wd]}`;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    // 在 React 之外，直接整页跳转到登录页
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data as T;
}
