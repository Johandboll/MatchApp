import { getStorageNamespace, migrateLegacyStorage, storageKey } from "./storageKeys";

describe("storage namespaces", () => {
  beforeEach(() => localStorage.clear());

  test("separates production, test and local development", () => {
    expect(getStorageNamespace("/matchapp")).toBe("prod");
    expect(getStorageNamespace("/test/")).toBe("test");
    expect(getStorageNamespace("")).toBe("dev");
    expect(storageKey("state", "prod")).toBe("matchapp:prod:state");
    expect(storageKey("state", "test")).toBe("matchapp:test:state");
  });

  test("only preserves a genuinely active legacy match in production", () => {
    const activeMatch = { step: 2, activeMatchTeamId: "team-1", matchInfo: { date: "2026-08-26" } };
    localStorage.setItem("handbollsstat-state", JSON.stringify(activeMatch));

    migrateLegacyStorage({ namespace: "prod", storage: localStorage });

    expect(JSON.parse(localStorage.getItem("matchapp:prod:state"))).toEqual(activeMatch);
    expect(localStorage.getItem("matchapp:prod:legacy-storage-migrated-v1")).toBe("1");
    expect(localStorage.getItem("handbollsstat-state")).toBe(JSON.stringify(activeMatch));
  });

  test("does not import setup state or any legacy state into test", () => {
    localStorage.setItem(
      "handbollsstat-state",
      JSON.stringify({ step: 1, matchInfo: { date: "2026-05-20" } })
    );

    migrateLegacyStorage({ namespace: "prod", storage: localStorage });
    migrateLegacyStorage({ namespace: "test", storage: localStorage });

    expect(localStorage.getItem("matchapp:prod:state")).toBeNull();
    expect(localStorage.getItem("matchapp:test:state")).toBeNull();
  });

  test("never overwrites an already namespaced production match", () => {
    const existing = { step: 2, activeMatchTeamId: "prod-team" };
    localStorage.setItem("matchapp:prod:state", JSON.stringify(existing));
    localStorage.setItem(
      "handbollsstat-state",
      JSON.stringify({ step: 2, activeMatchTeamId: "legacy-team" })
    );

    migrateLegacyStorage({ namespace: "prod", storage: localStorage });

    expect(JSON.parse(localStorage.getItem("matchapp:prod:state"))).toEqual(existing);
  });
});
