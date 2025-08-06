const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseIntegrityFixer {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/military-knowledge.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('数据库连接失败:', err);
                    reject(err);
                } else {
                    console.log('数据库连接成功');
                    resolve();
                }
            });
        });
    }

    async enableForeignKeys() {
        return new Promise((resolve, reject) => {
            this.db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) {
                    console.error('启用外键约束失败:', err);
                    reject(err);
                } else {
                    console.log('✅ 外键约束已启用');
                    resolve();
                }
            });
        });
    }

    async checkForeignKeyStatus() {
        return new Promise((resolve, reject) => {
            this.db.get('PRAGMA foreign_keys', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const status = row['foreign_keys'] === 1 ? '启用' : '禁用';
                    console.log(`外键约束状态: ${status}`);
                    resolve(row['foreign_keys'] === 1);
                }
            });
        });
    }

    async recreateWeaponManufacturersTable() {
        console.log('\n开始重建weapon_manufacturers表...');
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // 1. 备份现有有效数据
                this.db.run(`CREATE TEMP TABLE weapon_manufacturers_backup AS 
                    SELECT wm.* FROM weapon_manufacturers wm 
                    INNER JOIN weapons w ON wm.weapon_id = w.id 
                    INNER JOIN manufacturers m ON wm.manufacturer_id = m.id`, (err) => {
                    if (err) {
                        console.error('备份数据失败:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ 有效数据已备份');
                });

                // 2. 删除原表
                this.db.run('DROP TABLE weapon_manufacturers', (err) => {
                    if (err) {
                        console.error('删除原表失败:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ 原表已删除');
                });

                // 3. 重建表（带正确的外键约束）
                this.db.run(`CREATE TABLE weapon_manufacturers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    weapon_id INTEGER NOT NULL,
                    manufacturer_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (weapon_id) REFERENCES weapons (id) ON DELETE CASCADE,
                    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id) ON DELETE CASCADE,
                    UNIQUE(weapon_id, manufacturer_id)
                )`, (err) => {
                    if (err) {
                        console.error('重建表失败:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ 表已重建（带CASCADE约束）');
                });

                // 4. 恢复有效数据
                this.db.run(`INSERT INTO weapon_manufacturers (weapon_id, manufacturer_id, created_at)
                    SELECT weapon_id, manufacturer_id, created_at FROM weapon_manufacturers_backup`, (err) => {
                    if (err) {
                        console.error('恢复数据失败:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ 有效数据已恢复');
                });

                // 5. 删除临时表
                this.db.run('DROP TABLE weapon_manufacturers_backup', (err) => {
                    if (err) {
                        console.error('删除临时表失败:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ 临时表已清理');
                    resolve();
                });
            });
        });
    }

    async verifyIntegrity() {
        console.log('\n开始验证数据完整性...');
        
        // 检查无效关系
        const invalidRelations = await new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) as count FROM weapon_manufacturers wm 
                LEFT JOIN weapons w ON wm.weapon_id = w.id 
                WHERE w.id IS NULL`, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 检查总关系数
        const totalRelations = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM weapon_manufacturers', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 检查有效关系
        const validRelations = await new Promise((resolve, reject) => {
            this.db.all(`SELECT w.name as weapon_name, m.name as manufacturer_name 
                FROM weapon_manufacturers wm 
                INNER JOIN weapons w ON wm.weapon_id = w.id 
                INNER JOIN manufacturers m ON wm.manufacturer_id = m.id`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log('\n📊 数据完整性报告:');
        console.log(`- 总关系数: ${totalRelations}`);
        console.log(`- 有效关系数: ${validRelations.length}`);
        console.log(`- 无效关系数: ${invalidRelations}`);
        
        if (validRelations.length > 0) {
            console.log('\n✅ 有效关系列表:');
            validRelations.forEach(rel => {
                console.log(`  - ${rel.weapon_name} -> ${rel.manufacturer_name}`);
            });
        }

        return {
            total: totalRelations,
            valid: validRelations.length,
            invalid: invalidRelations,
            isHealthy: invalidRelations === 0
        };
    }

    async testCascadeDelete() {
        console.log('\n🧪 测试级联删除功能...');
        
        // 创建测试数据
        const testWeaponId = await new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO weapons (name, type, country, description) 
                VALUES ('测试武器', '测试类型', '测试国家', '用于测试级联删除')`, 
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
        });

        const testManufacturerId = await new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO manufacturers (name, country, description) 
                VALUES ('测试制造商', '测试国家', '用于测试级联删除')`, 
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
        });

        // 创建关联
        await new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO weapon_manufacturers (weapon_id, manufacturer_id) 
                VALUES (?, ?)`, [testWeaponId, testManufacturerId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`✅ 测试数据已创建 (武器ID: ${testWeaponId}, 制造商ID: ${testManufacturerId})`);

        // 删除武器，测试级联删除
        await new Promise((resolve, reject) => {
            this.db.run('DELETE FROM weapons WHERE id = ?', [testWeaponId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // 检查关联是否被自动删除
        const remainingRelations = await new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) as count FROM weapon_manufacturers 
                WHERE weapon_id = ?`, [testWeaponId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 清理测试制造商
        await new Promise((resolve, reject) => {
            this.db.run('DELETE FROM manufacturers WHERE id = ?', [testManufacturerId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (remainingRelations === 0) {
            console.log('✅ 级联删除功能正常工作');
            return true;
        } else {
            console.log('❌ 级联删除功能异常');
            return false;
        }
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('关闭数据库连接失败:', err);
                    } else {
                        console.log('数据库连接已关闭');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async run() {
        try {
            console.log('🔧 开始数据库完整性修复...\n');

            await this.connect();
            await this.enableForeignKeys();
            
            const fkEnabled = await this.checkForeignKeyStatus();
            if (!fkEnabled) {
                console.log('⚠️  外键约束启用失败，需要重建表');
            }

            await this.recreateWeaponManufacturersTable();
            
            const integrity = await this.verifyIntegrity();
            
            if (integrity.isHealthy) {
                console.log('\n✅ 数据库完整性修复成功！');
                
                const cascadeWorks = await this.testCascadeDelete();
                if (cascadeWorks) {
                    console.log('\n🎉 数据库修复完成！所有功能正常工作。');
                } else {
                    console.log('\n⚠️  级联删除功能可能存在问题，请检查外键约束设置。');
                }
            } else {
                console.log('\n❌ 数据库仍存在完整性问题，请检查修复过程。');
            }

        } catch (error) {
            console.error('修复过程中出错:', error);
        } finally {
            await this.close();
        }
    }
}

// 运行修复
if (require.main === module) {
    const fixer = new DatabaseIntegrityFixer();
    fixer.run();
}

module.exports = DatabaseIntegrityFixer;