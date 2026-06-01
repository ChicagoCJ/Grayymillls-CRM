export type ApiUserRole = "admin" | "sales_manager" | "sales_rep";

export type ApiPermissionContext = {
  userId: string;
  userRole: ApiUserRole;
  userName: string;
  isSoftMode: boolean;
};

export function normalizeApiUserRole(value: unknown): ApiUserRole {
  if (value === "sales_manager") return "sales_manager";
  if (value === "sales_rep") return "sales_rep";
  return "admin";
}

export function getPermissionContext(request: Request): ApiPermissionContext {
  const headers = request.headers;

  return {
    userId: headers.get("x-crm-user-id") || "",
    userRole: normalizeApiUserRole(headers.get("x-crm-user-role")),
    userName: headers.get("x-crm-user-name") || "Unknown user",
    isSoftMode: true,
  };
}

export function canImportCsv(role: ApiUserRole) {
  return role === "admin" || role === "sales_manager";
}

export function canManageAdminSettings(role: ApiUserRole) {
  return role === "admin";
}

export function canManageFunnelStageDefinitions(role: ApiUserRole) {
  return role === "admin";
}

export function canAssignSalesCoverage(role: ApiUserRole) {
  return role === "admin" || role === "sales_manager";
}

export function logSoftPermissionCheck(
  action: string,
  context: ApiPermissionContext,
  allowed: boolean
) {
  console.warn("[permission-soft-check]", {
    action,
    userId: context.userId,
    userRole: context.userRole,
    userName: context.userName,
    allowed,
    softMode: context.isSoftMode,
  });
}

