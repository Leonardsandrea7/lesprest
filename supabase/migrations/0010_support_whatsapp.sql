insert into settings (key, value)
values ('support_whatsapp_number', '""'::jsonb)
on conflict (key) do nothing;
