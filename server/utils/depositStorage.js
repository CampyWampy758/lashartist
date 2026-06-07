import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { supabase, supabaseEnabled } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");

export const DEPOSIT_BUCKET = "deposit-proofs";

const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

function fileFilter(_req, file, cb) {
  if (IMAGE_MIME.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

/** Multer middleware — memory when Supabase is on, local disk otherwise. */
export const depositUpload = multer({
  storage: supabaseEnabled ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

/** True when the path is a Supabase Storage object key (not a legacy /uploads/ URL). */
export function isStoragePath(depositProof) {
  return Boolean(depositProof && !depositProof.startsWith("/uploads/"));
}

export async function ensureDepositBucket() {
  if (!supabaseEnabled) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (buckets?.some((b) => b.name === DEPOSIT_BUCKET)) return;

  const { error } = await supabase.storage.createBucket(DEPOSIT_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"],
  });
  if (error) throw error;
}

/**
 * Upload a deposit proof. Returns the value to store in bookings.deposit_proof.
 * @param {string} bookingId
 * @param {Express.Multer.File} file
 */
export async function saveDepositProof(bookingId, file) {
  if (supabaseEnabled) {
    await ensureDepositBucket();

    const ext = path.extname(file.originalname) || ".jpg";
    const storagePath = `${bookingId}/${Date.now()}-${uuidv4()}${ext}`;

    const { error } = await supabase.storage
      .from(DEPOSIT_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;
    return storagePath;
  }

  return `/uploads/${file.filename}`;
}

/**
 * Read deposit proof bytes + content type for streaming to the admin panel.
 * Handles both Supabase Storage paths and legacy /uploads/ files.
 */
export async function readDepositProof(depositProof) {
  if (isStoragePath(depositProof)) {
    if (!supabaseEnabled) {
      throw new Error("Supabase is required to read stored deposit proofs.");
    }

    const { data, error } = await supabase.storage
      .from(DEPOSIT_BUCKET)
      .download(depositProof);

    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());
    return { buffer, contentType: data.type || "image/jpeg" };
  }

  const filename = path.basename(depositProof);
  const filePath = path.join(uploadsDir, filename);
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png"
    : ext === ".webp" ? "image/webp"
    : "image/jpeg";

  return { buffer, contentType };
}

/**
 * Upload a local file from disk into Supabase Storage (used by migration script).
 */
export async function migrateLocalProofToStorage(bookingId, localPath) {
  await ensureDepositBucket();

  const buffer = await fs.readFile(localPath);
  const ext = path.extname(localPath) || ".jpg";
  const storagePath = `${bookingId}/${Date.now()}-migrated${ext}`;

  const { error } = await supabase.storage
    .from(DEPOSIT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw error;
  return storagePath;
}
