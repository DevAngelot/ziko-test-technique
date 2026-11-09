import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../Errors/ApiError.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides. Vérifier les champs et leurs types.',
        fields: error.issues.map((i) => ({
          field: i.path.join('.') || 'body',
          reason: i.code,
        })),
      },
    });
  } else if (error instanceof ApiError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  } else if (error.type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Le corps doit être un JSON valide.',
      },
    });
  } else if (error.type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Corps de requête trop volumineux.',
      },
    });
  } else {
    // Ne pas journaliser le corps, les identifiants DB ou une chaîne de connexion.
    console.error('Erreur interne API.', {
      code: typeof error.code === 'string' ? error.code : 'UNKNOWN',
    });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erreur interne. Réessayer plus tard.',
      },
    });
  }
};
