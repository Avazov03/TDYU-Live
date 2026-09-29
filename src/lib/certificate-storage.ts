import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { isValidCertificateFileKey } from "@/lib/certificate-policy";
import { resolveRecordingStorageRoot } from "@/lib/recording-storage";

/** Certificates share the persistent private store with recordings (outside public/ and the release dir). */
function certificatePath(key: string): string {
  if (!isValidCertificateFileKey(key)) throw new Error("INVALID_CERTIFICATE_KEY");
  const root = resolveRecordingStorageRoot();
  const abs = path.resolve(root, key);
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error("INVALID_CERTIFICATE_KEY");
  return abs;
}

export async function saveCertificateFile(key: string, data: Uint8Array): Promise<void> {
  const abs = certificatePath(key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data, { flag: "wx", mode: 0o640 });
}

export async function readCertificateFile(key: string): Promise<Buffer> {
  return readFile(certificatePath(key));
}

export async function removeCertificateFile(key: string): Promise<void> {
  await rm(certificatePath(key), { force: true });
}
