const normalizePublicUrl = (value) => String(value || "").replace(/\/+$/, "");

export const getStorageNamespace = (publicUrl = process.env.PUBLIC_URL) => {
  const url = normalizePublicUrl(publicUrl);
  if (/(^|\/)test$/i.test(url)) return "test";
  if (/(^|\/)matchapp$/i.test(url)) return "prod";
  return "dev";
};

export const STORAGE_NAMESPACE = getStorageNamespace();

export const storageKey = (name, namespace = STORAGE_NAMESPACE) =>
  `matchapp:${namespace}:${name}`;

const LEGACY_ACTIVE_MATCH_KEY = "handbollsstat-state";
const LEGACY_WHATS_NEW_KEY = "matchapp_whatsnew_seen_version";
const LEGACY_PRIVACY_PREFIX = "matchapp-privacy-notice:";

export const migrateLegacyStorage = ({
  namespace = STORAGE_NAMESPACE,
  storage = typeof localStorage !== "undefined" ? localStorage : null
} = {}) => {
  if (!storage || namespace !== "prod") return;

  const markerKey = storageKey("legacy-storage-migrated-v1", namespace);
  if (storage.getItem(markerKey)) return;

  try {
    const legacyState = JSON.parse(storage.getItem(LEGACY_ACTIVE_MATCH_KEY) || "null");
    if (legacyState?.step === 2 && legacyState?.activeMatchTeamId) {
      const targetKey = storageKey("state", namespace);
      if (!storage.getItem(targetKey)) {
        storage.setItem(targetKey, JSON.stringify(legacyState));
      }
    }

    const seenVersion = storage.getItem(LEGACY_WHATS_NEW_KEY);
    const seenTargetKey = storageKey("whatsnew-seen-version", namespace);
    if (seenVersion && !storage.getItem(seenTargetKey)) {
      storage.setItem(seenTargetKey, seenVersion);
    }

    const legacyPrivacyEntries = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LEGACY_PRIVACY_PREFIX)) {
        legacyPrivacyEntries.push([key.slice(LEGACY_PRIVACY_PREFIX.length), storage.getItem(key)]);
      }
    }
    legacyPrivacyEntries.forEach(([identity, value]) => {
      const targetKey = storageKey(`privacy-notice:${identity}`, namespace);
      if (value && !storage.getItem(targetKey)) storage.setItem(targetKey, value);
    });
  } catch {
    // A damaged legacy value must not prevent the app from starting.
  } finally {
    try {
      storage.setItem(markerKey, "1");
    } catch {
      // localStorage can be unavailable in private/restricted browser modes.
    }
  }
};
