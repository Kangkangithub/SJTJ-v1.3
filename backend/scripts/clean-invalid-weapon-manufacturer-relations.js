const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 清理无效的武器-制造商关系
async function cleanInvalidRelations() {
    const dbPath = path.join(__dirname, '../data/military-knowledge.db');
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('数据库连接失败:', err);
                reject(err);
                return;
            }
            console.log('数据库连接成功');
        });

        // 开始清理过程
        console.log('开始分析武器-制造商关系表...');
        
        // 1. 统计当前情况
        db.get(`
            SELECT 
                COUNT(*) as total_relations,
                (SELECT COUNT(*) FROM weapon_manufacturers wm 
                 LEFT JOIN weapons w ON wm.weapon_id = w.id 
                 WHERE w.id IS NULL) as invalid_relations,
                (SELECT COUNT(*) FROM weapon_manufacturers wm 
                 INNER JOIN weapons w ON wm.weapon_id = w.id) as valid_relations
            FROM weapon_manufacturers
        `, (err, stats) => {
            if (err) {
                console.error('统计查询失败:', err);
                db.close();
                reject(err);
                return;
            }
            
            console.log('当前统计情况:');
            console.log(`- 总关系数: ${stats.total_relations}`);
            console.log(`- 有效关系数: ${stats.valid_relations}`);
            console.log(`- 无效关系数: ${stats.invalid_relations}`);
            
            if (stats.invalid_relations === 0) {
                console.log('没有发现无效关系，无需清理');
                db.close();
                resolve();
                return;
            }
            
            // 2. 显示即将删除的无效关系示例
            db.all(`
                SELECT wm.weapon_id, wm.manufacturer_id, m.name as manufacturer_name
                FROM weapon_manufacturers wm 
                LEFT JOIN weapons w ON wm.weapon_id = w.id 
                LEFT JOIN manufacturers m ON wm.manufacturer_id = m.id
                WHERE w.id IS NULL 
                LIMIT 10
            `, (err, invalidSamples) => {
                if (err) {
                    console.error('查询无效关系示例失败:', err);
                    db.close();
                    reject(err);
                    return;
                }
                
                console.log('\n即将删除的无效关系示例:');
                invalidSamples.forEach(rel => {
                    console.log(`- 武器ID: ${rel.weapon_id} (不存在) -> 制造商: ${rel.manufacturer_name}`);
                });
                
                // 3. 显示有效关系
                db.all(`
                    SELECT wm.weapon_id, w.name as weapon_name, m.name as manufacturer_name
                    FROM weapon_manufacturers wm 
                    INNER JOIN weapons w ON wm.weapon_id = w.id 
                    INNER JOIN manufacturers m ON wm.manufacturer_id = m.id
                `, (err, validRelations) => {
                    if (err) {
                        console.error('查询有效关系失败:', err);
                        db.close();
                        reject(err);
                        return;
                    }
                    
                    console.log('\n将保留的有效关系:');
                    validRelations.forEach(rel => {
                        console.log(`- ${rel.weapon_name} -> ${rel.manufacturer_name}`);
                    });
                    
                    // 4. 执行清理操作
                    console.log('\n开始清理无效关系...');
                    
                    db.run(`
                        DELETE FROM weapon_manufacturers 
                        WHERE weapon_id NOT IN (SELECT id FROM weapons)
                    `, function(err) {
                        if (err) {
                            console.error('清理操作失败:', err);
                            db.close();
                            reject(err);
                            return;
                        }
                        
                        console.log(`清理完成！删除了 ${this.changes} 个无效关系`);
                        
                        // 5. 验证清理结果
                        db.get(`
                            SELECT 
                                COUNT(*) as total_relations,
                                (SELECT COUNT(*) FROM weapon_manufacturers wm 
                                 LEFT JOIN weapons w ON wm.weapon_id = w.id 
                                 WHERE w.id IS NULL) as invalid_relations,
                                (SELECT COUNT(*) FROM weapon_manufacturers wm 
                                 INNER JOIN weapons w ON wm.weapon_id = w.id) as valid_relations
                            FROM weapon_manufacturers
                        `, (err, finalStats) => {
                            if (err) {
                                console.error('验证查询失败:', err);
                                db.close();
                                reject(err);
                                return;
                            }
                            
                            console.log('\n清理后统计情况:');
                            console.log(`- 总关系数: ${finalStats.total_relations}`);
                            console.log(`- 有效关系数: ${finalStats.valid_relations}`);
                            console.log(`- 无效关系数: ${finalStats.invalid_relations}`);
                            
                            if (finalStats.invalid_relations === 0) {
                                console.log('\n✅ 清理成功！所有无效关系已删除');
                            } else {
                                console.log(`\n⚠️  仍有 ${finalStats.invalid_relations} 个无效关系`);
                            }
                            
                            // 6. 优化数据库
                            console.log('\n正在优化数据库...');
                            db.run('VACUUM', (err) => {
                                if (err) {
                                    console.warn('数据库优化失败:', err);
                                } else {
                                    console.log('数据库优化完成');
                                }
                                
                                db.close((err) => {
                                    if (err) {
                                        console.error('关闭数据库失败:', err);
                                        reject(err);
                                    } else {
                                        console.log('数据库连接已关闭');
                                        resolve();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// 如果直接运行此脚本
if (require.main === module) {
    console.log('开始清理无效的武器-制造商关系...');
    
    cleanInvalidRelations()
        .then(() => {
            console.log('\n🎉 清理任务完成！');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ 清理任务失败:', error);
            process.exit(1);
        });
}

module.exports = { cleanInvalidRelations };