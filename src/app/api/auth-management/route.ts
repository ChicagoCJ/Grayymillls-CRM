import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInAdmin } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

type AuthManagementPayload = {
  crmUserId?: string;
  temporaryPassword?: string;
};

async function listAllAuthUsers(
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const users = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } =
      await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      throw error;
    }

    const batch = Array.isArray(data?.users)
      ? data.users
      : [];

    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function GET(request: Request) {
  try {
    const verification =
      await verifySignedInAdmin(request);

    if (verification.response) {
      return verification.response;
    }

    const supabase = getSupabaseAdmin();

    const [
      authUsers,
      crmUsersResult,
    ] = await Promise.all([
      listAllAuthUsers(supabase),
      supabase
        .from("crm_users")
        .select(
          "id, display_name, email, user_role, coverage_type, status, sort_order"
        )
        .order("sort_order", { ascending: true })
        .order("display_name", { ascending: true }),
    ]);

    if (crmUsersResult.error) {
      throw crmUsersResult.error;
    }

    const authByEmail = new Map(
      authUsers
        .filter((user) =>
          normalizeEmail(user.email)
        )
        .map((user) => [
          normalizeEmail(user.email),
          user,
        ])
    );

    const users = (crmUsersResult.data || []).map(
      (crmUser) => {
        const email = normalizeEmail(crmUser.email);
        const authUser = email
          ? authByEmail.get(email)
          : undefined;

        return {
          crmUserId: crmUser.id,
          displayName: crmUser.display_name,
          email: crmUser.email,
          userRole: crmUser.user_role,
          coverageType: crmUser.coverage_type,
          crmStatus: crmUser.status,
          hasAuthLogin: Boolean(authUser),
          authUserId: authUser?.id || null,
          emailConfirmed: Boolean(
            authUser?.email_confirmed_at
          ),
          lastSignInAt:
            authUser?.last_sign_in_at || null,
          authCreatedAt:
            authUser?.created_at || null,
          isCurrentAdmin:
            authUser?.id ===
            verification.context.authUserId,
        };
      }
    );

    return NextResponse.json({
      verifiedAdmin: {
        authUserId:
          verification.context.authUserId,
        authEmail:
          verification.context.authEmail,
        crmUserId:
          verification.context.crmUserId,
        displayName:
          verification.context.crmDisplayName,
      },
      users,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load authentication status.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const verification =
      await verifySignedInAdmin(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as AuthManagementPayload;

    const crmUserId = String(
      payload.crmUserId || ""
    ).trim();

    const temporaryPassword = String(
      payload.temporaryPassword || ""
    );

    if (!crmUserId) {
      return NextResponse.json(
        {
          error: "CRM User ID is required.",
        },
        { status: 400 }
      );
    }

    if (temporaryPassword.length < 8) {
      return NextResponse.json(
        {
          error:
            "The temporary password must contain at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const {
      data: crmUser,
      error: crmUserError,
    } = await supabase
      .from("crm_users")
      .select(
        "id, display_name, email, user_role, status"
      )
      .eq("id", crmUserId)
      .maybeSingle();

    if (crmUserError) {
      throw crmUserError;
    }

    if (!crmUser) {
      return NextResponse.json(
        {
          error: "The CRM Users record was not found.",
        },
        { status: 404 }
      );
    }

    const crmStatus = String(
      crmUser.status || ""
    )
      .trim()
      .toLowerCase();

    if (crmStatus !== "active") {
      return NextResponse.json(
        {
          error:
            "Only active CRM Users can receive an Auth login.",
        },
        { status: 400 }
      );
    }

    const email = normalizeEmail(crmUser.email);

    if (!email) {
      return NextResponse.json(
        {
          error:
            "The CRM Users record must have an email address before creating a login.",
        },
        { status: 400 }
      );
    }

    const authUsers =
      await listAllAuthUsers(supabase);

    const existingAuthUser = authUsers.find(
      (user) =>
        normalizeEmail(user.email) === email
    );

    if (existingAuthUser) {
      return NextResponse.json(
        {
          error:
            "A Supabase Auth login already exists for this email address.",
        },
        { status: 409 }
      );
    }

    const {
      data: createdAuthData,
      error: createAuthError,
    } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        display_name:
          crmUser.display_name || email,
        crm_user_id: crmUser.id,
      },
    });

    if (createAuthError) {
      throw createAuthError;
    }

    if (!createdAuthData.user) {
      throw new Error(
        "Supabase did not return the created Auth user."
      );
    }

    return NextResponse.json({
      status: "created",
      user: {
        crmUserId: crmUser.id,
        displayName:
          crmUser.display_name || email,
        email,
        authUserId: createdAuthData.user.id,
        emailConfirmed: Boolean(
          createdAuthData.user.email_confirmed_at
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the authentication login.",
      },
      { status: 500 }
    );
  }
}

