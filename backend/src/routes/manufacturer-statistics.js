const express = require('express');
const router = express.Router();
const databaseManager = require('../config/database-simple');

// 获取制造商武器数量统计
router.get('/weapon-count', async (req, res) => {
    try {
        console.log('获取制造商武器数量统计...');
        const db = databaseManager.getDatabase();

        // 查询制造商武器数量统计
        const manufacturerStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    COALESCE(m.name, '未知制造商 (' || w.country || ')') as manufacturer_name,
                    COUNT(w.id) as weapon_count,
                    m.country as manufacturer_country
                FROM weapons w
                LEFT JOIN weapon_manufacturers wm ON w.id = wm.weapon_id
                LEFT JOIN manufacturers m ON wm.manufacturer_id = m.id
                GROUP BY COALESCE(m.name, '未知制造商 (' || w.country || ')'), m.country
                HAVING weapon_count > 0
                ORDER BY weapon_count DESC
                LIMIT 20
            `, (err, rows) => {
                if (err) {
                    console.error('查询制造商统计失败:', err);
                    reject(err);
                } else {
                    console.log(`查询到 ${rows.length} 个制造商统计`);
                    resolve(rows);
                }
            });
        });

        // 转换为前端需要的格式
        const manufacturerCount = {};
        manufacturerStats.forEach(stat => {
            manufacturerCount[stat.manufacturer_name] = stat.weapon_count;
        });

        console.log('制造商统计结果:', manufacturerCount);

        res.json({
            success: true,
            data: {
                manufacturer_count: manufacturerCount,
                total_manufacturers: manufacturerStats.length,
                statistics: manufacturerStats
            }
        });

    } catch (error) {
        console.error('获取制造商统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取制造商统计失败',
            error: error.message
        });
    }
});

// 获取详细的制造商信息
router.get('/details', async (req, res) => {
    try {
        const db = databaseManager.getDatabase();

        // 获取所有制造商及其武器数量
        const manufacturerDetails = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    m.id,
                    m.name,
                    m.country,
                    m.founded,
                    m.description,
                    COUNT(wm.weapon_id) as weapon_count,
                    GROUP_CONCAT(w.name, ', ') as weapon_names
                FROM manufacturers m
                LEFT JOIN weapon_manufacturers wm ON m.id = wm.manufacturer_id
                LEFT JOIN weapons w ON wm.weapon_id = w.id
                GROUP BY m.id, m.name, m.country, m.founded, m.description
                ORDER BY weapon_count DESC, m.name
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            data: {
                manufacturers: manufacturerDetails.map(m => ({
                    id: m.id,
                    name: m.name,
                    country: m.country,
                    founded: m.founded,
                    description: m.description,
                    weapon_count: m.weapon_count,
                    weapon_names: m.weapon_names ? m.weapon_names.split(', ') : []
                }))
            }
        });

    } catch (error) {
        console.error('获取制造商详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取制造商详情失败',
            error: error.message
        });
    }
});

module.exports = router;