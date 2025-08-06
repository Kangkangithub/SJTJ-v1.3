const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseHealthChecker {
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
                    const enabled = row['foreign_keys'] === 1;
                    console.log(`🔑 外键约束状态: ${enabled ? '✅ 启用' : '❌ 禁用'}`);
                    resolve(enabled);
                }
            });
        });
    }

    async checkDataIntegrity() {
        console.log('\n📊 数据完整性检查:');
        
        // 检查武器-制造商关系完整性
        const weaponManufacturerCheck = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    (SELECT COUNT(*) FROM weapon_manufacturers) as total_relations,
                    (SELECT COUNT(*) FROM weapon_manufacturers wm 
                     INNER JOIN weapons w ON wm.weapon_id = w.id 
                     INNER JOIN manufacturers m ON wm.manufacturer_id = m.id) as valid_relations,
                    (SELECT COUNT(*) FROM weapon_manufacturers wm 
                     LEFT JOIN weapons w ON wm.weapon_id = w.id 
                     WHERE w.id IS NULL) as invalid_weapon_relations,
                    (SELECT COUNT(*) FROM weapon_manufacturers wm 
                     LEFT JOIN manufacturers m ON wm.manufacturer_id = m.id 
                     WHERE m.id IS NULL) as invalid_manufacturer_relations
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows[0]);
            });
        });

        console.log(`  - 武器-制造商关系总数: ${weaponManufacturerCheck.total_relations}`);
        console.log(`  - 有效关系数: ${weaponManufacturerCheck.valid_relations}`);
        console.log(`  - 无效武器关系: ${weaponManufacturerCheck.invalid_weapon_relations}`);
        console.log(`  - 无效制造商关系: ${weaponManufacturerCheck.invalid_manufacturer_relations}`);

        const isHealthy = weaponManufacturerCheck.invalid_weapon_relations === 0 && 
                         weaponManufacturerCheck.invalid_manufacturer_relations === 0;

        console.log(`  - 关系完整性: ${isHealthy ? '✅ 健康' : '❌ 存在问题'}`);

        return {
            weaponManufacturer: weaponManufacturerCheck,
            isHealthy
        };
    }

    async getStatistics() {
        console.log('\n📈 数据库统计:');
        
        const stats = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    (SELECT COUNT(*) FROM weapons) as total_weapons,
                    (SELECT COUNT(*) FROM manufacturers) as total_manufacturers,
                    (SELECT COUNT(*) FROM categories) as total_categories,
                    (SELECT COUNT(*) FROM countries) as total_countries,
                    (SELECT COUNT(*) FROM users) as total_users
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows[0]);
            });
        });

        console.log(`  - 武器总数: ${stats.total_weapons}`);
        console.log(`  - 制造商总数: ${stats.total_manufacturers}`);
        console.log(`  - 武器类别数: ${stats.total_categories}`);
        console.log(`  - 国家数: ${stats.total_countries}`);
        console.log(`  - 用户数: ${stats.total_users}`);

        return stats;
    }

    async getValidRelations() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT w.name as weapon_name, m.name as manufacturer_name 
                FROM weapon_manufacturers wm 
                INNER JOIN weapons w ON wm.weapon_id = w.id 
                INNER JOIN manufacturers m ON wm.manufacturer_id = m.id
                ORDER BY w.name
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('关闭数据库连接失败:', err);
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
            console.log('🏥 数据库健康检查开始...\n');

            await this.connect();
            
            const fkEnabled = await this.checkForeignKeyStatus();
            const integrity = await this.checkDataIntegrity();
            const stats = await this.getStatistics();

            if (integrity.isHealthy && fkEnabled) {
                console.log('\n✅ 数据库健康状况良好！');
                
                const validRelations = await this.getValidRelations();
                if (validRelations.length > 0) {
                    console.log('\n🔗 当前有效的武器-制造商关系:');
                    validRelations.forEach(rel => {
                        console.log(`  - ${rel.weapon_name} → ${rel.manufacturer_name}`);
                    });
                }
            } else {
                console.log('\n⚠️  数据库存在问题，建议运行修复脚本');
                if (!fkEnabled) {
                    console.log('  - 外键约束未启用');
                }
                if (!integrity.isHealthy) {
                    console.log('  - 存在数据完整性问题');
                }
            }

        } catch (error) {
            console.error('健康检查过程中出错:', error);
        } finally {
            await this.close();
        }
    }
}

// 运行健康检查
if (require.main === module) {
    const checker = new DatabaseHealthChecker();
    checker.run();
}

module.exports = DatabaseHealthChecker;