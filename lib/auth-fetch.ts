// lib/auth-fetch.ts
export const authFetch = (input: string | URL | Request, init?: RequestInit) =>
  fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })