# backend/api.py
from flask import Flask, render_template, jsonify, send_from_directory
from neo4j import GraphDatabase
import os

app = Flask(__name__, static_folder="../", template_folder="../templates")

# 配置 Neo4j
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "neo4j123456"
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# API：获取图数据
@app.route('/api/graph')
def get_graph_data():
    query = """
    MATCH (n)-[r]->(m)
    RETURN n, r, m LIMIT 10000
    """
    with driver.session() as session:
        result = session.run(query)

        nodes = {}
        links = []

        for record in result:
            source = record["n"]
            target = record["m"]
            rel = record["r"]

            def convert_node(node):
                return {
                    "id": str(node.id),
                    "label": node.labels[0] if node.labels else "",
                    **node._properties
                }

            sid = str(source.id)
            tid = str(target.id)

            if sid not in nodes:
                nodes[sid] = convert_node(source)
            if tid not in nodes:
                nodes[tid] = convert_node(target)

            links.append({
                "source": sid,
                "target": tid,
                "type": rel.type,
                **rel._properties
            })

        return jsonify({
            "nodes": list(nodes.values()),
            "links": links
        })

# 启动入口
if __name__ == '__main__':
    app.run(debug=True)
