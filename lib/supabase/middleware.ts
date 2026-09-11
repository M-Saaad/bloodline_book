import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";
import { FARM_ROLE_HEADER } from "@/lib/auth/middleware-role";
import type { UserRole } from "@/lib/auth/roles";

async function resolveUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<UserRole> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return "partner";
  if (profile?.role === "partner" || profile?.role === "guest") return profile.role;
  return "partner";
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

export async function updateSession(request: NextRequest) {
  // Local JSON mode — no auth gate
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/api/health-check";

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path.startsWith("/login") && !path.startsWith("/login/reset-password")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set(FARM_ROLE_HEADER, await resolveUserRole(supabase, user.id));
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  copyCookies(supabaseResponse, response);
  return response;
}
