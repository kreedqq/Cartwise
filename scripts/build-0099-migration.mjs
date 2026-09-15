import fs from "fs";

const SUBJECT = "public.peptix_checkout_subject_user_id()";

function extractFunction(src, name) {
  const needle = `create or replace function public.${name}(`;
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(`${name} not found`);
  const end = src.indexOf("$$;", start) + 3;
  return src.slice(start, end);
}

function patchCheckoutSubject(fnBody) {
  let body = fnBody.replaceAll("auth.uid()", SUBJECT);
  body = body.replace(
    `values (_order_id, null, 'pending', ${SUBJECT})`,
    "values (_order_id, null, 'pending', auth.uid())",
  );
  const auditNeedle = `perform public.log_audit(
    ${SUBJECT}, 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber',   _order_number,
      'totalUsd',      _total_usd,
      'itemCount',     _position,
      'paymentMethod', _payment_method,
      'deliveryMethod', _shipping_delivery_method,
      'shopArea',      _area
    )
  );`;
  const auditReplacement = `if coalesce(current_setting('peptix.admin_checkout', true), '') = 'on' then
    perform public.log_audit(
      auth.uid(), 'order.admin_create', 'order', _order_id,
      jsonb_build_object('userId', ${SUBJECT}),
      jsonb_build_object(
        'orderNumber', _order_number,
        'totalUsd', _total_usd,
        'itemCount', _position,
        'paymentMethod', _payment_method,
        'deliveryMethod', _shipping_delivery_method,
        'shopArea', _area,
        'targetUserId', ${SUBJECT}
      )
    );
  else
    perform public.log_audit(
      auth.uid(), 'order.create', 'order', _order_id, null,
      jsonb_build_object(
        'orderNumber',   _order_number,
        'totalUsd',      _total_usd,
        'itemCount',     _position,
        'paymentMethod', _payment_method,
        'deliveryMethod', _shipping_delivery_method,
        'shopArea',      _area
      )
    );
  end if;`;
  if (!body.includes(auditNeedle.replace(/\s+/g, " ").slice(0, 40))) {
    if (!body.includes("perform public.log_audit(")) {
      throw new Error("log_audit block not found in create_one_area_order");
    }
    body = body.replace(
      /perform public\.log_audit\([\s\S]*?'shopArea',\s+_area\s+\)\s+\);/,
      auditReplacement,
    );
  } else {
    body = body.replace(auditNeedle, auditReplacement);
  }
  return body;
}

function patchCreateOrder(fnBody) {
  let body = fnBody;
  body = body.replace(
    "select nullif(trim(username), '') into _telegram from public.profiles where id = auth.uid();",
    `select nullif(trim(username), '') into _telegram from public.profiles where id = ${SUBJECT};`,
  );
  body = body.replace(
    "where id = _cart_id and user_id = auth.uid() and deleted_at is null",
    `where id = _cart_id and user_id = ${SUBJECT} and deleted_at is null`,
  );
  body = body.replaceAll(
    "public.cart_kit_share_is_checkout_ready(ci.kit_share_id, auth.uid(), ci.quantity)",
    `public.cart_kit_share_is_checkout_ready(ci.kit_share_id, ${SUBJECT}, ci.quantity)`,
  );
  return body;
}

const src97 = fs.readFileSync("supabase/migrations/0097_kit_share_customer_lock.sql", "utf8");
const src88 = fs.readFileSync("supabase/migrations/0088_checkout_skip_incomplete_kit_lines.sql", "utf8");

const oneArea = patchCheckoutSubject(extractFunction(src97, "create_one_area_order"));
const createOrder = patchCreateOrder(extractFunction(src88, "create_order"));

const adminRpcs = fs.readFileSync("scripts/0099-admin-rpcs.sql", "utf8");

const header = `-- 0099_admin_create_order_for_user.sql
-- Admin checkout on behalf of a customer using existing create_order / create_one_area_order.
-- Subject user GUC drives pricing, kit participant checks, and orders.user_id.

-- ---------------------------------------------------------------------------
-- Checkout subject (customer) vs actor (signed-in user, often admin)
-- ---------------------------------------------------------------------------

create or replace function public.peptix_checkout_subject_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _raw text;
begin
  _raw := nullif(trim(current_setting('peptix.checkout_subject_user_id', true)), '');
  if _raw is not null then
    begin
      return _raw::uuid;
    exception
      when others then
        null;
    end;
  end if;
  return auth.uid();
end;
$$;

revoke all on function public.peptix_checkout_subject_user_id() from public, anon, authenticated;

create or replace function public.assert_admin_authenticated()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  return _uid;
end;
$$;

revoke all on function public.assert_admin_authenticated() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patched checkout (subject-aware)
-- ---------------------------------------------------------------------------

`;

const grants = `
revoke all on function public.create_one_area_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text)
  to authenticated;
`;

const out = header + oneArea + "\n\n" + createOrder + "\n\n" + adminRpcs + grants;
fs.writeFileSync("supabase/migrations/0099_admin_create_order_for_user.sql", out);
console.log("Wrote supabase/migrations/0099_admin_create_order_for_user.sql", out.length, "bytes");
