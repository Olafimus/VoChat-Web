export const newId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
