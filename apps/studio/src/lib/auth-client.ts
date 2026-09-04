"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, roles } from "./authz";

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles })],
});

export const { useSession, signIn, signUp, signOut } = authClient;
