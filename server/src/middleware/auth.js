import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Verifies the Bearer token and attaches { id, role, username } to req.user.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role gate. Usage: router.get('/', authenticate, requireRole('ADMIN'), handler)
 * ADMIN implicitly passes any CASHIER-only check.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'ADMIN' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Insufficient permissions for this action' });
  };
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username, fullName: user.fullName },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}
