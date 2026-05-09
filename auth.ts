import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

function isRealCredential(v: string | undefined): boolean {
  if (!v) return false;
  const trimmed = v.trim();
  if (trimmed.length < 8) return false;
  if (/^\.{2,}$/.test(trimmed)) return false;
  if (/^(your|placeholder|todo|xxx+|change[-_]?me)/i.test(trimmed)) return false;
  return true;
}

const hasGitHubCredentials =
  isRealCredential(process.env.GITHUB_CLIENT_ID) &&
  isRealCredential(process.env.GITHUB_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: hasGitHubCredentials
    ? [
        GitHub({
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          profile(profile) {
            return {
              id: profile.id.toString(),
              name: profile.name ?? profile.login,
              email: profile.email,
              image: profile.avatar_url,
              login: profile.login,
            } as { id: string; name: string | null; email: string | null; image: string | null; login: string };
          },
        }),
      ]
    : [],
  pages: {
    signIn: "/claim",
  },
  callbacks: {
    async jwt({ token, profile, user }) {
      if (profile && typeof (profile as { login?: string }).login === "string") {
        token.login = (profile as { login: string }).login;
      } else if (user && typeof (user as { login?: string }).login === "string") {
        token.login = (user as { login: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      if (typeof token.login === "string") {
        (session.user as { login?: string }).login = token.login;
      }
      return session;
    },
  },
});

export const isAuthConfigured = hasGitHubCredentials;
