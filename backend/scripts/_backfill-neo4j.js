require("dotenv").config();
const neo4j = require("neo4j-driver");
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));

// 已确认：微苦→苦、微寒→寒（并入现有词表）
const BACKFILL = {
  properties: {   // 性味 HAS_PROPERTY
    "三七": { qi: ["温"], flavor: ["甘", "苦"] },
    "虎杖": { qi: ["寒"], flavor: ["苦"] }
  },
  meridians: {    // 归经 MERIDIAN_AFFINITY
    "三七": ["肝", "胃"]
  },
  efficacies: {   // 功效 HAS_EFFICACY（取自各药 description 拆分）
    "桔梗": ["宣肺", "利咽", "祛痰", "排脓"],
    "浮小麦": ["固表止汗", "益气除热"],
    "白前": ["降气", "消痰", "止咳"],
    "白果": ["敛肺定喘", "止带缩尿"],
    "芡实": ["益肾固精", "补脾止泻", "除湿止带"],
    "莲子": ["补脾止泻", "止带", "益肾涩精", "养心安神"],
    "覆盆子": ["益肾固精缩尿", "养肝明目"]
  }
};

(async () => {
  const session = driver.session();
  const tx = session.beginTransaction();
  let added = 0;
  try {
    for (const [name, { qi, flavor }] of Object.entries(BACKFILL.properties)) {
      for (const q of qi) {
        await tx.run("MERGE (p:Property {name: $pName, type: 'qi'}) WITH p MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_PROPERTY]->(p)", { pName: q, herbName: name });
        added++;
      }
      for (const f of flavor) {
        await tx.run("MERGE (p:Property {name: $pName, type: 'flavor'}) WITH p MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_PROPERTY]->(p)", { pName: f, herbName: name });
        added++;
      }
      console.log(`✓ ${name} 性味: ${flavor.join("、")}(${qi.join("、")})`);
    }
    for (const [name, mers] of Object.entries(BACKFILL.meridians)) {
      for (const m of mers) {
        await tx.run("MERGE (m:Meridian {name: $mName}) WITH m MATCH (h:Herb {name: $herbName}) MERGE (h)-[:MERIDIAN_AFFINITY]->(m)", { mName: m, herbName: name });
        added++;
      }
      console.log(`✓ ${name} 归经: ${mers.join("、")}`);
    }
    for (const [name, effs] of Object.entries(BACKFILL.efficacies)) {
      for (const e of effs) {
        await tx.run("MERGE (e:Efficacy {name: $eName}) WITH e MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_EFFICACY]->(e)", { eName: e, herbName: name });
        added++;
      }
      console.log(`✓ ${name} 功效: ${effs.join("、")}`);
    }
    await tx.commit();
    console.log(`\n✅ 全部补充完成，共新增 ${added} 条关系，事务已提交`);
  } catch (e) {
    await tx.rollback();
    console.error("❌ 补充失败，已回滚:", e.message);
  } finally {
    await session.close();
    await driver.close();
  }
})();
