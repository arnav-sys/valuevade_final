-- Valuevade Enterprise + Resources. Additive, rerunnable; existing course/auth data untouched.
begin;
create table if not exists public.enterprise_leads (
 id uuid primary key, name text not null, email text not null, company text not null,
 seats integer not null check (seats between 1 and 1000), interest text not null,
 requirements text not null, estimate jsonb not null, consent boolean not null check(consent),
 status text not null default 'new' check(status in ('new','contacted','qualified','closed')),
 email_status text not null default 'pending', email_id text,
 created_at timestamptz not null default now()
);
create index if not exists enterprise_leads_created_idx on public.enterprise_leads(created_at desc);
create table if not exists public.marketplace_resources (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null,
 category text not null, price_paise integer not null check(price_paise >= 0),
 includes jsonb not null default '[]', is_published boolean not null default false,
 file_path text, file_name text, file_size bigint, file_type text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.resource_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 resource_id uuid not null references public.marketplace_resources(id),
 amount_paise integer not null check(amount_paise > 0), currency text not null default 'INR' check(currency='INR'),
 razorpay_order_id text unique, razorpay_payment_id text unique,
 status text not null default 'created' check(status in ('created','paid','refunded')),
 created_at timestamptz not null default now(), paid_at timestamptz
);
create index if not exists resource_orders_buyer_idx on public.resource_orders(user_id,resource_id,status);
alter table public.enterprise_leads enable row level security;
alter table public.marketplace_resources enable row level security;
alter table public.resource_orders enable row level security;
-- Browser clients cannot read private leads, object paths or transactions directly.
revoke all on public.enterprise_leads, public.marketplace_resources, public.resource_orders from anon, authenticated;
grant all on public.enterprise_leads, public.marketplace_resources, public.resource_orders to service_role;
insert into storage.buckets (id,name,public,file_size_limit)
values ('paid-resources','paid-resources',false,26214400)
on conflict (id) do update set public=false,file_size_limit=26214400;
notify pgrst, 'reload schema';
commit;