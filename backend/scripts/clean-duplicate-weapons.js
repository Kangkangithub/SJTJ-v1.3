const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '../data/military-knowledge.db');

console.log('开始清理重复武器数据...');
console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接数据库失败:', err.message);
        return;
    }
    console.log('数据库连接成功');
});

// 清理重复数据的函数
function cleanDuplicateWeapons() {
    return new Promise((resolve, reject) => {
        // 首先查看重复数据情况
        db.all(`
            SELECT name, COUNT(*) as count 
            FROM weapons 
            GROUP BY name 
            HAVING COUNT(*) > 1 
            ORDER BY count DESC
        `, (err, duplicates) => {
            if (err) {
                reject(err);
                return;
            }
            
            console.log('\n发现的重复武器数据:');
            if (duplicates.length === 0) {
                console.log('没有发现重复数据');
                resolve();
                return;
            }
            
            duplicates.forEach(item => {
                console.log(`- ${item.name}: ${item.count} 条记录`);
            });
            
            // 执行清理操作
            console.log('\n开始清理重复数据...');
            
            // 删除重复记录，只保留ID最小的
            db.run(`
                DELETE FROM weapons 
                WHERE id NOT IN (
                    SELECT MIN(id) 
                    FROM weapons 
                    GROUP BY name
                )
            `, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                console.log(`成功删除 ${this.changes} 条重复记录`);
                
                // 验证清理结果
                db.all(`
                    SELECT name, COUNT(*) as count 
                    FROM weapons 
                    GROUP BY name 
                    HAVING COUNT(*) > 1
                `, (err, remainingDuplicates) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (remainingDuplicates.length === 0) {
                        console.log('✅ 所有重复数据已清理完成');
                    } else {
                        console.log('⚠️ 仍有重复数据:', remainingDuplicates);
                    }
                    
                    // 显示最终统计
                    db.get(`SELECT COUNT(*) as total FROM weapons`, (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        console.log(`\n最终统计: 数据库中共有 ${result.total} 条武器记录`);
                        resolve();
                    });
                });
            });
        });
    });
}

// 执行清理
cleanDuplicateWeapons()
    .then(() => {
        console.log('\n数据清理完成！');
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err.message);
            } else {
                console.log('数据库连接已关闭');
            }
        });
    })
    .catch((error) => {
        console.error('清理过程中发生错误:', error);
        db.close();
    });