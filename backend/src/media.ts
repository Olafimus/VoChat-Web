/**
 * Medien-Dienst: Dateien (z. B. Profilbilder) über einen austauschbaren Speicher.
 *
 * - `none` (Standard): Uploads sind deaktiviert, bis ein Speicher konfiguriert ist.
 * - `local`: Dateien auf dem Server-Dateisystem (Entwicklung, kleine Installationen).
 * - `s3`: S3-kompatibler Bucket (AWS S3, Cloudflare R2, MinIO …). Benötigt
 *   `@aws-sdk/client-s3`, das erst bei Aktivierung installiert wird.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

export interface MediaStore {
  readonly driver: "local" | "s3";
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export interface MediaConfig {
  driver: "none" | "local" | "s3";
  localDir: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string;
}

/** Erlaubte Bildtypen anhand der Dateikennung (Magic Bytes), nicht anhand des Headers. */
export function sniffImage(bytes: Uint8Array): { contentType: string; ext: string } | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47])) return { contentType: "image/png", ext: "png" };
  if (starts([0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", ext: "jpg" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { contentType: "image/webp", ext: "webp" };
  if (starts([0x47, 0x49, 0x46, 0x38])) return { contentType: "image/gif", ext: "gif" };
  return null;
}

export class LocalMediaStore implements MediaStore {
  readonly driver = "local" as const;
  constructor(private readonly dir: string) {}

  private path(key: string): string {
    const full = resolve(this.dir, key);
    if (!full.startsWith(resolve(this.dir) + "/")) throw new Error("invalid key");
    return full;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    await writeFile(file + ".type", contentType);
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const file = this.path(key);
      const body = await readFile(file);
      const contentType = (await readFile(file + ".type", "utf8").catch(() => "application/octet-stream")).trim();
      return { body: new Uint8Array(body), contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const file = this.path(key);
    await rm(file, { force: true });
    await rm(file + ".type", { force: true });
  }
}

/**
 * S3-Treiber. Wird nur geladen, wenn MEDIA_DRIVER=s3 gesetzt ist. Die Anmeldedaten kommen
 * aus der Standardkette des AWS-SDK (Umgebungsvariablen AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
 */
export async function createS3MediaStore(cfg: MediaConfig): Promise<MediaStore> {
  if (!cfg.s3Bucket) throw new Error("MEDIA_S3_BUCKET fehlt");
  const moduleName = "@aws-sdk/client-s3";
  let sdk: any;
  try {
    sdk = await import(/* @vite-ignore */ moduleName);
  } catch {
    throw new Error("Für MEDIA_DRIVER=s3 bitte `npm install @aws-sdk/client-s3 -w backend` ausführen");
  }
  const client = new sdk.S3Client({ region: cfg.s3Region ?? "auto", endpoint: cfg.s3Endpoint, forcePathStyle: !!cfg.s3Endpoint });
  const bucket = cfg.s3Bucket;
  return {
    driver: "s3",
    async put(key, body, contentType) {
      await client.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      try {
        const res = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = new Uint8Array(await res.Body.transformToByteArray());
        return { body, contentType: res.ContentType ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

export async function createMediaStore(cfg: MediaConfig): Promise<MediaStore | null> {
  if (cfg.driver === "none") return null;
  if (cfg.driver === "local") return new LocalMediaStore(cfg.localDir);
  return createS3MediaStore(cfg);
}

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
