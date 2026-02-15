import { NextRequest, NextResponse } from 'next/server';
import { validateRefreshToken, signJWT, createSession, deleteSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      );
    }

    const session = await validateRefreshToken(refreshToken);

    if (!session) {
      const response = NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
      response.cookies.delete('refreshToken');
      response.cookies.delete('accessToken');
      return response;
    }

    // Delete old session
    await deleteSession(refreshToken);

    // Create new session
    const { refreshToken: newRefreshToken } = await createSession(session.userId);

    // Generate new access token
    const accessToken = signJWT({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      companyId: session.user.companyId,
    });

    const response = NextResponse.json({
      success: true,
      accessToken,
    });

    // Set new refresh token cookie
    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Set new access token cookie
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
