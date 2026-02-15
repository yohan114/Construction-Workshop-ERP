import crypto from 'crypto';
import { db } from '@/lib/db';
import type { User, Session } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days

// Password utilities
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
  return hash.toString('hex');
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const newHash = hashPassword(password, salt);
  return newHash === hash;
}

// JWT utilities
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  companyId: string;
  iat: number;
  exp: number;
}

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 15 * 60; // 15 minutes
  
  const tokenPayload = { ...payload, iat, exp };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(token)
    .digest('base64url');
  
  return `${token}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const [payloadB64, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadB64)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as JWTPayload;
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

// Session utilities
export async function createSession(userId: string): Promise<{ session: Session; refreshToken: string }> {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);
  
  const session = await db.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt,
    },
  });
  
  return { session, refreshToken };
}

export async function validateRefreshToken(refreshToken: string): Promise<Session | null> {
  const session = await db.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });
  
  if (!session) {
    return null;
  }
  
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }
  
  return session;
}

export async function deleteSession(refreshToken: string): Promise<void> {
  try {
    await db.session.delete({ where: { refreshToken } });
  } catch {
    // Session might not exist
  }
}

export async function cleanupExpiredSessions(userId: string): Promise<void> {
  await db.session.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() },
    },
  });
}

// User utilities
export async function authenticateUser(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string } | null> {
  const user = await db.user.findUnique({
    where: { email },
    include: { company: true },
  });
  
  if (!user) {
    return null;
  }
  
  if (user.status !== 'ACTIVE') {
    return null;
  }
  
  if (!verifyPassword(password, user.salt, user.hash)) {
    return null;
  }
  
  // Clean up expired sessions
  await cleanupExpiredSessions(user.id);
  
  // Create new session
  const { session, refreshToken } = await createSession(user.id);
  
  // Generate access token
  const accessToken = signJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  });
  
  return { user, accessToken, refreshToken };
}

// Role check utilities
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

export function isAdmin(role: string): boolean {
  return role === 'ADMIN';
}

export function isManager(role: string): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

// Verify token from request and return user data
export async function verifyToken(request: { headers: { get: (name: string) => string | null } }): Promise<{
  id: string;
  email: string;
  role: string;
  companyId: string;
  name: string;
} | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = verifyJWT(token);

  if (!payload) {
    return null;
  }

  // Get fresh user data
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
      name: true,
      status: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return null;
  }

  return user;
}
