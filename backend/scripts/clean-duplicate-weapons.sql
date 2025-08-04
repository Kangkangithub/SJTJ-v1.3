-- 清理重复武器数据的SQL脚本
-- 只保留每个武器名称的第一条记录（ID最小的）

-- 创建临时表存储要保留的记录ID
CREATE TEMPORARY TABLE weapons_to_keep AS
SELECT MIN(id) as id
FROM weapons
GROUP BY name;

-- 删除重复的武器记录（保留ID最小的）
DELETE FROM weapons 
WHERE id NOT IN (SELECT id FROM weapons_to_keep);

-- 显示清理结果
SELECT 'Remaining weapons count:' as info, COUNT(*) as count FROM weapons
UNION ALL
SELECT 'Unique weapon names:' as info, COUNT(DISTINCT name) as count FROM weapons;

-- 显示剩余的武器列表（按名称排序）
SELECT id, name, type, country, year 
FROM weapons 
ORDER BY name;