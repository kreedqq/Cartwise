-- 0060_kit_request_area_categories.sql
-- Kit Gesuche category filter uses the area catalog from 0059, not products.category.
-- Does not alter 0041 / 0056 / 0057 / 0058 / 0059 files or pricing functions.

create or replace function public.kit_request_matches_area_category(
  _product_id uuid,
  _shop_area text,
  _category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _category is null
    or exists (
      select 1
      from public.shop_area_products sap
      join public.shop_area_categories sac
        on sac.shop_area_key = sap.shop_area_key
       and sac.category_key = public.effective_area_category_key(
         sap.imported_category_key,
         sap.manual_category_key
       )
      where sap.shop_area_key = _shop_area
        and sap.product_id = _product_id
        and sac.is_active
        and sac.category_key = _category
    );
$$;

revoke all on function public.kit_request_matches_area_category(uuid, text, text)
  from public, anon, authenticated;

create or replace function public.list_open_kit_requests(
  _search text default null,
  _category text default null,
  _product_id uuid default null,
  _product_name text default null,
  _variant text default null,
  _min_remaining integer default null,
  _sort text default 'newest',
  _page integer default 1,
  _page_size integer default 20,
  _shop_area text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _term text;
  _page_n integer;
  _size integer;
  _offset integer;
  _total integer;
  _items jsonb;
  _area text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _area := coalesce(nullif(trim(_shop_area), ''), 'group_buy_1');
  perform public.assert_kit_area_access(_uid, _area);

  perform public.kit_request_expire_overdue();

  _term := nullif(trim(coalesce(_search, '')), '');
  _page_n := greatest(coalesce(_page, 1), 1);
  _size := least(greatest(coalesce(_page_size, 20), 1), 50);
  _offset := (_page_n - 1) * _size;

  if _sort is null or _sort not in ('newest', 'fewest_remaining', 'most_remaining') then
    _sort := 'newest';
  end if;

  select count(*)::integer
  into _total
  from public.kit_shares k
  join public.products p on p.id = k.product_id
  left join (
    select kit_share_id, sum(quantity)::integer as allocated
    from public.kit_share_participants
    group by kit_share_id
  ) a on a.kit_share_id = k.id
  where k.is_open_request
    and k.status = 'open'
    and k.shop_area = _area
    and p.is_active
    and public.product_visible_in_shop_area(p.id, _area)
    and (_product_id is null or k.product_id = _product_id)
    and (_product_name is null or lower(p.name) = lower(_product_name))
    and public.kit_request_matches_area_category(p.id, _area, _category)
    and (
      _variant is null
      or lower(coalesce(p.dosage_vial, '')) = lower(_variant)
    )
    and (
      _min_remaining is null
      or (k.kit_size_vials - coalesce(a.allocated, 0)) >= _min_remaining
    )
    and (
      _term is null
      or p.name ilike '%' || _term || '%'
      or p.code ilike '%' || _term || '%'
      or coalesce(p.dosage_vial, '') ilike '%' || _term || '%'
      or exists (
        select 1 from public.profiles pr
        where pr.id = k.creator_user_id
          and pr.username ilike '%' || _term || '%'
      )
    );

  select coalesce(jsonb_agg(q.card order by q.ordinality), '[]'::jsonb)
  into _items
  from (
    select
      public.kit_request_card_payload(k, p, _uid) as card,
      row_number() over (
        order by
          case when _sort = 'fewest_remaining' then (k.kit_size_vials - coalesce(a.allocated, 0)) end asc nulls last,
          case when _sort = 'most_remaining' then (k.kit_size_vials - coalesce(a.allocated, 0)) end desc nulls last,
          k.created_at desc
      ) as ordinality
    from public.kit_shares k
    join public.products p on p.id = k.product_id
    left join (
      select kit_share_id, sum(quantity)::integer as allocated
      from public.kit_share_participants
      group by kit_share_id
    ) a on a.kit_share_id = k.id
    where k.is_open_request
      and k.status = 'open'
      and k.shop_area = _area
      and p.is_active
      and public.product_visible_in_shop_area(p.id, _area)
      and (_product_id is null or k.product_id = _product_id)
      and (_product_name is null or lower(p.name) = lower(_product_name))
      and public.kit_request_matches_area_category(p.id, _area, _category)
      and (
        _variant is null
        or lower(coalesce(p.dosage_vial, '')) = lower(_variant)
      )
      and (
        _min_remaining is null
        or (k.kit_size_vials - coalesce(a.allocated, 0)) >= _min_remaining
      )
      and (
        _term is null
        or p.name ilike '%' || _term || '%'
        or p.code ilike '%' || _term || '%'
        or coalesce(p.dosage_vial, '') ilike '%' || _term || '%'
        or exists (
          select 1 from public.profiles pr
          where pr.id = k.creator_user_id
            and pr.username ilike '%' || _term || '%'
        )
      )
  ) q
  where q.ordinality > _offset
    and q.ordinality <= (_offset + _size);

  return jsonb_build_object(
    'items', coalesce(_items, '[]'::jsonb),
    'total', coalesce(_total, 0),
    'page', _page_n,
    'pageSize', _size
  );
end;
$$;

revoke all on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer, text)
  from public;
grant execute on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer, text)
  to authenticated;
