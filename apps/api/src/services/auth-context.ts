export interface AuthContext {
  userId: string;
  tenantId: string;
  role: "owner" | "admin" | "member";
}

export const developmentAuthContext: AuthContext = {
  userId: "66d5c5fc-c3c4-4e8b-94d3-d4c8c13f666f",
  tenantId: "2a46cf83-111b-4469-9bca-5e16196541f9",
  role: "owner"
};
