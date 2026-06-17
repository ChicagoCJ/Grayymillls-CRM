import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BACKUP_TABLES = [
  "companies",
  "contacts",
  "prospects",
  "activities",
  "sales_opportunities",
  "sales_opportunity_activities",
  "funnel_stages",
  "tags",
  "company_tags",
  "contact_tags",
  "crm_users",
  "prospect_intelligence",
  "import_rows",
  "imports",
] as const;

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeRole(value: string | null) {
  return (value || "").trim().toLowerCase().replace(/[ _-]+/g, "_");
}

function createBackupFileName(createdAt: string) {
  return `graymills-crm-backup-${createdAt.replace(/[:.]/g, "-")}.json`;
}

export async function GET(request: NextRequest) {
  try {
    const userRole = normalizeRole(request.headers.get("x-crm-user-role"));

    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Backup export requires Admin access." },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const createdAt = new Date().toISOString();
    const tables: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};
    const errors: Record<string, string> = {};

    for (const tableName of BACKUP_TABLES) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*");

      if (error) {
        errors[tableName] = error.message;
        tables[tableName] = [];
        rowCounts[tableName] = 0;
        continue;
      }

      tables[tableName] = data || [];
      rowCounts[tableName] = data?.length || 0;
    }

    const backup = {
      backupType: "graymills-crm-json-export",
      backupVersion: "Rev 2.13",
      createdAt,
      source: "Graymills CRM",
      restorePolicy: "Export only. Do not restore directly without preview, row counts, Admin confirmation, and a fresh database backup.",
      tables,
      rowCounts,
      errors,
    };

    const fileName = createBackupFileName(createdAt);

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not create backup export.",
      },
      { status: 500 }
    );
  }
}
