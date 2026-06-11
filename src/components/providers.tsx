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
          // Firma silenciosa: el QR rotativo firma cada ~45s y un modal
          // de confirmacion por firma haria inusable la puerta
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
