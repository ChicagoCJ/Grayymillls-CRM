import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type VerifiedAdminContext = {
  authUserId: string;
  authEmail: string;
  crmUserId: string;
  crmDisplayName: string;
  crmRole: string;
  crmStatus: string;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function unauthorized(message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 401 }
  );
}

function forbidden(message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 403 }
  );
}

export async function verifySignedInAdmin(request: Request): Promise<
  | {
      context: VerifiedAdminContext;
      response: null;
    }
  | {
      context: null;
      response: NextResponse;
    }
> {
  const authorization = request.headers.get("authorization") || "";
  const bearerPrefix = "Bearer ";

  if (!authorization.startsWith(bearerPrefix)) {
    return {
      context: null,
      response: unauthorized(
        "A signed-in Supabase session is required."
      ),
    };
  }

  const accessToken = authorization.slice(bearerPrefix.length).trim();

  if (!accessToken) {
    return {
      context: null,
      response: unauthorized(
        "The Supabase access token is missing."
      ),
    };
  }

  const supabase = getSupabaseAdmin();

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return {
      context: null,
      response: unauthorized(
        authError?.message || "The Supabase session is invalid."
      ),
    };
  }

  const authEmail = String(authData.user.email || "")
    .trim()
    .toLowerCase();

  if (!authEmail) {
    return {
      context: null,
      response: forbidden(
        "The signed-in Supabase account does not have an email address."
      ),
    };
  }

  const {
    data: crmUser,
    error: crmUserError,
  } = await supabase
    .from("crm_users")
    .select(
      "id, display_name, email, user_role, status"
    )
    .ilike("email", authEmail)
    .maybeSingle();

  if (crmUserError) {
    throw crmUserError;
  }

  if (!crmUser) {
    return {
      context: null,
      response: forbidden(
        "The signed-in account is not matched to a CRM Users record."
      ),
    };
  }

  const crmStatus = String(crmUser.status || "")
    .trim()
    .toLowerCase();

  const crmRole = String(crmUser.user_role || "")
    .trim()
    .toLowerCase();

  if (crmStatus !== "active") {
    return {
      context: null,
      response: forbidden(
        "The matched CRM Users record is not active."
      ),
    };
  }

  if (crmRole !== "admin") {
    return {
      context: null,
      response: forbidden(
        "Only signed-in CRM Admin users can manage authentication."
      ),
    };
  }

  return {
    context: {
      authUserId: authData.user.id,
      authEmail,
      crmUserId: String(crmUser.id),
      crmDisplayName: String(
        crmUser.display_name || authEmail
      ),
      crmRole,
      crmStatus,
    },
    response: null,
  };
}
