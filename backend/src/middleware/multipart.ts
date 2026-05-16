import multer from 'multer';

const ONE_MB = 1024 * 1024;

/**
 * Configuração de multipart usada no `POST /api/clips` e `PUT /api/clips/:id`.
 * Limite de 1 MB conforme §4.4 (apenas a thumbnail é ficheiro; restantes são texto).
 */
export const clipMultipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ONE_MB,
    files: 1,
    fields: 20,
  },
});
