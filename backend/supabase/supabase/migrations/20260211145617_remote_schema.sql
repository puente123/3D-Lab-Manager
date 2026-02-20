

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."api_get_item_by_id"("_id" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select jsonb_build_object(
    'id', e.qr_code,
    'name', e.name,
    'category', e.category,
    'status', e.status,
    'locationPath', e.location_path,
    'thumbnailUrl', e.thumbnail_url,
    'hotspot',
      case when e.x is not null and e.y is not null and e.z is not null
           then jsonb_build_array(e.x, e.y, e.z)
           else null end
  )
  from equipment e
  where e.qr_code = _id
  limit 1;
$$;


ALTER FUNCTION "public"."api_get_item_by_id"("_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."api_get_items"("_q" "text" DEFAULT NULL::"text", "_category" "text" DEFAULT NULL::"text", "_status" "text" DEFAULT NULL::"text") RETURNS SETOF "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select jsonb_build_object(
    'id', e.qr_code,
    'name', e.name,
    'category', e.category,
    'status', e.status,
    'locationPath', e.location_path,
    'thumbnailUrl', e.thumbnail_url,
    'hotspot',
      case when e.x is not null and e.y is not null and e.z is not null
           then jsonb_build_array(e.x, e.y, e.z)
           else null end
  )
  from equipment e
  where (_q is null or e.name ilike '%'||_q||'%' or e.qr_code ilike '%'||_q||'%')
    and (_category is null or e.category = _category)
    and (_status is null or e.status = _status)
  order by e.name asc;
$$;


ALTER FUNCTION "public"."api_get_items"("_q" "text", "_category" "text", "_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, '', 'student');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."checkout_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "checkout_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "return_date" timestamp with time zone
);


ALTER TABLE "public"."checkout_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."checkout_log" IS 'Logs all equipment checkout transactions';



CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "qr_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "lab_id" "text",
    "thumbnail_url" "text",
    "x" numeric,
    "y" numeric,
    "z" numeric,
    "rot_X" numeric,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rot_Y" numeric,
    "rot_Z" numeric,
    "scale" numeric,
    "model_path" "text",
    "amazon_link" "text",
    "location_path" "text",
    CONSTRAINT "equipment_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'checked_out'::"text", 'broken'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issue_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "issues_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."items_public_view" AS
 SELECT "qr_code" AS "id",
    "name",
    "category",
    "status",
    "lab_id" AS "location_path",
    "thumbnail_url",
        CASE
            WHEN (("x" IS NOT NULL) AND ("y" IS NOT NULL) AND ("z" IS NOT NULL)) THEN "jsonb_build_array"("x", "y", "z")
            ELSE NULL::"jsonb"
        END AS "hotspot"
   FROM "public"."equipment";


ALTER VIEW "public"."items_public_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."labs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lab_code" "text",
    "name" "text" NOT NULL,
    "blurb" "text",
    "model_path" "text",
    "thumbnail_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."labs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "last_sign_in_at" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'ta'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."checkout_log"
    ADD CONSTRAINT "checkout_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."issue_notes"
    ADD CONSTRAINT "issue_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labs"
    ADD CONSTRAINT "labs_lab_code_key" UNIQUE ("lab_code");



ALTER TABLE ONLY "public"."labs"
    ADD CONSTRAINT "labs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_checkout_log_date" ON "public"."checkout_log" USING "btree" ("checkout_date" DESC);



CREATE INDEX "idx_checkout_log_equipment" ON "public"."checkout_log" USING "btree" ("equipment_id");



CREATE INDEX "idx_checkout_log_user" ON "public"."checkout_log" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."checkout_log"
    ADD CONSTRAINT "checkout_log_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_log"
    ADD CONSTRAINT "checkout_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("lab_code");



ALTER TABLE ONLY "public"."checkout_log"
    ADD CONSTRAINT "fk_equipment" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_log"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_notes"
    ADD CONSTRAINT "issue_notes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_notes"
    ADD CONSTRAINT "issue_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage all checkouts" ON "public"."checkout_log" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"text")))));



CREATE POLICY "Allow authenticated users to select equipment" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read equipment" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can create their own checkouts" ON "public"."checkout_log" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile on signup" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view all checkouts" ON "public"."checkout_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "checkout_insert_staff" ON "public"."checkout_log" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"])));



ALTER TABLE "public"."checkout_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkout_select_self_or_staff" ON "public"."checkout_log" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"]))));



CREATE POLICY "checkout_update_staff" ON "public"."checkout_log" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"])));



CREATE POLICY "equipment_public_read" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "equipment_staff_write" ON "public"."equipment" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"])));



ALTER TABLE "public"."issue_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "issue_notes_insert_staff" ON "public"."issue_notes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"])));



CREATE POLICY "issue_notes_select_self_or_staff" ON "public"."issue_notes" FOR SELECT TO "authenticated" USING (((( SELECT "issues"."user_id"
   FROM "public"."issues"
  WHERE ("issues"."id" = "issue_notes"."issue_id")) = "auth"."uid"()) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"]))));



ALTER TABLE "public"."issues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "issues_insert_user" ON "public"."issues" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "issues_read_self_or_staff" ON "public"."issues" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"]))));



CREATE POLICY "issues_update_staff" ON "public"."issues" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"])));



ALTER TABLE "public"."labs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "labs_public_read" ON "public"."labs" FOR SELECT USING (true);



CREATE POLICY "labs_staff_write" ON "public"."labs" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['ta'::"text", 'admin'::"text"])));



CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_read_self_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "id") OR (( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."api_get_item_by_id"("_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."api_get_item_by_id"("_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."api_get_item_by_id"("_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."api_get_items"("_q" "text", "_category" "text", "_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."api_get_items"("_q" "text", "_category" "text", "_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."api_get_items"("_q" "text", "_category" "text", "_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."checkout_log" TO "anon";
GRANT ALL ON TABLE "public"."checkout_log" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_log" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."issue_notes" TO "anon";
GRANT ALL ON TABLE "public"."issue_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_notes" TO "service_role";



GRANT ALL ON TABLE "public"."issues" TO "anon";
GRANT ALL ON TABLE "public"."issues" TO "authenticated";
GRANT ALL ON TABLE "public"."issues" TO "service_role";



GRANT ALL ON TABLE "public"."items_public_view" TO "anon";
GRANT ALL ON TABLE "public"."items_public_view" TO "authenticated";
GRANT ALL ON TABLE "public"."items_public_view" TO "service_role";



GRANT ALL ON TABLE "public"."labs" TO "anon";
GRANT ALL ON TABLE "public"."labs" TO "authenticated";
GRANT ALL ON TABLE "public"."labs" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Auth upload lab models"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'lab-models'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Auth upload lab thumbnails"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'lab-thumbnails'::text) AND (auth.role() = 'authenticated'::text)));



