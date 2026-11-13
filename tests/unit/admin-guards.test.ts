import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the admin portal's code: rules that must hold for
 * every file, including ones added later.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const sources = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
const read = (file: string) => readFileSync(file, "utf8");

describe("admin access rules", () => {
  it("every server action checks that an administrator is signed in", () => {
    const actionFiles = sources.filter((f) => /^\s*"use server"/.test(read(f)));
    expect(actionFiles.length).toBeGreaterThanOrEqual(6);
    const unguarded: string[] = [];
    for (const file of actionFiles) {
      const text = read(file);
      // A helper in the same file that itself calls requireAdmin() counts as a guard.
      const helpers = [...text.matchAll(/^async function (\w+)\([^]*?\n}/gm)].filter((m) => m[0].includes("requireAdmin(")).map((m) => m[1]);
      for (const match of text.matchAll(/^export async function (\w+)\([^]*?\n}/gm)) {
        const [body, name] = match;
        if (name === "loginAction") continue; // the one action a visitor must be able to call
        const guarded = body.includes("requireAdmin(") || helpers.some((h) => new RegExp(`\\b${h}\\(`).test(body));
        if (!guarded) unguarded.push(`${file}: ${name}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("every admin page checks the sign-in itself", () => {
    const pages = sources.filter((f) => f.includes(path.join("app", "admin")) && f.endsWith("page.tsx") && !f.includes("login"));
    expect(pages.length).toBeGreaterThanOrEqual(10);
    expect(pages.filter((f) => !read(f).includes("requireAdmin("))).toEqual([]);
  });

  it("every admin API checks the sign-in and refuses other websites", () => {
    const routes = sources.filter((f) => f.includes(path.join("app", "api", "admin")) && f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThanOrEqual(2);
    for (const file of routes) {
      expect(read(file), file).toContain("getAdmin()");
      expect(read(file), file).toContain('"origin"');
    }
  });

  it("admin-only services are never used by public pages, the chat or the assistant", () => {
    const publicCode = sources.filter(
      (f) => f.includes(path.join("app", "(site)")) || f.includes(path.join("app", "api", "chat")) || f.includes(path.join("server", "agent")) || f.includes(path.join("components", "chat")) || f.includes(path.join("components", "catalog")) || f.includes(path.join("components", "layout")),
    );
    expect(publicCode.length).toBeGreaterThan(15);
    expect(publicCode.filter((f) => /services\/admin-|\.\/admin-/.test(read(f)))).toEqual([]);
  });

  it("no password, key or token is written in the code", () => {
    const suspicious = sources.filter((f) => /(sk-ant-[A-Za-z0-9]|password\s*[:=]\s*["'][^"']{6,}["']|api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{12,})/i.test(read(f)));
    expect(suspicious).toEqual([]);
  });

  it("no sign-up page or account-creating action exists in the website", () => {
    const appFiles = sources.filter((f) => f.includes(`src${path.sep}app`));
    expect(appFiles.filter((f) => /register|signup|sign-up/i.test(f))).toEqual([]);
    expect(appFiles.filter((f) => read(f).includes("createAdmin"))).toEqual([]);
  });
});
