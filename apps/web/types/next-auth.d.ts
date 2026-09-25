import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "EMPLOYEE" | "HR";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}