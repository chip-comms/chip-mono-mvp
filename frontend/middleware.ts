import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  try {
    let response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get the user session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    const url = request.nextUrl.clone();
    const pathname = url.pathname;

    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/setup'];
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route)
    );

    // Public routes that authenticated users shouldn't access
    const publicRoutes = ['/'];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (error) {
      console.error('Middleware auth error:', error);
      // If there's an auth error, redirect to login
      if (isProtectedRoute) {
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      return response;
    }

    // If user is not authenticated and trying to access protected routes
    if (!session && isProtectedRoute) {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // If user is authenticated and trying to access public login routes
    if (session && isPublicRoute) {
      // Check setup status before redirecting
      const checkSetupResponse = await fetch(
        new URL('/api/auth/check-setup', request.url),
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (checkSetupResponse.ok) {
        const setupData = await checkSetupResponse.json();

        if (setupData.needsUserRecord) {
          // Create user record first
          const createUserResponse = await fetch(
            new URL('/api/auth/create-user', request.url),
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          if (createUserResponse.ok) {
            // After creating user, they need setup
            url.pathname = '/setup';
            return NextResponse.redirect(url);
          }
        } else if (setupData.needsSetup) {
          url.pathname = '/setup';
          return NextResponse.redirect(url);
        } else {
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }
      } else {
        // If we can't check setup status, redirect to dashboard
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    }

    // If user is authenticated and accessing /setup but doesn't need setup
    if (session && pathname.startsWith('/setup')) {
      const checkSetupResponse = await fetch(
        new URL('/api/auth/check-setup', request.url),
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (checkSetupResponse.ok) {
        const setupData = await checkSetupResponse.json();

        if (!setupData.needsSetup && !setupData.needsUserRecord) {
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
