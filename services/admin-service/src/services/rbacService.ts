import pool from '../database/connection';
import { logger } from '../utils/logger';

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions?: Permission[];
}

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

interface UserRole {
  userId: string;
  roleId: string;
  roleName: string;
  assignedBy: string | null;
  assignedAt: Date;
  expiresAt: Date | null;
}

export class RBACService {
  private permissionCache: Map<string, Set<string>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheExpiry: Map<string, number> = new Map();

  // ========================================================================
  // Role Management
  // ========================================================================

  async getAllRoles(includeInactive = false): Promise<Role[]> {
    const query = includeInactive
      ? 'SELECT * FROM roles ORDER BY name'
      : 'SELECT * FROM roles WHERE is_active = TRUE ORDER BY name';

    const result = await pool.query(query);
    return result.rows.map(this.mapRole);
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    const result = await pool.query(
      `SELECT r.*, array_agg(json_build_object('id', p.id, 'name', p.name, 'resource', p.resource, 'action', p.action)) as permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [roleId]
    );

    if (result.rows.length === 0) return null;

    const role = this.mapRole(result.rows[0]);
    role.permissions = result.rows[0].permissions?.filter((p: any) => p.id) || [];
    return role;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    const result = await pool.query('SELECT * FROM roles WHERE name = $1', [name]);
    return result.rows.length > 0 ? this.mapRole(result.rows[0]) : null;
  }

  async createRole(data: {
    name: string;
    displayName: string;
    description?: string;
  }): Promise<Role> {
    const result = await pool.query(
      `INSERT INTO roles (name, display_name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.displayName, data.description]
    );

    logger.info('Role created', { roleName: data.name });
    return this.mapRole(result.rows[0]);
  }

  async updateRole(roleId: string, data: {
    displayName?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<Role | null> {
    // Check if system role
    const existing = await pool.query('SELECT is_system FROM roles WHERE id = $1', [roleId]);
    if (existing.rows.length === 0) return null;

    if (existing.rows[0].is_system && data.isActive === false) {
      throw new Error('Cannot deactivate system roles');
    }

    const result = await pool.query(
      `UPDATE roles
       SET display_name = COALESCE($2, display_name),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active)
       WHERE id = $1
       RETURNING *`,
      [roleId, data.displayName, data.description, data.isActive]
    );

    this.invalidateCache();
    return result.rows.length > 0 ? this.mapRole(result.rows[0]) : null;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    // Check if system role
    const existing = await pool.query('SELECT is_system FROM roles WHERE id = $1', [roleId]);
    if (existing.rows.length === 0) return false;

    if (existing.rows[0].is_system) {
      throw new Error('Cannot delete system roles');
    }

    const result = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING id', [roleId]);
    this.invalidateCache();
    return result.rows.length > 0;
  }

  // ========================================================================
  // Permission Management
  // ========================================================================

  async getAllPermissions(): Promise<Permission[]> {
    const result = await pool.query('SELECT * FROM permissions ORDER BY resource, action');
    return result.rows.map(this.mapPermission);
  }

  async getPermissionsByResource(resource: string): Promise<Permission[]> {
    const result = await pool.query(
      'SELECT * FROM permissions WHERE resource = $1 ORDER BY action',
      [resource]
    );
    return result.rows.map(this.mapPermission);
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [roleId, permissionId]
    );
    this.invalidateCache();
    logger.info('Permission assigned to role', { roleId, permissionId });
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2 RETURNING role_id',
      [roleId, permissionId]
    );
    this.invalidateCache();
    return result.rows.length > 0;
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const result = await pool.query(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [roleId]
    );
    return result.rows.map(this.mapPermission);
  }

  // ========================================================================
  // User Role Management
  // ========================================================================

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const result = await pool.query(
      `SELECT ur.*, r.name as role_name, r.display_name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND r.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      userId: row.user_id,
      roleId: row.role_id,
      roleName: row.role_name,
      assignedBy: row.assigned_by,
      assignedAt: new Date(row.assigned_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null
    }));
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, role_id)
       DO UPDATE SET assigned_by = $3, assigned_at = NOW(), expires_at = $4`,
      [userId, roleId, assignedBy, expiresAt]
    );

    this.permissionCache.delete(userId);
    logger.info('Role assigned to user', { userId, roleId, assignedBy });
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING user_id',
      [userId, roleId]
    );

    this.permissionCache.delete(userId);
    return result.rows.length > 0;
  }

  // ========================================================================
  // Permission Checking
  // ========================================================================

  async getUserPermissions(userId: string): Promise<Set<string>> {
    // Check cache
    const cached = this.permissionCache.get(userId);
    const expiry = this.cacheExpiry.get(userId);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    const result = await pool.query(
      `SELECT DISTINCT p.name
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND r.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId]
    );

    const permissions = new Set<string>(result.rows.map((r: any) => r.name));

    // Cache the result
    this.permissionCache.set(userId, permissions);
    this.cacheExpiry.set(userId, Date.now() + this.CACHE_TTL);

    return permissions;
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has(permission);
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some(p => userPermissions.has(p));
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every(p => userPermissions.has(p));
  }

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND r.name = $2
         AND r.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId, roleName]
    );
    return result.rows.length > 0;
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private invalidateCache(): void {
    this.permissionCache.clear();
    this.cacheExpiry.clear();
  }

  private mapRole(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      isSystem: row.is_system,
      isActive: row.is_active
    };
  }

  private mapPermission(row: any): Permission {
    return {
      id: row.id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      description: row.description
    };
  }
}

export default new RBACService();
