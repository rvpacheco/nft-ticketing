"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
          // Silent signing: the rotating QR signs every ~45s and a
          // confirmation modal per signature would make the door unusable
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
