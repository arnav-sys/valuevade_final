select table_name from information_schema.tables where table_schema='public' and table_name='resource_files';
select id, file_size_limit from storage.buckets where id = 'paid-resources';
