-- ============================================
-- JOJO发财之路 · Supabase 建表 SQL
-- ============================================
-- 使用方式：
--   1. 登录 Supabase 控制台 → 找到你的项目 → SQL Editor
--   2. 粘贴以下全部 SQL → 点击 Run
--   3. 确认「查询成功」即可
-- ============================================

-- 1. 创建 user_data 表
CREATE TABLE IF NOT EXISTS public.user_data (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 启用 RLS（行级安全）
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- 3. 允许匿名用户读自己的行
--    （Anon Key 通过 apikey header 鉴权）
CREATE POLICY "anon_read_own_data"
ON public.user_data
FOR SELECT
USING (true);  -- 单用户场景，所有行可读

-- 4. 允许匿名用户写（insert/upsert）
CREATE POLICY "anon_insert_own_data"
ON public.user_data
FOR INSERT
WITH CHECK (true);

-- 5. 允许匿名用户更新自己的行
CREATE POLICY "anon_update_own_data"
ON public.user_data
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. 允许匿名用户删除（仅限自己，如需防误删可注释掉）
CREATE POLICY "anon_delete_own_data"
ON public.user_data
FOR DELETE
USING (true);

-- 7. 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.user_data;
CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON public.user_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. 验证
SELECT table_schema, table_name, row_level_security
FROM information_schema.tables
WHERE table_name = 'user_data';

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_data';