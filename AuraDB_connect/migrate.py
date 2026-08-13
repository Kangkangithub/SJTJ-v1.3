# -*- coding: utf-8 -*-
"""Batch migration: herb-knowledge.db -> Neo4j AuraDB"""
import os, certifi, sqlite3
os.environ["SSL_CERT_FILE"] = certifi.where()
from neo4j import GraphDatabase

URI = "neo4j+s://985a162b.databases.neo4j.io"
AUTH = ("985a162b", "lwo7P1Y3i4Ec0LomB2rDQ-EhC2UdaGszadBkwnb0JbI")

driver = GraphDatabase.driver(URI, auth=AUTH)
driver.verify_connectivity()
print("=> Connected")

db = sqlite3.connect(r"D:\K3\SJTJ-v1.3\backend\data\herb-knowledge.db")
cur = db.cursor()

# Clear
with driver.session() as s:
    s.run("MATCH (n) DETACH DELETE n")
print("=> Cleared")

# ========================
# Batch insert helper
# ========================
def batch_run(session, cypher, rows, batch_size=300):
    batch = []
    total = 0
    for item in rows:
        batch.append(item)
        if len(batch) >= batch_size:
            session.run(cypher, batch=batch)
            total += len(batch)
            batch = []
    if batch:
        session.run(cypher, batch=batch)
        total += len(batch)
    return total

with driver.session() as s:
    # ---- Category ----
    rows = [{"id": r[0], "name": r[1], "desc": r[2] or ""}
            for r in cur.execute("SELECT id, name, description FROM herb_categories")]
    cnt = batch_run(s, "UNWIND $batch AS r CREATE (:Category {id: r.id, name: r.name, description: r.desc})", rows)
    print(f"  Category: {cnt}")

    # ---- Region ----
    rows = [{"id": r[0], "name": r[1], "desc": r[2] or ""}
            for r in cur.execute("SELECT id, name, description FROM herb_regions")]
    cnt = batch_run(s, "UNWIND $batch AS r CREATE (:Region {id: r.id, name: r.name, description: r.desc})", rows)
    print(f"  Region: {cnt}")

    # ---- Source ----
    rows = [{"id": r[0], "name": r[1], "desc": r[2] or ""}
            for r in cur.execute("SELECT id, name, description FROM herb_sources")]
    cnt = batch_run(s, "UNWIND $batch AS r CREATE (:Source {id: r.id, name: r.name, description: r.desc})", rows)
    print(f"  Source: {cnt}")

    # ---- Efficacy ----
    rows = [{"id": r[0], "name": r[1], "desc": r[2] or ""}
            for r in cur.execute("SELECT id, name, description FROM efficacies")]
    cnt = batch_run(s, "UNWIND $batch AS r CREATE (:Efficacy {id: r.id, name: r.name, description: r.desc})", rows)
    print(f"  Efficacy: {cnt}")

    # ---- Meridian ----
    rows = [{"id": r[0], "name": r[1], "abbr": r[2] or "", "desc": r[3] or ""}
            for r in cur.execute("SELECT id, name, abbreviation, description FROM meridians")]
    cnt = batch_run(s, "UNWIND $batch AS r CREATE (:Meridian {id: r.id, name: r.name, abbr: r.abbr, description: r.desc})", rows)
    print(f"  Meridian: {cnt}")

    # ---- Property ----
    rows = [{"id": r[0], "name": r[1], "type": r[2] or "", "desc": r[3] or ""}
            for r in cur.execute("SELECT id, name, type, description FROM properties")]
    cnt = batch_run(s, "UNWIND $batch AS r CREATE (:Property {id: r.id, name: r.name, type: r.type, description: r.desc})", rows)
    print(f"  Property: {cnt}")

    # ---- Herb ----
    rows = [{"id": r[0], "name": r[1], "py": r[2] or "", "ln": r[3] or "",
             "al": r[4] or "", "desc": r[5] or "", "ud": r[6] or "",
             "ca": r[7] or "", "qa": r[8] or "", "ic": r[9] or 0}
            for r in cur.execute("SELECT id,name,pinyin,latin_name,alias,description,usage_dosage,caution,quality,is_common FROM herbs")]
    cnt = batch_run(s, """UNWIND $batch AS r
        CREATE (:Herb {id: r.id, name: r.name, pinyin: r.py, latin_name: r.ln,
               alias: r.al, description: r.desc, usage_dosage: r.ud,
               caution: r.ca, quality: r.qa, is_common: r.ic})""", rows)
    print(f"  Herb: {cnt}")

    # ---- Formula ----
    rows = [{"id": r[0], "name": r[1], "py": r[2] or "", "cat": r[3] or "",
             "desc": r[4] or "", "usg": r[5] or "", "ca": r[6] or "", "src": r[7] or ""}
            for r in cur.execute("SELECT id,name,pinyin,category,description,usage,caution,source FROM formulas")]
    cnt = batch_run(s, """UNWIND $batch AS r
        CREATE (:Formula {id: r.id, name: r.name, pinyin: r.py, category: r.cat,
               description: r.desc, usage: r.usg, caution: r.ca, source: r.src})""", rows)
    print(f"  Formula: {cnt}")

