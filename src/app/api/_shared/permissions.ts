import { NextResponse } from "next/server";

export type ApiUserRole = "admin" | "sales_manager" | "sales_rep";

export type ApiPermissionContext = {
  userId: string;
  userRole: ApiUserRole;
  userName: string;
  isSoftMode: boolean;
};

export type ApiPermissionAction =
  | "import_csv"
  | "assign_sales_coverage"
  | "manage_crm_users"
  | "manage_funnel_stage_definition"
  | "manage_admin_settings";

export function normalizeApiUserRole(value: unknown): ApiUserRole {
  if (value === "admin") return "admin";
  if (value === "sales_manager") return "sales_manager";
  if (value === "sales_rep") return "sales_rep";
  return "sales_rep";
}

export function getPermissionContext(request: Request): ApiPermissionContext {
  const headers = request.headers;

  return {
    userId: headers.get("x-crm-user-id") || "",
    userRole: normalizeApiUserRole(headers.get("x-crm-user-role")),
    userName: headers.get("x-crm-user-name") || "Unknown user",
    isSoftMode: false,
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

export function isApiActionAllowed(action: ApiPermissionAction, role: ApiUserRole) {
  if (action === "import_csv") return canImportCsv(role);
  if (action === "assign_sales_coverage") return canAssignSalesCoverage(role);
  if (action === "manage_crm_users") return canManageAdminSettings(role);
  if (action === "manage_funnel_stage_definition") return canManageFunnelStageDefinitions(role);
  if (action === "manage_admin_settings") return canManageAdminSettings(role);
  return false;
}

export function apiPermissionDeniedMessage(action: ApiPermissionAction) {
  if (action === "import_csv") return "Your current role cannot import CSV files.";
  if (action === "assign_sales_coverage") return "Your current role cannot edit sales coverage assignments.";
  if (action === "manage_crm_users") return "Your current role cannot create, edit, archive, or reactivate CRM users.";
  if (action === "manage_funnel_stage_definition") return "Your current role cannot create, edit, archive, or reactivate funnel stage definitions.";
  return "Your current role cannot perform this action.";
}

export function logPermissionCheck(
  action: ApiPermissionAction,
  context: ApiPermissionContext,
  allowed: boolean
) {
  console.warn("[api-permission-check]", {
    action,
    userId: context.userId,
    userRole: context.userRole,
    userName: context.userName,
    allowed,
    softMode: context.isSoftMode,
  });
}

export function logSoftPermissionCheck(
  action: string,
  context: ApiPermissionContext,
  allowed: boolean
) {
  console.warn("[permission-check-legacy]", {
    action,
    userId: context.userId,
    userRole: context.userRole,
    userName: context.userName,
    allowed,
    softMode: context.isSoftMode,
  });
}

export function buildPermissionDeniedResponse(
  action: ApiPermissionAction,
  context: ApiPermissionContext
) {
  return NextResponse.json(
    {
      error: apiPermissionDeniedMessage(action),
      permission: {
        action,
        userRole: context.userRole,
        userId: context.userId,
        userName: context.userName,
        softMode: context.isSoftMode,
      },
    },
    { status: 403 }
  );
}

export function enforceApiPermission(request: Request, action: ApiPermissionAction) {
  const context = getPermissionContext(request);
  const allowed = isApiActionAllowed(action, context.userRole);

  logPermissionCheck(action, context, allowed);

  if (!allowed) {
    return {
      context,
      allowed,
      response: buildPermissionDeniedResponse(action, context),
    };
  }

  return {
    context,
    allowed,
    response: null,
  };
}
