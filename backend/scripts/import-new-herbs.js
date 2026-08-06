/**
 * 导入新增药材数据脚本
 * 使用方式: node backend/scripts/import-new-herbs.js
 *
 * 从 import-herbs-data.json 读取 48 味新增药材，导入数据库并补充
 * 分类、性味、归经、功效、产地等全部关联信息。
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sqlite3 = require('sqlite3').verbose();
const config = require('../src/config');
const logger = require('../src/utils/logger');

// 常用药标记（新增的常用药材）
const COMMON_HERBS = ['决明子', '苦参', '灵芝', '野菊花', '青蒿', '罗汉果', '莲子心', '通草', '辛夷', '虫草'];

function getDbPath() {
  const p = config.databases.sqlite.path;
  return path.isAbsolute(p) ? p : path.join(__dirname, '../', p);
}

async function main() {
  const db = new sqlite3.Database(getDbPath());
  const herbs = require('./import-herbs-data.json');

  // 修正名称：草蔻 → 草寇
  herbs.forEach(h => { if (h.name === '草蔻') h.name = '草寇'; });

  console.log(`开始导入 ${herbs.length} 味新增药材...\n`);

  // 加载参考数据
  const getMap = (table) => new Promise((resolve, reject) => {
    db.all(`SELECT id, name FROM ${table}`, (e, rows) => {
      if (e) reject(e); else resolve(rows.reduce((m, r) => { m[r.name] = r.id; return m; }, {}));
    });
  });

  const categoryMap = await getMap('herb_categories');
  const regionMap = await getMap('herb_regions');
  const propertyMap = await getMap('properties');
  const meridianMap = await getMap('meridians');
  const efficacyMap = await getMap('efficacies');

  let inserted = 0, skipped = 0, newCategories = 0, newRegions = 0, newEfficacies = 0;

  for (const h of herbs) {
    // 1. 分类（不存在则创建）
    let catId = categoryMap[h.category];
    if (!catId && h.category) {
      await new Promise((res, rej) => {
        db.run('INSERT INTO herb_categories (name) VALUES (?)', [h.category], function(err) {
          if (err && !err.message.includes('UNIQUE')) return rej(err);
          res();
        });
      });
      const row = await new Promise((res, rej) =>
        db.get('SELECT id FROM herb_categories WHERE name = ?', [h.category], (e, r) => e ? rej(e) : res(r)));
      categoryMap[h.category] = row.id;
      catId = row.id;
      newCategories++;
    }

    // 2. 产地（多个省取第一个为主产地）
    let regionId = null;
    if (h.region) {
      const firstRegion = h.region.split(/[、,，]/)[0].trim();
      regionId = regionMap[firstRegion];
      if (!regionId && firstRegion) {
        await new Promise((res, rej) => {
          db.run('INSERT OR IGNORE INTO herb_regions (name) VALUES (?)', [firstRegion], function(err) {
            if (err) return rej(err);
            res();
          });
        });
        const row = await new Promise((res, rej) =>
          db.get('SELECT id FROM herb_regions WHERE name = ?', [firstRegion], (e, r) => e ? rej(e) : res(r)));
        regionMap[firstRegion] = row.id;
        regionId = row.id;
        newRegions++;
      }
    }

    // 3. 插入药材
    const existing = await new Promise((res, rej) =>
      db.get('SELECT id FROM herbs WHERE name = ?', [h.name], (e, r) => e ? rej(e) : res(r)));
    if (existing) { skipped++; continue; }

    const herbId = await new Promise((res, rej) => {
      db.run(
        `INSERT INTO herbs (name, pinyin, category_id, region_id, description, usage_dosage, caution, is_common, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [h.name, h.pinyin || null, catId, regionId, h.description || '', h.usage_dosage || null, h.caution || null,
         COMMON_HERBS.includes(h.name) ? 1 : 0],
        function(err) { if (err) rej(err); else res(this.lastID); }
      );
    });
    inserted++;

    // 4. 性味关联
    for (const p of h.properties || []) {
      const pid = propertyMap[p];
      if (pid) {
        await new Promise((res, rej) =>
          db.run('INSERT OR IGNORE INTO herb_properties (herb_id, property_id) VALUES (?, ?)', [herbId, pid], (e) => e ? rej(e) : res()));
      } else {
        logger.warn(`药材 ${h.name} 的属性 "${p}" 不存在，跳过`);
      }
    }

    // 5. 归经关联
    for (const m of h.meridians || []) {
      const mid = meridianMap[m];
      if (mid) {
        await new Promise((res, rej) =>
          db.run('INSERT OR IGNORE INTO herb_meridians (herb_id, meridian_id) VALUES (?, ?)', [herbId, mid], (e) => e ? rej(e) : res()));
      } else {
        logger.warn(`药材 ${h.name} 的归经 "${m}" 不存在，跳过`);
      }
    }

    // 6. 功效关联（不存在则创建功效标签）
    for (const eName of h.efficacies || []) {
      let eid = efficacyMap[eName];
      if (!eid) {
        await new Promise((res, rej) => {
          db.run('INSERT OR IGNORE INTO efficacies (name) VALUES (?)', [eName], function(err) {
            if (err) return rej(err);
            res();
          });
        });
        const row = await new Promise((res, rej) =>
          db.get('SELECT id FROM efficacies WHERE name = ?', [eName], (e, r) => e ? rej(e) : res(r)));
        efficacyMap[eName] = row.id;
        eid = row.id;
        newEfficacies++;
      }
      await new Promise((res, rej) =>
        db.run('INSERT OR IGNORE INTO herb_efficacies (herb_id, efficacy_id) VALUES (?, ?)', [herbId, eid], (e) => e ? rej(e) : res()));
    }
  }

  console.log('========================================');
  console.log('📊 导入完成');
  console.log(`   新增药材: ${inserted} 味`);
  console.log(`   跳过(已存在): ${skipped} 味`);
  console.log(`   新增分类: ${newCategories} 个`);
  console.log(`   新增产地: ${newRegions} 个`);
  console.log(`   新增功效标签: ${newEfficacies} 个`);
  console.log('========================================');

  // 统计
  const counts = await new Promise((res, rej) =>
    db.all("SELECT 'herbs' as t, COUNT(*) as c FROM herbs UNION ALL SELECT 'formulas', COUNT(*) FROM formulas", (e, r) => e ? rej(e) : res(r)));
  counts.forEach(c => console.log(`   ${c.t}: ${c.c}`));

  db.close();
}

main().catch(e => { console.error('导入失败:', e); process.exit(1); });
