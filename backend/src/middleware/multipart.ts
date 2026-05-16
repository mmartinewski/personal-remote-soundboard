import multer from 'multer';

const ONE_MB = 1024 * 1024;

/**
 * Multipart configuration used by `POST /api/clips` and `PUT /api/clips/:id`.
 * 1 MB limit per section 4.4. Only the thumbnail is a file; the rest is text.
 */
export const clipMultipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ONE_MB,
    files: 1,
    fields: 20,
  },
});