# ---- Relationships (also batch) ----
with driver.session() as s:
    rels = [
        ("BELONGS_TO_CATEGORY", "Herb", "Category",
         [{"h": r[0], "t": r[1]} for r in cur.execute("SELECT id, category_id FROM herbs WHERE category_id IS NOT NULL")]),
        ("FROM_REGION", "Herb", "Region",
         [{"h": r[0], "t": r[1]} for r in cur.execute("SELECT id, region_id FROM herbs WHERE region_id IS NOT NULL")]),
        ("FROM_SOURCE", "Herb", "Source",
         [{"h": r[0], "t": r[1]} for r in cur.execute("SELECT id, source_id FROM herbs WHERE source_id IS NOT NULL")]),
        ("HAS_EFFICACY", "Herb", "Efficacy",
         [{"h": r[0], "t": r[1]} for r in cur.execute("SELECT herb_id, efficacy_id FROM herb_efficacies")]),
        ("MERIDIAN_AFFINITY", "Herb", "Meridian",
         [{"h": r[0], "t": r[1]} for r in cur.execute("SELECT herb_id, meridian_id FROM herb_meridians")]),
        ("HAS_PROPERTY", "Herb", "Property",
         [{"h": r[0], "t": r[1], "int": r[2] or "normal"}
          for r in cur.execute("SELECT herb_id, property_id, intensity FROM herb_properties")]),
    ]
    
    for rel_type, src_lbl, tgt_lbl, rows in rels:
        if "HAS_PROPERTY" in rel_type:
            cnt = batch_run(s, f"""UNWIND $batch AS r
                MATCH (a:{src_lbl} {{id: r.h}}), (b:{tgt_lbl} {{id: r.t}})
                MERGE (a)-[:{rel_type} {{intensity: r.int}}]->(b)""", rows)
        else:
            cnt = batch_run(s, f"""UNWIND $batch AS r
                MATCH (a:{src_lbl} {{id: r.h}}), (b:{tgt_lbl} {{id: r.t}})
                MERGE (a)-[:{rel_type}]->(b)""", rows)
        print(f"  {rel_type}: {cnt}")

    # CONTAINS_HERB (Formula -> Herb)
    rows = [{"f": r[0], "h": r[1], "dos": r[2] or "", "role": r[3] or "", "note": r[4] or ""}
            for r in cur.execute("SELECT formula_id, herb_id, dosage, role, note FROM formula_herbs")]
    cnt = batch_run(s, """UNWIND $batch AS r
        MATCH (f:Formula {id: r.f}), (h:Herb {id: r.h})
        MERGE (f)-[:CONTAINS_HERB {dosage: r.dos, role: r.role, note: r.note}]->(h)""", rows)
    print(f"  CONTAINS_HERB: {cnt}")

    # COMPATIBILITY (Herb -> Herb)
    rows = [{"h1": r[0], "h2": r[1], "type": r[2], "desc": r[3] or "", "src": r[4] or ""}
            for r in cur.execute("SELECT herb1_id, herb2_id, relation_type, description, source FROM compatibility_rules")]
    cnt = batch_run(s, """UNWIND $batch AS r
        MATCH (h1:Herb {id: r.h1}), (h2:Herb {id: r.h2})
        MERGE (h1)-[:COMPATIBILITY {type: r.type, description: r.desc, source: r.src}]->(h2)""", rows)
    print(f"  COMPATIBILITY: {cnt}")

# ---- Summary ----
with driver.session() as s:
    labels = s.run("MATCH (n) UNWIND labels(n) AS l RETURN l, count(*) AS c ORDER BY c DESC").data()
    total_n = s.run("MATCH (n) RETURN count(n) AS c").single()["c"]
    total_r = s.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]

print(f"\n{'='*40}")
print(f"Total: {total_n} nodes, {total_r} relationships")
for row in labels:
    print(f"  {row['l']}: {row['c']}")

db.close()
driver.close()
print("\nDone!")
