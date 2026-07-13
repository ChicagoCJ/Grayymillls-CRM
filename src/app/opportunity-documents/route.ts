import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../api/_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = "opportunity-documents";

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function safeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opportunity_documents")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const documents = await Promise.all(
      (data ?? []).map(async (document) => {
        const { data: signedUrlData } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(document.file_path, 60 * 60);

        return {
          ...document,
          signed_url: signedUrlData?.signedUrl ?? null,
        };
      })
    );

    return NextResponse.json({
      documents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load opportunity documents.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const supabase = getSupabaseAdmin();
    const formData = await request.formData();

    const file = formData.get("file");
    const opportunityId = cleanText(formData.get("opportunityId"));
    const companyId = cleanText(formData.get("companyId"));
    const contactId = cleanText(formData.get("contactId"));
    const documentType = cleanText(formData.get("documentType")) || "attachment";
    const description = cleanText(formData.get("description"));

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const cleanedFileName = safeFileName(file.name || "document");
    const filePath = `opportunities/${opportunityId}/${Date.now()}-${cleanedFileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("opportunity_documents")
      .insert({
        opportunity_id: opportunityId,
        company_id: companyId || null,
        contact_id: contactId || null,
        file_name: file.name || cleanedFileName,
        file_path: filePath,
        file_type: file.type || null,
        file_size: file.size,
        document_type: documentType,
        description,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      document: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload opportunity document.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const supabase = getSupabaseAdmin();
    const payload = await request.json();

    if (!payload.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("opportunity_documents")
      .update({
        status: payload.status === "active" ? "active" : "archived",
        archived_at: payload.status === "active" ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      document: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update opportunity document.",
      },
      { status: 500 }
    );
  }
}