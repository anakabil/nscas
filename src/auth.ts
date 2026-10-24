import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { bindSessionGrant } from "@/lib/auth/session-store";
import { SESSION_ABSOLUTE_MS } from "@/lib/auth/session-policy";

// Auth.js v5 hanya menukar izin sesi sekali pakai menjadi cookie JWT yang membawa id sesi.
// Pemeriksaan kata sandi, TOTP, penguncian akun, dan jejak audit dilakukan di src/lib/auth/login.ts;
// keabsahan sesi diperiksa di server pada setiap permintaan (src/lib/auth/session.ts).
const nextAuth = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_ABSOLUTE_MS / 1000 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      id: "credentials",
      credentials: { grant: {} },
      authorize: async (credentials) => {
        const grant = typeof credentials?.grant === "string" ? credentials.grant : "";
        return grant ? bindSessionGrant(grant) : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "sid" in user && typeof user.sid === "string") {
        // Hanya id pengguna dan id sesi yang disimpan di cookie.
        return { sub: user.id, sid: user.sid };
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, sid: token.sid } as typeof session & { sid: unknown };
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = nextAuth.handlers;
