/**
 * Contexto de acceso HTTP (E3C).
 * Centraliza sesión, workspace, features y permisos sin duplicar reglas de Core.
 */

import { catalogoWorkspaces } from '../data/tenants.js';
import { crearContextoAcceso } from '../core/identity/usuario.js';
import { contextoCoincideConSesion } from '../core/organizations/workspace.js';
import { tienePermiso } from '../core/authorization/rbac.js';
import { featuresDe, featureHabilitado } from '../core/features/flags.js';
import { COOKIE, parseCookies, leerSesion } from '../engine/auth.js';

/**
 * @param {{ sessionSecret: string }} opts
 */
export function crearMiddlewareAcceso({ sessionSecret }) {
  function catalogo() {
    return catalogoWorkspaces();
  }

  function sesionRaw(req) {
    const cookies = parseCookies(req.headers.cookie);
    const payload = leerSesion(cookies[COOKIE], sessionSecret);
    if (!payload || !payload.email) return null;
    return payload;
  }

  /**
   * Construye el contexto verificado desde la cookie (no el payload crudo).
   * @returns {ReturnType<typeof crearContextoAcceso>|null}
   */
  function resolverContexto(req) {
    const raw = sesionRaw(req);
    if (!raw) return null;
    try {
      return crearContextoAcceso({
        tenantId: raw.tenantId,
        workspaceId: raw.workspaceId || raw.tenantId,
        email: raw.email,
        nombre: raw.nombre,
        rol: raw.rol,
        userId: raw.userId,
        permisos: Array.isArray(raw.permisos) ? raw.permisos : undefined,
      }, catalogo());
    } catch {
      return null;
    }
  }

  function requireAuth(req, res, next) {
    if (!req.tenant) return res.status(400).json({ error: 'tenant_not_found' });
    const ctx = resolverContexto(req);
    if (!ctx) return res.status(401).json({ error: 'unauthorized' });
    const cat = catalogo();
    if (!contextoCoincideConSesion(
      { tenantId: req.tenant.id, workspaceId: req.tenant.id },
      { tenantId: ctx.tenantId, workspaceId: ctx.workspaceId },
      cat,
    )) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.usuario = ctx;
    req.accessContext = ctx;
    return next();
  }

  function requireFeature(feature) {
    return (req, res, next) => {
      if (!req.tenant) return res.status(400).json({ error: 'tenant_not_found' });
      const features = featuresDe(req.tenant);
      if (!featureHabilitado(features, feature)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      return next();
    };
  }

  function requirePermission(permission) {
    return (req, res, next) => {
      const ctx = req.accessContext || req.usuario;
      if (!ctx || !tienePermiso(ctx, permission)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      return next();
    };
  }

  return {
    requireAuth,
    requireFeature,
    requirePermission,
    resolverContexto,
    sesionRaw,
    catalogo,
    featuresDeTenant: (tenant) => featuresDe(tenant),
  };
}
